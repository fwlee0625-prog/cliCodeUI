import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleHelp,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  TestTube2,
  Trash2,
  X,
} from 'lucide-react';

import { api, readApiJson } from '@/shared/api';
import { PROVIDER_MODELS_CHANGED_EVENT } from '@/shared/constants';
import type {
  AgentModelProvider,
  AgentModelProviderApiFormat,
  AgentModelProviderModel,
  AgentProvider,
} from '@/shared/types';

type ProviderForm = {
  name: string;
  apiFormat: AgentModelProviderApiFormat;
  baseUrl: string;
  apiKey: string;
  modelsText: string;
  defaultModel: string;
  enabled: boolean;
  isDefault: boolean;
};

type ProviderListResponse = { providers: AgentModelProvider[] };
type ProviderMutationResponse = { provider: AgentModelProvider };
type ProbeResponse = { success: boolean; modelCount: number };
type DiscoverResponse = { models: AgentModelProviderModel[] };

const defaultApiFormat = (agent: AgentProvider): AgentModelProviderApiFormat => (
  agent === 'claude' ? 'anthropic' : 'openai-compatible'
);

const emptyForm = (agent: AgentProvider, isDefault = false): ProviderForm => ({
  name: '',
  apiFormat: defaultApiFormat(agent),
  baseUrl: '',
  apiKey: '',
  modelsText: '',
  defaultModel: '',
  enabled: true,
  isDefault,
});

const formFromProvider = (provider: AgentModelProvider): ProviderForm => ({
  name: provider.name,
  apiFormat: provider.apiFormat,
  baseUrl: provider.baseUrl,
  // Never hydrate the secret back into the browser. Blank means "keep saved key".
  apiKey: '',
  modelsText: provider.models.map((model) => model.name && model.name !== model.id
    ? `${model.id}|${model.name}`
    : model.id).join('\n'),
  defaultModel: provider.defaultModel,
  enabled: provider.enabled,
  isDefault: provider.isDefault,
});

function parseModelLines(value: string): AgentModelProviderModel[] {
  const seen = new Set<string>();
  return value.split(/\r?\n/).flatMap((line) => {
    const [rawId, ...rawName] = line.split('|');
    const id = rawId.trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const name = rawName.join('|').trim() || id;
    return [{ id, name }];
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function readApiData<T>(response: Response): Promise<T> {
  const body = await readApiJson<{ data?: T }>(response);
  if (!body.data) {
    throw new Error('The server returned an empty response.');
  }
  return body.data;
}

/** Manage per-agent third-party API suppliers without exposing stored API keys to the browser. */
export default function AgentProvidersContent({ agent }: { agent: AgentProvider }) {
  const { t } = useTranslation('settings');
  const [providers, setProviders] = useState<AgentModelProvider[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ProviderForm>(() => emptyForm(agent));
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'save' | 'test' | 'discover' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? null,
    [providers, selectedId],
  );
  const parsedModels = useMemo(() => parseModelLines(form.modelsText), [form.modelsText]);
  const supported = agent !== 'cursor';

  const loadProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.providers.modelProviders(agent);
      const data = await readApiData<ProviderListResponse>(response);
      const nextProviders = data.providers ?? [];
      setProviders(nextProviders);
      setSelectedId((current) => (
        current && nextProviders.some((provider) => provider.id === current)
          ? current
          : nextProviders[0]?.id ?? null
      ));
      if (!isEditing && nextProviders.length > 0) {
        const current = nextProviders.find((provider) => provider.id === selectedId) ?? nextProviders[0];
        setForm(formFromProvider(current));
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, t('providers.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agent, isEditing, selectedId, t]);

  useEffect(() => {
    setProviders([]);
    setSelectedId(null);
    setForm(emptyForm(agent));
    setIsEditing(false);
    setNotice(null);
    void loadProviders();
  }, [agent]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProvider = (provider: AgentModelProvider) => {
    setSelectedId(provider.id);
    setForm(formFromProvider(provider));
    setIsEditing(false);
    setError(null);
    setNotice(null);
  };

  const startCreate = () => {
    const shouldDefault = !providers.some((provider) => provider.enabled && provider.isDefault);
    setSelectedId(null);
    setForm(emptyForm(agent, shouldDefault));
    setIsEditing(true);
    setError(null);
    setNotice(null);
  };

  const startEdit = () => {
    if (!selectedProvider) return;
    setForm(formFromProvider(selectedProvider));
    setIsEditing(true);
    setError(null);
    setNotice(null);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    apiFormat: form.apiFormat,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey,
    models: parsedModels,
    defaultModel: form.defaultModel || parsedModels[0]?.id || '',
    enabled: form.enabled,
    isDefault: form.isDefault,
  });

  const handleTestConnection = async () => {
    setBusyAction('test');
    setError(null);
    setNotice(null);
    try {
      const response = await api.providers.testModelProvider(agent, {
        ...buildPayload(),
        ...(selectedId ? { id: selectedId } : {}),
      });
      const result = await readApiData<ProbeResponse>(response);
      setNotice(t('providers.connectionSuccessWithCount', { count: result.modelCount }));
    } catch (probeError) {
      setError(getErrorMessage(probeError, t('providers.connectionFailed')));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDiscoverModels = async () => {
    setBusyAction('discover');
    setError(null);
    setNotice(null);
    try {
      const response = await api.providers.discoverModelProviderModels(agent, {
        ...buildPayload(),
        ...(selectedId ? { id: selectedId } : {}),
      });
      const result = await readApiData<DiscoverResponse>(response);
      const models = result.models ?? [];
      if (models.length === 0) {
        setNotice(t('providers.noModelsFound'));
        return;
      }
      setForm((previous) => ({
        ...previous,
        modelsText: models.map((model) => model.name && model.name !== model.id
          ? `${model.id}|${model.name}`
          : model.id).join('\n'),
        defaultModel: models.some((model) => model.id === previous.defaultModel)
          ? previous.defaultModel
          : models[0].id,
      }));
      setNotice(t('providers.modelsFound', { count: models.length }));
    } catch (discoverError) {
      setError(getErrorMessage(discoverError, t('providers.discoverFailed')));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.baseUrl.trim() || parsedModels.length === 0) {
      setError(t('providers.requiredFields'));
      return;
    }
    const wasDefault = providers.some((provider) => provider.id === selectedId && provider.isDefault);
    setBusyAction('save');
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload();
      const response = selectedId
        ? await api.providers.updateModelProvider(agent, selectedId, payload)
        : await api.providers.createModelProvider(agent, payload);
      const result = await readApiData<ProviderMutationResponse>(response);
      const saved = result.provider;
      setProviders((previous) => {
        const next = previous.some((provider) => provider.id === saved.id)
          ? previous.map((provider) => provider.id === saved.id ? saved : provider)
          : [saved, ...previous];
        return next.map((provider) => (
          saved.isDefault && provider.id !== saved.id
            ? { ...provider, isDefault: false }
            : provider
        ));
      });
      setSelectedId(saved.id);
      if (saved.isDefault) {
        const defaultValue = `cloudcli_${saved.id}/${saved.defaultModel}`;
        localStorage.setItem(`${agent}-model`, defaultValue);
      } else if (wasDefault) {
        localStorage.removeItem(`${agent}-model`);
      }
      setForm(formFromProvider(saved));
      setIsEditing(false);
      setNotice(t('providers.saved'));
      window.dispatchEvent(new Event(PROVIDER_MODELS_CHANGED_EVENT));
    } catch (saveError) {
      setError(getErrorMessage(saveError, t('providers.saveFailed')));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;
    if (!window.confirm(t('providers.confirmDelete', { name: selectedProvider.name }))) return;
    setBusyAction('delete');
    setError(null);
    setNotice(null);
    try {
      const response = await api.providers.deleteModelProvider(agent, selectedProvider.id);
      await readApiData<{ success: boolean }>(response);
      const nextProviders = providers.filter((provider) => provider.id !== selectedProvider.id);
      if (selectedProvider.isDefault) {
        localStorage.removeItem(`${agent}-model`);
      }
      setProviders(nextProviders);
      const nextSelected = nextProviders[0] ?? null;
      setSelectedId(nextSelected?.id ?? null);
      setForm(nextSelected ? formFromProvider(nextSelected) : emptyForm(agent));
      setIsEditing(false);
      setNotice(t('providers.deleted'));
      window.dispatchEvent(new Event(PROVIDER_MODELS_CHANGED_EVENT));
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, t('providers.deleteFailed')));
    } finally {
      setBusyAction(null);
    }
  };

  if (!supported) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('providers.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('providers.description')}</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-medium">{t('providers.cursorUnsupportedTitle')}</div>
            <p className="mt-1 leading-6">{t('providers.cursorUnsupportedDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('providers.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('providers.description')}</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={busyAction !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('providers.add')}
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t('providers.securityHint')}</p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.45fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <h4 className="text-sm font-semibold text-foreground">{t('providers.listTitle')}</h4>
            <span className="text-xs text-muted-foreground">{providers.length}</span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('providers.loading')}
            </div>
          ) : providers.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Plus className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{t('providers.emptyTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('providers.emptyDescription')}</p>
              <button type="button" onClick={startCreate} className="mt-4 text-sm font-medium text-primary hover:underline">
                {t('providers.addFirst')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => selectProvider(provider)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                    selectedId === provider.id && !isEditing
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:bg-muted/60'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <span className="text-sm font-semibold">{provider.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{provider.name}</span>
                      {provider.isDefault && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t('providers.default')}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{provider.apiFormat === 'anthropic' ? 'Anthropic' : agent === 'codex' ? 'OpenAI Responses' : 'OpenAI Compatible'}</span>
                      <span>·</span>
                      <span>{t('providers.modelCount', { count: provider.models.length })}</span>
                    </div>
                  </div>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${provider.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <h4 className="text-sm font-semibold text-foreground">
              {isEditing
                ? (selectedId ? t('providers.editTitle') : t('providers.addTitle'))
                : t('providers.configurationTitle')}
            </h4>
            {!isEditing && selectedProvider && (
              <button type="button" onClick={startEdit} className="text-sm font-medium text-primary hover:underline">
                {t('providers.edit')}
              </button>
            )}
          </div>

          {!isEditing && !selectedProvider ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {t('providers.selectOrAdd')}
            </div>
          ) : isEditing ? (
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">{t('providers.name')} <span className="text-destructive">*</span></span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder={t('providers.namePlaceholder')}
                    maxLength={80}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">{t('providers.protocol')}</span>
                  <select
                    value={form.apiFormat}
                    onChange={(event) => setForm((previous) => ({ ...previous, apiFormat: event.target.value as AgentModelProviderApiFormat }))}
                    disabled={agent !== 'opencode'}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-70"
                  >
                    {agent !== 'opencode' && <option value={defaultApiFormat(agent)}>{agent === 'claude' ? 'Anthropic Compatible' : 'OpenAI Responses API'}</option>}
                    {agent === 'opencode' && <>
                      <option value="openai-compatible">OpenAI Compatible</option>
                      <option value="anthropic">Anthropic Compatible</option>
                    </>}
                  </select>
                </label>
              </div>

              {agent === 'codex' && (
                <p className="text-xs leading-5 text-muted-foreground">{t('providers.codexResponsesHint')}</p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">{t('providers.baseUrl')} <span className="text-destructive">*</span></span>
                <input
                  value={form.baseUrl}
                  onChange={(event) => setForm((previous) => ({ ...previous, baseUrl: event.target.value }))}
                  placeholder={form.apiFormat === 'anthropic'
                    ? (agent === 'opencode' ? 'https://api.anthropic.com/v1' : 'https://api.anthropic.com')
                    : 'https://api.example.com/v1'}
                  spellCheck={false}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">{t('providers.apiKey')}</span>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => setForm((previous) => ({ ...previous, apiKey: event.target.value }))}
                  placeholder={selectedProvider?.hasApiKey ? t('providers.apiKeyKeepHint', { preview: selectedProvider.apiKeyPreview }) : t('providers.apiKeyPlaceholder')}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{t('providers.apiKeyHint')}</span>
              </label>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-foreground">{t('providers.models')} <span className="text-destructive">*</span></label>
                  <button
                    type="button"
                    onClick={() => void handleDiscoverModels()}
                    disabled={busyAction !== null || !form.baseUrl.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === 'discover' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {t('providers.fetchModels')}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={form.modelsText}
                  onChange={(event) => setForm((previous) => ({
                    ...previous,
                    modelsText: event.target.value,
                    defaultModel: (() => {
                      const nextModels = parseModelLines(event.target.value);
                      return nextModels.some((model) => model.id === previous.defaultModel)
                        ? previous.defaultModel
                        : nextModels[0]?.id ?? '';
                    })(),
                  }))}
                  placeholder={t('providers.modelsPlaceholder')}
                  spellCheck={false}
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground outline-none transition-colors focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{t('providers.modelsHint')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">{t('providers.defaultModel')}</span>
                  <select
                    value={form.defaultModel}
                    onChange={(event) => setForm((previous) => ({ ...previous, defaultModel: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    {parsedModels.length === 0
                      ? <option value="">{t('providers.addModelsFirst')}</option>
                      : parsedModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                  </select>
                </label>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((previous) => ({ ...previous, enabled: event.target.checked, isDefault: event.target.checked ? previous.isDefault : false }))} className="h-4 w-4 rounded border-border accent-primary" />
                    {t('providers.enabled')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((previous) => ({ ...previous, isDefault: event.target.checked, enabled: event.target.checked ? true : previous.enabled }))} className="h-4 w-4 rounded border-border accent-primary" />
                    {t('providers.setDefault')}
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex flex-wrap gap-2">
                  {selectedProvider && (
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={busyAction !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
                    >
                      {busyAction === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {t('providers.delete')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleTestConnection()}
                    disabled={busyAction !== null || !form.baseUrl.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {busyAction === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                    {t('providers.testConnection')}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProvider) {
                        setForm(formFromProvider(selectedProvider));
                        setIsEditing(false);
                      } else {
                        setForm(emptyForm(agent));
                        setIsEditing(false);
                      }
                      setError(null);
                      setNotice(null);
                    }}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('providers.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busyAction === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t('providers.save')}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedProvider ? (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-base font-semibold text-foreground">{selectedProvider.name}</h5>
                    {selectedProvider.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t('providers.default')}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${selectedProvider.enabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}>
                      {selectedProvider.enabled ? t('providers.enabled') : t('providers.disabled')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedProvider.apiFormat === 'anthropic' ? 'Anthropic Compatible' : agent === 'codex' ? 'OpenAI Responses API' : 'OpenAI Compatible'}</p>
                </div>
                <button type="button" onClick={startEdit} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  {t('providers.edit')}
                </button>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">{t('providers.baseUrl')}</dt>
                  <dd className="mt-1 break-all text-sm text-foreground">{selectedProvider.baseUrl}</dd>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">{t('providers.apiKey')}</dt>
                  <dd className="mt-1 text-sm text-foreground">{selectedProvider.hasApiKey ? selectedProvider.apiKeyPreview : t('providers.noApiKey')}</dd>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t('providers.defaultModel')}</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-foreground">{selectedProvider.defaultModel}</dd>
                </div>
              </dl>
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">{t('providers.models')} · {selectedProvider.models.length}</div>
                <div className="flex flex-wrap gap-2">
                  {selectedProvider.models.map((model) => (
                    <span key={model.id} className={`rounded-md border px-2 py-1 text-xs ${model.id === selectedProvider.defaultModel ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-muted/30 text-foreground'}`}>
                      {model.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => void handleDelete()} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('providers.delete')}
                </button>
                <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  {t('providers.edit')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
