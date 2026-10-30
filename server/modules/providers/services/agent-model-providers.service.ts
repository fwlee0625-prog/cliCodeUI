import { agentModelProvidersDb } from '@/modules/database/repositories/agent-model-providers.db.js';
import type {
  AgentModelProviderApiFormat,
  AgentModelProviderInput,
  AgentModelProviderModel,
  AgentModelProviderRecord,
} from '@/modules/database/repositories/agent-model-providers.db.js';
import type {
  AgentModelProviderRuntimeConfig,
  LLMProvider,
  ProviderModelsDefinition,
} from '@/shared/types.js';
import { AppError } from '@/shared/utils.js';

type ProbeConfig = {
  apiFormat: AgentModelProviderApiFormat;
  baseUrl: string;
  apiKey: string;
};

type Dependencies = {
  repository: typeof agentModelProvidersDb;
  fetch: typeof fetch;
};

const AGENTS: LLMProvider[] = ['claude', 'codex', 'cursor', 'opencode'];
const REQUEST_TIMEOUT_MS = 12_000;

function badRequest(message: string, code = 'INVALID_MODEL_PROVIDER'): AppError {
  return new AppError(message, { code, statusCode: 400 });
}

function normalizeAgent(value: string): LLMProvider {
  if ((AGENTS as string[]).includes(value)) return value as LLMProvider;
  throw badRequest('Unsupported agent.', 'UNSUPPORTED_PROVIDER');
}

function normalizeBaseUrl(value: unknown, apiFormat: AgentModelProviderApiFormat): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) throw badRequest('API Base URL is required.', 'MODEL_PROVIDER_BASE_URL_REQUIRED');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('API Base URL must be a valid HTTP or HTTPS URL.', 'INVALID_MODEL_PROVIDER_BASE_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw badRequest('API Base URL must use HTTP or HTTPS and cannot contain credentials.', 'INVALID_MODEL_PROVIDER_BASE_URL');
  }
  url.hash = '';
  url.search = '';
  if (apiFormat === 'openai-compatible' && !/\/v\d+(?:beta)?$/i.test(url.pathname.replace(/\/+$/, ''))) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1`;
  }
  return url.toString().replace(/\/+$/, '');
}

function normalizeApiFormat(agent: LLMProvider, value: unknown): AgentModelProviderApiFormat {
  const format = value === 'anthropic' ? 'anthropic' : value === 'openai-compatible' ? 'openai-compatible' : null;
  if (!format) throw badRequest('Choose a supported API protocol.', 'INVALID_MODEL_PROVIDER_FORMAT');
  if (agent === 'cursor') {
    throw badRequest('Cursor Agent CLI does not currently expose a third-party API provider interface.', 'MODEL_PROVIDER_UNSUPPORTED');
  }
  if (agent === 'claude' && format !== 'anthropic') {
    throw badRequest('Claude Code requires an Anthropic-compatible API provider.', 'MODEL_PROVIDER_FORMAT_UNSUPPORTED');
  }
  if (agent === 'codex' && format !== 'openai-compatible') {
    throw badRequest('Codex requires an OpenAI-compatible Responses API provider.', 'MODEL_PROVIDER_FORMAT_UNSUPPORTED');
  }
  return format;
}

function normalizeModels(value: unknown): AgentModelProviderModel[] {
  if (!Array.isArray(value)) throw badRequest('Add at least one model ID.', 'MODEL_PROVIDER_MODELS_REQUIRED');
  if (value.length > 100) throw badRequest('A supplier can contain at most 100 models.', 'MODEL_PROVIDER_TOO_MANY_MODELS');

  const seen = new Set<string>();
  const models: AgentModelProviderModel[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const model = entry as Record<string, unknown>;
    const id = typeof model.id === 'string' ? model.id.trim() : '';
    if (!id || id.length > 160 || seen.has(id)) continue;
    seen.add(id);
    const name = typeof model.name === 'string' && model.name.trim() ? model.name.trim().slice(0, 160) : id;
    models.push({ id, name });
  }
  if (models.length === 0) throw badRequest('Add at least one valid model ID.', 'MODEL_PROVIDER_MODELS_REQUIRED');
  return models;
}

function toPublic(record: AgentModelProviderRecord) {
  const apiKey = record.apiKey.trim();
  const apiKeyPreview = apiKey.length > 8
    ? `${apiKey.slice(0, 4)}••••••${apiKey.slice(-3)}`
    : apiKey ? '••••••••' : '';
  return {
    id: record.id,
    agent: record.agent,
    name: record.name,
    apiFormat: record.apiFormat,
    baseUrl: record.baseUrl,
    models: record.models,
    defaultModel: record.defaultModel,
    enabled: record.enabled,
    isDefault: record.isDefault,
    hasApiKey: Boolean(apiKey),
    apiKeyPreview,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildModelsUrl(config: ProbeConfig): string {
  const url = new URL(config.baseUrl);
  let pathname = url.pathname.replace(/\/+$/, '');
  if (config.apiFormat === 'anthropic' && !pathname.endsWith('/v1')) {
    pathname += '/v1';
  }
  url.pathname = `${pathname}/models`.replace(/^\/\//, '/');
  return url.toString();
}

function parseDiscoveredModels(payload: unknown): AgentModelProviderModel[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as Record<string, unknown>;
  const entries = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.models)
      ? body.models
      : [];

  const models: AgentModelProviderModel[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string'
      ? row.id.trim()
      : typeof row.name === 'string'
        ? row.name.trim().replace(/^models\//, '')
        : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = typeof row.display_name === 'string' && row.display_name.trim()
      ? row.display_name.trim()
      : typeof row.displayName === 'string' && row.displayName.trim()
        ? row.displayName.trim()
        : id;
    models.push({ id, name });
  }
  return models;
}

function resolveProbeConfig(
  userId: number,
  agent: LLMProvider,
  input: Record<string, unknown>,
  repository: typeof agentModelProvidersDb,
): ProbeConfig {
  const id = Number(input.id);
  const existing = Number.isSafeInteger(id) && id > 0 ? repository.get(userId, agent, id) : null;
  const apiFormat = normalizeApiFormat(agent, input.apiFormat ?? existing?.apiFormat);
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? existing?.baseUrl, apiFormat);
  const apiKey = typeof input.apiKey === 'string' && input.apiKey.trim()
    ? input.apiKey.trim()
    : existing?.apiKey ?? '';
  return { apiFormat, baseUrl, apiKey };
}

export function createAgentModelProvidersService(
  overrides: Partial<Dependencies> = {},
) {
  const dependencies: Dependencies = {
    repository: agentModelProvidersDb,
    fetch: globalThis.fetch.bind(globalThis),
    ...overrides,
  };

  const requestModels = async (config: ProbeConfig): Promise<AgentModelProviderModel[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {};
      if (config.apiFormat === 'anthropic') {
        if (config.apiKey) headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
      }

      const response = await dependencies.fetch(buildModelsUrl(config), {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'error',
      });
      const raw = await response.text();
      if (!response.ok) {
        // Avoid reflecting provider response bodies: some gateways echo request
        // headers or credential fragments in their error payloads.
        throw new AppError(
          `Provider returned HTTP ${response.status}. Check the API URL and key.`,
          { code: 'MODEL_PROVIDER_CONNECTION_FAILED', statusCode: 502 },
        );
      }

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new AppError('Provider returned an invalid JSON model list.', {
          code: 'MODEL_PROVIDER_INVALID_RESPONSE',
          statusCode: 502,
        });
      }

      const models = parseDiscoveredModels(payload);
      if (models.length === 0) {
        throw new AppError('Connection succeeded, but the endpoint did not return a model list. Add model IDs manually.', {
          code: 'MODEL_PROVIDER_MODELS_UNAVAILABLE',
          statusCode: 422,
        });
      }
      return models;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('Provider connection timed out.', {
          code: 'MODEL_PROVIDER_CONNECTION_TIMEOUT',
          statusCode: 504,
        });
      }
      throw new AppError(
        error instanceof Error ? error.message : 'Could not connect to the provider.',
        { code: 'MODEL_PROVIDER_CONNECTION_FAILED', statusCode: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  const toRuntimeConfig = (record: AgentModelProviderRecord): AgentModelProviderRuntimeConfig => ({
    id: record.id,
    agent: record.agent,
    name: record.name,
    apiFormat: record.apiFormat,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    models: record.models,
    defaultModel: record.defaultModel,
    providerKey: `cloudcli_${record.id}`,
  });

  const getActiveProvider = (
    userId: number | null,
    agent: LLMProvider,
    requestedModel?: string,
  ): AgentModelProviderRuntimeConfig | null => {
    if (!userId || agent === 'cursor') return null;

    // Custom model selections carry their supplier id in the model value, so
    // existing sessions keep using the supplier they originally selected even
    // after the agent's default supplier changes.
    if (requestedModel) {
      const match = /^cloudcli_(\d+)\/(.+)$/.exec(requestedModel.trim());
      if (!match) return null;
      const record = dependencies.repository.get(userId, agent, Number(match[1]));
      if (!record || !record.enabled || !record.models.some((model) => model.id === match[2])) {
        return null;
      }
      return toRuntimeConfig(record);
    }

    const record = dependencies.repository.getDefault(userId, agent);
    return record && record.enabled ? toRuntimeConfig(record) : null;
  };

  const getRuntimeModelCatalog = (
    userId: number | null,
    agent: LLMProvider,
    fallback: ProviderModelsDefinition,
  ): ProviderModelsDefinition => {
    if (!userId || agent === 'cursor') return fallback;

    const enabledProviders = dependencies.repository.list(userId, agent).filter((record) => record.enabled);
    if (enabledProviders.length === 0) return fallback;

    const options = enabledProviders.flatMap((record) => {
      const providerKey = `cloudcli_${record.id}`;
      return record.models.map((model) => ({
        value: `${providerKey}/${model.id}`,
        label: `${record.name} · ${model.name}`,
        description: record.apiFormat === 'anthropic' ? 'Anthropic Compatible' : 'OpenAI Compatible',
        isCustom: true,
      }));
    });

    const defaultProvider = enabledProviders.find((record) => record.isDefault);
    const defaultValue = defaultProvider
      ? `cloudcli_${defaultProvider.id}/${defaultProvider.defaultModel}`
      : fallback.DEFAULT;

    return {
      ...fallback,
      OPTIONS: [...fallback.OPTIONS, ...options],
      DEFAULT: options.some((option) => option.value === defaultValue)
        ? defaultValue
        : fallback.DEFAULT,
    };
  };

  return {
    list(userId: number, agentInput: string) {
      const agent = normalizeAgent(agentInput);
      return { providers: dependencies.repository.list(userId, agent).map(toPublic) };
    },

    save(userId: number, agentInput: string, input: Record<string, unknown>) {
      const agent = normalizeAgent(agentInput);
      const id = Number(input.id);
      const existing = Number.isSafeInteger(id) && id > 0
        ? dependencies.repository.get(userId, agent, id)
        : null;
      if (input.id !== undefined && !existing) {
        throw new AppError('Model provider not found.', { code: 'MODEL_PROVIDER_NOT_FOUND', statusCode: 404 });
      }

      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 80) {
        throw badRequest('Supplier name is required and must be 80 characters or fewer.', 'MODEL_PROVIDER_NAME_REQUIRED');
      }
      const apiFormat = normalizeApiFormat(agent, input.apiFormat ?? existing?.apiFormat);
      const baseUrl = normalizeBaseUrl(input.baseUrl ?? existing?.baseUrl, apiFormat);
      const apiKey = typeof input.apiKey === 'string' && input.apiKey.trim()
        ? input.apiKey.trim()
        : existing?.apiKey ?? '';
      const models = normalizeModels(input.models ?? existing?.models);
      const defaultModelInput = typeof input.defaultModel === 'string' ? input.defaultModel.trim() : '';
      const defaultModel = models.some((model) => model.id === defaultModelInput)
        ? defaultModelInput
        : models[0].id;
      const enabled = typeof input.enabled === 'boolean' ? input.enabled : existing?.enabled ?? true;
      const requestedDefault = typeof input.isDefault === 'boolean' ? input.isDefault : existing?.isDefault ?? false;
      if (requestedDefault && !enabled) {
        throw badRequest('An inactive supplier cannot be the default.', 'MODEL_PROVIDER_DEFAULT_MUST_BE_ENABLED');
      }

      const currentProviders = dependencies.repository.list(userId, agent);
      const isDefault = requestedDefault || (!existing && enabled && !currentProviders.some((item) => item.isDefault && item.enabled));
      const normalized: AgentModelProviderInput = {
        name,
        apiFormat,
        baseUrl,
        apiKey,
        models,
        defaultModel,
        enabled,
        isDefault,
      };
      const saved = existing
        ? dependencies.repository.update(userId, agent, existing.id, normalized)
        : dependencies.repository.create(userId, agent, normalized);
      if (!saved) {
        throw new AppError('Model provider not found.', { code: 'MODEL_PROVIDER_NOT_FOUND', statusCode: 404 });
      }
      return { provider: toPublic(saved) };
    },

    delete(userId: number, agentInput: string, idInput: unknown) {
      const agent = normalizeAgent(agentInput);
      const id = Number(idInput);
      if (!Number.isSafeInteger(id) || id < 1) {
        throw badRequest('Invalid supplier ID.', 'INVALID_MODEL_PROVIDER_ID');
      }
      if (!dependencies.repository.delete(userId, agent, id)) {
        throw new AppError('Model provider not found.', { code: 'MODEL_PROVIDER_NOT_FOUND', statusCode: 404 });
      }
      return { success: true };
    },

    async testConnection(userId: number, agentInput: string, input: Record<string, unknown>) {
      const agent = normalizeAgent(agentInput);
      const config = resolveProbeConfig(userId, agent, input, dependencies.repository);
      const models = await requestModels(config);
      return { success: true, modelCount: models.length };
    },

    async discoverModels(userId: number, agentInput: string, input: Record<string, unknown>) {
      const agent = normalizeAgent(agentInput);
      const config = resolveProbeConfig(userId, agent, input, dependencies.repository);
      return { models: await requestModels(config) };
    },

    getActiveProvider,
    getRuntimeModelCatalog,
  };
}

export const agentModelProvidersService = createAgentModelProvidersService();
