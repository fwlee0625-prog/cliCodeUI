import { getConnection } from '@/modules/database/connection.js';
import type { LLMProvider } from '@/shared/types.js';

export type AgentModelProviderApiFormat = 'openai-compatible' | 'anthropic';
export type AgentModelProviderModel = { id: string; name: string };

export type AgentModelProviderInput = {
  name: string;
  apiFormat: AgentModelProviderApiFormat;
  baseUrl: string;
  apiKey: string;
  models: AgentModelProviderModel[];
  defaultModel: string;
  enabled: boolean;
  isDefault: boolean;
};

export type AgentModelProviderRecord = AgentModelProviderInput & {
  id: number;
  userId: number;
  agent: LLMProvider;
  createdAt: string;
  updatedAt: string;
};

type AgentModelProviderRow = {
  id: number;
  user_id: number;
  agent: LLMProvider;
  name: string;
  api_format: AgentModelProviderApiFormat;
  base_url: string;
  api_key: string;
  models_json: string;
  default_model: string;
  enabled: number;
  is_default: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS = `
  id, user_id, agent, name, api_format, base_url, api_key,
  models_json, default_model, enabled, is_default, created_at, updated_at
`;

function readModels(value: string): AgentModelProviderModel[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const model = entry as Record<string, unknown>;
      if (typeof model.id !== 'string' || !model.id.trim()) return [];
      const id = model.id.trim();
      const name = typeof model.name === 'string' && model.name.trim() ? model.name.trim() : id;
      return [{ id, name }];
    });
  } catch {
    return [];
  }
}

function toRecord(row: AgentModelProviderRow): AgentModelProviderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    agent: row.agent,
    name: row.name,
    apiFormat: row.api_format,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    models: readModels(row.models_json),
    defaultModel: row.default_model,
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readOne(userId: number, agent: LLMProvider, id: number): AgentModelProviderRow | null {
  const row = getConnection().prepare(`
    SELECT ${COLUMNS}
    FROM agent_model_providers
    WHERE user_id = ? AND agent = ? AND id = ?
  `).get(userId, agent, id) as AgentModelProviderRow | undefined;
  return row ?? null;
}

/** User-scoped model-provider storage. API keys are returned only to server code. */
export const agentModelProvidersDb = {
  list(userId: number, agent: LLMProvider): AgentModelProviderRecord[] {
    const rows = getConnection().prepare(`
      SELECT ${COLUMNS}
      FROM agent_model_providers
      WHERE user_id = ? AND agent = ?
      ORDER BY is_default DESC, updated_at DESC, id ASC
    `).all(userId, agent) as AgentModelProviderRow[];
    return rows.map(toRecord);
  },

  get(userId: number, agent: LLMProvider, id: number): AgentModelProviderRecord | null {
    const row = readOne(userId, agent, id);
    return row ? toRecord(row) : null;
  },

  getDefault(userId: number, agent: LLMProvider): AgentModelProviderRecord | null {
    const row = getConnection().prepare(`
      SELECT ${COLUMNS}
      FROM agent_model_providers
      WHERE user_id = ? AND agent = ? AND enabled = 1 AND is_default = 1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get(userId, agent) as AgentModelProviderRow | undefined;
    return row ? toRecord(row) : null;
  },

  create(userId: number, agent: LLMProvider, input: AgentModelProviderInput): AgentModelProviderRecord {
    const db = getConnection();
    const insert = db.transaction(() => {
      if (input.isDefault) {
        db.prepare(`
          UPDATE agent_model_providers
          SET is_default = 0, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND agent = ?
        `).run(userId, agent);
      }

      const result = db.prepare(`
        INSERT INTO agent_model_providers (
          user_id, agent, name, api_format, base_url, api_key,
          models_json, default_model, enabled, is_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        agent,
        input.name,
        input.apiFormat,
        input.baseUrl,
        input.apiKey,
        JSON.stringify(input.models),
        input.defaultModel,
        input.enabled ? 1 : 0,
        input.isDefault ? 1 : 0,
      );

      const row = readOne(userId, agent, Number(result.lastInsertRowid));
      if (!row) throw new Error('Created model provider could not be read back.');
      return toRecord(row);
    });

    return insert();
  },

  update(
    userId: number,
    agent: LLMProvider,
    id: number,
    input: AgentModelProviderInput,
  ): AgentModelProviderRecord | null {
    const db = getConnection();
    const update = db.transaction(() => {
      if (!readOne(userId, agent, id)) return null;

      if (input.isDefault) {
        db.prepare(`
          UPDATE agent_model_providers
          SET is_default = 0, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND agent = ? AND id <> ?
        `).run(userId, agent, id);
      }

      db.prepare(`
        UPDATE agent_model_providers
        SET name = ?, api_format = ?, base_url = ?, api_key = ?,
            models_json = ?, default_model = ?, enabled = ?, is_default = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND agent = ? AND id = ?
      `).run(
        input.name,
        input.apiFormat,
        input.baseUrl,
        input.apiKey,
        JSON.stringify(input.models),
        input.defaultModel,
        input.enabled ? 1 : 0,
        input.isDefault ? 1 : 0,
        userId,
        agent,
        id,
      );

      const row = readOne(userId, agent, id);
      return row ? toRecord(row) : null;
    });

    return update();
  },

  delete(userId: number, agent: LLMProvider, id: number): boolean {
    const result = getConnection().prepare(`
      DELETE FROM agent_model_providers
      WHERE user_id = ? AND agent = ? AND id = ?
    `).run(userId, agent, id);
    return result.changes > 0;
  },
};
