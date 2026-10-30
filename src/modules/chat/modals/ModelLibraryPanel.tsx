import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Check,
  RefreshCw,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Badge, Button, Input } from '@/shared/ui';
import type {
  CustomProviderModelInput,
  LLMProvider,
  ProviderModelActions,
  ProviderModelOption,
  ProviderModelsDefinition,
} from '@/shared/types';

const PROVIDERS: Array<{ id: LLMProvider; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'opencode', label: 'OpenCode' },
];

type ModelLibraryPanelProps = {
  initialProvider: LLMProvider;
  providerModelCatalog: Partial<Record<LLMProvider, ProviderModelsDefinition>>;
  actions: ProviderModelActions;
  onDone?: () => void;
};

/**
 * Rendered by the settings module's agents-tab ModelsContent (imported through
 * the chat barrel) so the user can browse each provider's model catalog and add
 * or remove custom models.
 *
 * It is an embeddable panel rather than a dialog — it opens no overlay of its
 * own; each consumer decides how to host it. That is why it sits in modals/
 * with no Dialog in the file.
 */
export default function ModelLibraryPanel({
  initialProvider: selectedProvider,
  providerModelCatalog,
  actions,
  onDone,
}: ModelLibraryPanelProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<ProviderModelOption | null>(null);
  const [model, setModel] = useState('');
  const [modelId, setModelId] = useState('');
  // Effort levels ticked in the form; they become the custom model's declared
  // levels, which is what makes the composer offer Reasoning for it.
  const [effortLevels, setEffortLevels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Track refreshes and errors by provider so switching tabs cannot misplace results.
  const [refreshingProviders, setRefreshingProviders] = useState<LLMProvider[]>([]);
  // Keep a failed refresh visible on the provider that requested it.
  const [refreshErrors, setRefreshErrors] = useState<Partial<Record<LLMProvider, string>>>({});

  const options = useMemo(
    () => providerModelCatalog[selectedProvider]?.OPTIONS ?? [],
    [providerModelCatalog, selectedProvider],
  );
  const customModels = useMemo(
    () => options.filter((option) => option.isCustom),
    [options],
  );
  const predefinedModels = useMemo(
    () => options.filter((option) => !option.isCustom),
    [options],
  );
  // Levels a custom model of this provider may declare, weakest first, exactly
  // as the server validates them. They come with the catalog rather than from
  // its built-in models, whose effort metadata depends on which upstream
  // providers this machine has connected (OpenCode). Empty for providers
  // without effort support, which hides the section entirely.
  const providerEffortLevels = providerModelCatalog[selectedProvider]?.EFFORT_LEVELS ?? [];
  const selectedProviderLabel = PROVIDERS.find((entry) => entry.id === selectedProvider)?.label;
  const catalog = providerModelCatalog[selectedProvider];
  const refreshing = refreshingProviders.includes(selectedProvider);
  const refreshError = refreshErrors[selectedProvider] || catalog?.DISCOVERY_ERROR;

  const resetForm = () => {
    setEditing(null);
    setModel('');
    setModelId('');
    setEffortLevels([]);
    setError(null);
  };

  const handleRefresh = async (provider: LLMProvider) => {
    if (!actions.refresh || refreshingProviders.includes(provider)) return;
    setRefreshingProviders((current) => [...current, provider]);
    setRefreshErrors((current) => ({ ...current, [provider]: undefined }));
    try {
      await actions.refresh(provider);
    } catch (error) {
      setRefreshErrors((current) => ({ ...current, [provider]: error instanceof Error ? error.message : t('chat:modelLibrary.refreshFailed') }));
    } finally {
      setRefreshingProviders((current) => current.filter((entry) => entry !== provider));
    }
  };

  const startEditing = (option: ProviderModelOption) => {
    setEditing(option);
    setModel(option.label);
    setModelId(option.value);
    setEffortLevels(option.effort?.values.map((level) => level.value) ?? []);
    setConfirmDeleteRecordId(null);
    setNotice(null);
    setError(null);
  };

  const toggleEffortLevel = (level: string) => {
    setEffortLevels((current) => (
      current.includes(level) ? current.filter((value) => value !== level) : [...current, level]
    ));
  };

  /**
   * Effort part of the save payload. Omitted for providers without effort
   * support; otherwise the ticked levels in display order, or `null` to clear
   * them. A default set earlier (e.g. through the API) survives while its
   * level stays ticked.
   */
  const buildEffortInput = (): CustomProviderModelInput['effort'] => {
    if (providerEffortLevels.length === 0) {
      return undefined;
    }

    const values = providerEffortLevels.filter((level) => effortLevels.includes(level));
    if (values.length === 0) {
      return null;
    }

    const previousDefault = editing?.effort?.default;
    return previousDefault && values.includes(previousDefault)
      ? { values, default: previousDefault }
      : { values };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedModel = model.trim();
    const normalizedId = modelId.trim();
    if (!normalizedModel || !normalizedId) {
      setError(t('chat:misc.enterModelInfo'));
      return;
    }
    if (/\s/.test(normalizedId)) {
      setError(t('chat:modelLibrary.idNoSpaces'));
      return;
    }

    const effort = buildEffortInput();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (editing) {
        await actions.update(selectedProvider, editing, {
          model: normalizedModel,
          id: normalizedId,
          ...(effort === undefined ? {} : { effort }),
        });
        setNotice(t('chat:modelLibrary.updated', { model: normalizedModel }));
      } else {
        await actions.create(selectedProvider, {
          model: normalizedModel,
          id: normalizedId,
          ...(effort === undefined ? {} : { effort }),
        });
        setNotice(t('chat:modelLibrary.added', { model: normalizedModel }));
      }
      resetForm();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('chat:misc.modelSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (option: ProviderModelOption) => {
    if (!option.recordId) {
      return;
    }

    setDeletingRecordId(option.recordId);
    setError(null);
    setNotice(null);
    try {
      await actions.remove(selectedProvider, option);
      if (editing?.recordId === option.recordId) {
        resetForm();
      }
      setConfirmDeleteRecordId(null);
      setNotice(t('chat:modelLibrary.deleted', { model: option.label }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('chat:misc.modelDeleteFailed'));
    } finally {
      setDeletingRecordId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {onDone && (
        <Button type="button" variant="outline" size="sm" onClick={onDone} className="self-start rounded-xl">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('chat:modelLibrary.backToModels')}
        </Button>
      )}

      <div className="scrollbar-thin grid min-h-0 flex-1 items-start gap-4 overflow-y-auto pr-1 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(20rem,1.2fr)]">
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t(editing ? 'chat:modelLibrary.editModel' : 'chat:modelLibrary.addCustomModel')}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('chat:modelLibrary.idSentAsWritten', { provider: selectedProviderLabel })}
              </p>
            </div>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={resetForm}
                className="h-8 w-8 rounded-lg"
                aria-label={t('chat:misc.cancelEditing')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <label className="mt-4 block text-xs font-semibold text-foreground" htmlFor="custom-model-name">
            {t('chat:modelLibrary.modelName')}
          </label>
          <Input
            id="custom-model-name"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            maxLength={80}
            placeholder={t('chat:modelLibrary.namePlaceholder')}
            autoComplete="off"
            className="mt-1.5 h-10 rounded-xl bg-background"
          />

          <label className="mt-4 block text-xs font-semibold text-foreground" htmlFor="custom-model-id">
            {t('chat:modelLibrary.modelId')}
          </label>
          <Input
            id="custom-model-id"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            maxLength={200}
            placeholder={t('chat:modelLibrary.idPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            className="mt-1.5 h-10 rounded-xl bg-background font-mono"
          />
          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            {t('chat:modelLibrary.idHint')}
          </p>

          {providerEffortLevels.length > 0 && (
            <fieldset className="mt-4">
              <legend className="text-xs font-semibold text-foreground">
                {t('chat:modelLibrary.effortLevels')}
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {providerEffortLevels.map((level) => {
                  const selected = effortLevels.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggleEffortLevel(level)}
                      aria-pressed={selected}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        selected
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                {t('chat:modelLibrary.effortLevelsHint')}
              </p>
            </fieldset>
          )}

          {error && (
            <div role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              {notice}
            </div>
          )}

          <Button type="submit" disabled={saving} className="mt-4 w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t(saving ? 'chat:modelLibrary.saving' : editing ? 'chat:modelLibrary.saveChanges' : 'chat:modelLibrary.addModel')}
          </Button>
        </form>

        <div className="min-h-0 space-y-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{t('chat:modelLibrary.yourModels')}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t('chat:modelLibrary.yourModelsHint')}</p>
              </div>
              <Badge variant="secondary" className="rounded-full text-[10px]">{customModels.length}</Badge>
            </div>

            {customModels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-7 text-center">
                <p className="text-sm font-medium text-foreground">{t('chat:modelLibrary.emptyTitle')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('chat:modelLibrary.emptyHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customModels.map((option) => {
                  const confirming = confirmDeleteRecordId === option.recordId;
                  const deleting = deletingRecordId === option.recordId;
                  return (
                    <div key={option.recordId ?? option.value} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{option.label}</p>
                            <Badge className="rounded-full px-2 py-0 text-[9px]">{t('chat:modelLibrary.custom')}</Badge>
                          </div>
                          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{option.value}</p>
                          {option.effort && option.effort.values.length > 0 && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {t('chat:modelLibrary.effortSummary', {
                                levels: option.effort.values.map((level) => level.value).join(' · '),
                              })}
                            </p>
                          )}
                        </div>
                        {!confirming && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditing(option)}
                              className="h-8 w-8 rounded-lg"
                              aria-label={t('chat:modelLibrary.editNamedModel', { model: option.label })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmDeleteRecordId(option.recordId ?? null)}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={t('chat:modelLibrary.deleteNamedModel', { model: option.label })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {confirming && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                          <p className="text-xs text-muted-foreground">{t('chat:modelLibrary.deleteConfirm')}</p>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteRecordId(null)} className="h-8 rounded-lg">
                              {t('chat:modelLibrary.cancel')}
                            </Button>
                            <Button type="button" variant="destructive" size="sm" disabled={deleting} onClick={() => void handleDelete(option)} className="h-8 rounded-lg">
                              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {t('chat:modelLibrary.delete')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{t('chat:modelLibrary.builtInModels')}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{catalog?.FETCHED_AT ? t('chat:modelLibrary.fetchedAt', { time: new Date(catalog.FETCHED_AT).toLocaleString() }) : t('chat:modelLibrary.notFetched')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[10px]">{predefinedModels.length}</Badge>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                  disabled={refreshing || !actions.refresh} onClick={() => void handleRefresh(selectedProvider)}
                  aria-label={t('chat:modelLibrary.refreshModels')} title={t('chat:modelLibrary.refreshModels')}>
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            {refreshError && <p role="alert" className="mb-2 text-xs text-destructive">{refreshError}</p>}
            {predefinedModels.length === 0 && <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">{t('chat:modelLibrary.noFetchedModels')}</p>}
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/70">
                {predefinedModels.map((option) => (
                  <div key={option.recordId ?? option.value} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0">
                    <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{
                        selectedProvider === 'claude' && option.value === 'default'
                          ? t('chat:modelLibrary.defaultRecommended')
                          : selectedProvider === 'claude' && option.value === 'best'
                            ? t('chat:modelLibrary.bestAvailable')
                            : option.label
                      }</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{option.value}</p>
                    </div>
                  </div>
                ))}
              </div>
          </section>
        </div>
      </div>
    </div>
  );
}
