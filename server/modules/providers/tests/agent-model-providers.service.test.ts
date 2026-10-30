import assert from 'node:assert/strict';
import test from 'node:test';

import { agentModelProvidersDb } from '@/modules/database/repositories/agent-model-providers.db.js';
import type {
  AgentModelProviderInput,
  AgentModelProviderRecord,
} from '@/modules/database/repositories/agent-model-providers.db.js';
import { createAgentModelProvidersService } from '@/modules/providers/services/agent-model-providers.service.js';
import type { LLMProvider, ProviderModelsDefinition } from '@/shared/types.js';

const createRepository = () => {
  const records: AgentModelProviderRecord[] = [];
  let nextId = 1;

  const repository = {
    list(userId: number, agent: LLMProvider) {
      return records
        .filter((record) => record.userId === userId && record.agent === agent)
        .map((record) => ({ ...record, models: [...record.models] }));
    },
    get(userId: number, agent: LLMProvider, id: number) {
      const record = records.find((entry) => entry.userId === userId && entry.agent === agent && entry.id === id);
      return record ? { ...record, models: [...record.models] } : null;
    },
    getDefault(userId: number, agent: LLMProvider) {
      const record = records.find((entry) => (
        entry.userId === userId && entry.agent === agent && entry.enabled && entry.isDefault
      ));
      return record ? { ...record, models: [...record.models] } : null;
    },
    create(userId: number, agent: LLMProvider, input: AgentModelProviderInput) {
      if (input.isDefault) {
        records.forEach((record) => {
          if (record.userId === userId && record.agent === agent) record.isDefault = false;
        });
      }
      const now = new Date().toISOString();
      const record: AgentModelProviderRecord = {
        ...input,
        id: nextId++,
        userId,
        agent,
        models: [...input.models],
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return { ...record, models: [...record.models] };
    },
    update(userId: number, agent: LLMProvider, id: number, input: AgentModelProviderInput) {
      const record = records.find((entry) => entry.userId === userId && entry.agent === agent && entry.id === id);
      if (!record) return null;
      if (input.isDefault) {
        records.forEach((entry) => {
          if (entry.userId === userId && entry.agent === agent && entry.id !== id) entry.isDefault = false;
        });
      }
      Object.assign(record, input, { models: [...input.models], updatedAt: new Date().toISOString() });
      return { ...record, models: [...record.models] };
    },
    delete(userId: number, agent: LLMProvider, id: number) {
      const index = records.findIndex((entry) => entry.userId === userId && entry.agent === agent && entry.id === id);
      if (index < 0) return false;
      records.splice(index, 1);
      return true;
    },
  };

  return { repository: repository as typeof agentModelProvidersDb, records };
};

const createFallbackCatalog = (): ProviderModelsDefinition => ({
  OPTIONS: [{ value: 'native-model', label: 'Native model' }],
  DEFAULT: 'native-model',
});

const createTestService = () => {
  const { repository, records } = createRepository();
  const requests: Array<{ url: string; headers: Headers }> = [];
  const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
    });
    return new Response(JSON.stringify({
      data: [
        { id: 'discovered-model', display_name: 'Discovered Model' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  return {
    records,
    requests,
    service: createAgentModelProvidersService({ repository, fetch: fetchMock }),
  };
};

test('saves a supplier without returning its API key and exposes namespaced model options', () => {
  const { service } = createTestService();
  const result = service.save(7, 'codex', {
    name: 'DeepSeek',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'sk-test-secret',
    models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
    defaultModel: 'deepseek-chat',
    enabled: true,
    isDefault: false,
  });

  assert.equal(result.provider.isDefault, true);
  assert.equal(result.provider.hasApiKey, true);
  assert.equal('apiKey' in result.provider, false);
  assert.equal(service.getActiveProvider(7, 'codex')?.baseUrl, 'https://api.deepseek.com/v1');

  const catalog = service.getRuntimeModelCatalog(7, 'codex', createFallbackCatalog());
  assert.equal(catalog.DEFAULT, `cloudcli_${result.provider.id}/deepseek-chat`);
  assert.deepEqual(catalog.OPTIONS.map((option) => option.value), [
    'native-model',
    `cloudcli_${result.provider.id}/deepseek-chat`,
  ]);
});

test('keeps old sessions bound to their original enabled supplier after the default changes', () => {
  const { service } = createTestService();
  const first = service.save(7, 'codex', {
    name: 'First',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://first.example/v1',
    apiKey: 'first-key',
    models: [{ id: 'first-model', name: 'First model' }],
    defaultModel: 'first-model',
    enabled: true,
    isDefault: true,
  }).provider;
  const second = service.save(7, 'codex', {
    name: 'Second',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://second.example/v1',
    apiKey: 'second-key',
    models: [{ id: 'second-model', name: 'Second model' }],
    defaultModel: 'second-model',
    enabled: true,
    isDefault: true,
  }).provider;

  assert.equal(service.getActiveProvider(7, 'codex')?.id, second.id);
  assert.equal(
    service.getActiveProvider(7, 'codex', `cloudcli_${first.id}/first-model`)?.apiKey,
    'first-key',
  );
  assert.equal(
    service.getActiveProvider(7, 'codex', `cloudcli_${second.id}/second-model`)?.apiKey,
    'second-key',
  );
});

test('tests the saved provider with its stored API key and discovers display names', async () => {
  const { service, requests } = createTestService();
  const saved = service.save(11, 'claude', {
    name: 'Anthropic gateway',
    apiFormat: 'anthropic',
    baseUrl: 'https://anthropic.example',
    apiKey: 'sk-ant-test',
    models: [{ id: 'claude-sonnet', name: 'Claude Sonnet' }],
    defaultModel: 'claude-sonnet',
    enabled: true,
    isDefault: true,
  }).provider;

  const tested = await service.testConnection(11, 'claude', { id: saved.id, apiKey: '' });
  const discovered = await service.discoverModels(11, 'claude', { id: saved.id, apiKey: '' });

  assert.equal(tested.modelCount, 1);
  assert.equal(requests[0]?.url, 'https://anthropic.example/v1/models');
  assert.equal(requests[0]?.headers.get('x-api-key'), 'sk-ant-test');
  assert.equal(requests[0]?.headers.get('anthropic-version'), '2023-06-01');
  assert.deepEqual(discovered.models, [{ id: 'discovered-model', name: 'Discovered Model' }]);
});

test('rejects protocols the selected agent cannot use', () => {
  const { service } = createTestService();
  assert.throws(() => service.save(7, 'claude', {
    name: 'Wrong protocol',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: '',
    models: [{ id: 'model-a', name: 'Model A' }],
    defaultModel: 'model-a',
    enabled: true,
    isDefault: true,
  }), /Claude Code requires an Anthropic-compatible/);

  assert.throws(() => service.save(7, 'cursor', {
    name: 'Cursor provider',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: '',
    models: [{ id: 'model-a', name: 'Model A' }],
    defaultModel: 'model-a',
    enabled: true,
    isDefault: true,
  }), /does not currently expose a third-party API provider interface/);
});
