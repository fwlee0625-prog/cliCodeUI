import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCliModelListing } from '@/modules/providers/services/provider-model-discovery.service.js';

test('OpenCode parser accepts complete qualified references, removes duplicates, and ignores logs', () => {
  assert.deepEqual(parseCliModelListing('opencode', 'Updating models...\nopenai/gpt-5\nanthropic/claude-sonnet\nopenai/gpt-5\n'), [
    { value: 'openai/gpt-5', label: 'openai/gpt-5' },
    { value: 'anthropic/claude-sonnet', label: 'anthropic/claude-sonnet' },
  ]);
});

test('Cursor parser handles ANSI, selection markers and default annotation without treating status text as models', () => {
  assert.deepEqual(parseCliModelListing('cursor', '\u001b[32mAvailable models\u001b[0m\n> auto - Auto (current)\ngpt-5 - GPT 5\nLogin required\n'), [
    { value: 'auto', label: 'Auto' }, { value: 'gpt-5', label: 'GPT 5' },
  ]);
});
