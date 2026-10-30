import { query } from '@anthropic-ai/claude-agent-sdk';
import spawn from 'cross-spawn';

import { codexAppServer } from '@/modules/providers/list/codex/codex-app-server.client.js';
import { resolveClaudeCodeExecutablePath } from '@/shared/claude-cli-path.js';
import type { LLMProvider, ProviderModelOption, ProviderModelsDefinition } from '@/shared/types.js';
import { AppError, stripAnsiSequences } from '@/shared/utils.js';

const TIMEOUT_MS = 30_000;

function readCliOutput(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new AppError(`${command} model discovery timed out.`, { code: 'MODEL_DISCOVERY_FAILED', statusCode: 504 }));
    }, TIMEOUT_MS);
    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
      if (output.length > 2_000_000) {
        child.kill();
        clearTimeout(timer);
        reject(new Error(`${command} model listing exceeded the output limit.`));
      }
    });
    child.stderr?.on('data', (chunk) => { stderr = (stderr + String(chunk)).slice(-2000); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stripAnsiSequences(output));
      else reject(new Error(`${command} model discovery failed: ${stderr.trim() || `exit ${code}`}`));
    });
  });
}

/** Converts the plain model-list commands into catalog rows; exported for discovery parser tests. */
export function parseCliModelListing(provider: 'cursor' | 'opencode', output: string): ProviderModelOption[] {
  const options = new Map<string, ProviderModelOption>();
  for (const line of stripAnsiSequences(output).split(/\r?\n/)) {
    if (provider === 'opencode') {
      const id = line.trim();
      if (/^[\w.-]+\/[\w./:+-]+$/.test(id)) options.set(id, { value: id, label: id });
    } else {
      // Cursor prints `model-id - Display Name`, sometimes with a selection marker.
      const match = line.trim().replace(/^[>*●]\s*/, '').match(/^([\w][\w.\/:+-]*)\s+-\s+(.+?)\s*$/);
      if (match) options.set(match[1], { value: match[1], label: match[2].replace(/\s+\((?:current|default)\)$/i, '') });
    }
  }
  return [...options.values()];
}

async function discoverClaude(): Promise<ProviderModelsDefinition> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), TIMEOUT_MS);
  const executable = resolveClaudeCodeExecutablePath(process.env.CLAUDE_CLI_PATH);
  // Query only the CLI control channel. No prompt is sent and no session is persisted.
  const instance = query({
    prompt: '',
    options: {
      persistSession: false,
      abortController,
      ...(executable ? { pathToClaudeCodeExecutable: executable } : {}),
    },
  });
  try {
    const models = await instance.supportedModels();
    const OPTIONS: ProviderModelOption[] = models.map((model) => ({
      value: model.value,
      label: model.displayName,
      description: model.description,
      ...(model.supportedEffortLevels?.length ? {
        effort: { values: model.supportedEffortLevels.map((value) => ({ value })) },
      } : {}),
    }));
    return { OPTIONS, DEFAULT: OPTIONS[0]?.value || '' };
  } finally {
    clearTimeout(timer);
    instance.close();
  }
}

/** Used by the provider-model service to refresh a real CLI catalog before persisting it. */
export async function discoverProviderModels(provider: LLMProvider): Promise<ProviderModelsDefinition> {
  try {
    if (provider === 'claude') return await discoverClaude();
    if (provider === 'codex') return await codexAppServer.listModels();
    const output = provider === 'cursor'
      ? await readCliOutput('cursor-agent', ['--list-models'])
      : await readCliOutput('opencode', ['models', '--refresh']);
    const OPTIONS = parseCliModelListing(provider, output);
    return { OPTIONS, DEFAULT: OPTIONS.find((option) => option.value === 'auto')?.value || OPTIONS[0]?.value || '' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error instanceof Error ? error.message : String(error), {
      code: 'MODEL_DISCOVERY_FAILED', statusCode: 502,
    });
  }
}
