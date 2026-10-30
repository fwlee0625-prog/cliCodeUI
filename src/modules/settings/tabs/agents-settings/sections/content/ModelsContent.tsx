import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { ModelLibraryPanel } from '@/modules/chat';
import { api } from '@/shared/api';
import { PROVIDER_MODELS_CHANGED_EVENT } from '@/shared/constants';
import type {
  CustomProviderModelInput,
  LLMProvider,
  ProviderModelActions,
  ProviderModelOption,
  ProviderModelsDefinition,
} from '@/shared/types';

const PROVIDERS: LLMProvider[] = ['claude', 'cursor', 'codex', 'opencode'];

type ProviderModelsApiResponse = {
  success?: boolean;
  data?: { models?: ProviderModelsDefinition };
};

type ProviderModelMutationApiResponse = {
  success?: boolean;
  error?: { message?: string };
  data?: { models?: ProviderModelsDefinition };
};

/**
 * Loads every provider's model catalog for the agents settings' models panel and
 * adapts the provider model endpoints into the mutation callbacks ModelLibraryPanel
 * expects. Each mutation applies the catalog the server returns, so the panel shows
 * the same truth the composer's model menus see; mutation errors bubble to the
 * panel's own error display.
 */
function useProviderModelLibrary() {
  const { t } = useTranslation('chat');
  // Retain the latest database catalog for each provider while switching tabs.
  const [providerModelCatalog, setProviderModelCatalog] = useState<Partial<Record<LLMProvider, ProviderModelsDefinition>>>({});
  // True until every provider's catalog request has settled; the panel renders
  // against empty catalogs meanwhile, which would read as "no models" without it.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadCatalogs = async () => {
      setIsLoading(true);
      await Promise.all(
        PROVIDERS.map(async (provider) => {
          try {
            const response = await api.providers.models(provider);
            const body = (await response.json()) as ProviderModelsApiResponse;
            const models = body.success ? body.data?.models : undefined;
            if (!cancelled && models) {
              setProviderModelCatalog((previous) => ({ ...previous, [provider]: models }));
            }
          } catch (error) {
            console.error(`Error loading ${provider} models:`, error);
          }
        }),
      );
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Replaces one provider's catalog with the version returned by a mutation. */
  const applyProviderCatalog = useCallback((
    targetProvider: LLMProvider,
    models: ProviderModelsDefinition,
  ) => {
    setProviderModelCatalog((previous) => ({
      ...previous,
      [targetProvider]: models,
    }));
  }, []);

  const create = useCallback(async (
    targetProvider: LLMProvider,
    input: CustomProviderModelInput,
  ) => {
    const response = await api.providers.createModel(targetProvider, input);
    const body = (await response.json()) as ProviderModelMutationApiResponse;
    if (!response.ok || !body.success || !body.data?.models) {
      throw new Error(body.error?.message || t('modelLibrary.saveFailed'));
    }

    applyProviderCatalog(targetProvider, body.data.models);
    window.dispatchEvent(new Event(PROVIDER_MODELS_CHANGED_EVENT));
  }, [applyProviderCatalog, t]);

  const update = useCallback(async (
    targetProvider: LLMProvider,
    existing: ProviderModelOption,
    input: CustomProviderModelInput,
  ) => {
    if (!existing.recordId) {
      throw new Error(t('modelLibrary.cannotEdit'));
    }

    const response = await api.providers.updateModel(targetProvider, existing.recordId, input);
    const body = (await response.json()) as ProviderModelMutationApiResponse;
    if (!response.ok || !body.success || !body.data?.models) {
      throw new Error(body.error?.message || t('modelLibrary.saveFailed'));
    }

    applyProviderCatalog(targetProvider, body.data.models);
    window.dispatchEvent(new Event(PROVIDER_MODELS_CHANGED_EVENT));
  }, [applyProviderCatalog, t]);

  const remove = useCallback(async (
    targetProvider: LLMProvider,
    existing: ProviderModelOption,
  ) => {
    if (!existing.recordId) {
      throw new Error(t('modelLibrary.cannotDelete'));
    }

    const response = await api.providers.deleteModel(targetProvider, existing.recordId);
    const body = (await response.json()) as ProviderModelMutationApiResponse;
    if (!response.ok || !body.success || !body.data?.models) {
      throw new Error(body.error?.message || t('modelLibrary.deleteFailed'));
    }

    applyProviderCatalog(targetProvider, body.data.models);
    window.dispatchEvent(new Event(PROVIDER_MODELS_CHANGED_EVENT));
  }, [applyProviderCatalog, t]);

  const refresh = useCallback(async (
    targetProvider: LLMProvider,
  ) => {
    const response = await api.providers.refreshModels(targetProvider);
    const body = (await response.json()) as ProviderModelMutationApiResponse;
    if (!response.ok || !body.success || !body.data?.models) {
      throw new Error(body.error?.message || t('modelLibrary.refreshFailed'));
    }

    applyProviderCatalog(targetProvider, body.data.models);
    window.dispatchEvent(new Event(PROVIDER_MODELS_CHANGED_EVENT));
  }, [applyProviderCatalog, t]);

  const actions: ProviderModelActions = {
    create,
    update,
    remove,
    refresh,
  };

  return { providerModelCatalog, actions, isLoading };
}

/** Rendered by AgentCategoryContentSection for the agents tab's "models" category: provider model catalogs and custom-model management. */
export default function ModelsContent({ initialProvider }: { initialProvider: LLMProvider }) {
  const { t } = useTranslation('settings');
  const { providerModelCatalog, actions, isLoading } = useProviderModelLibrary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('tabs.modelsLoading')}
      </div>
    );
  }

  return (
    <ModelLibraryPanel
      initialProvider={initialProvider}
      providerModelCatalog={providerModelCatalog}
      actions={actions}
    />
  );
}
