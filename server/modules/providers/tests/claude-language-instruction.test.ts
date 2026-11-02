import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLanguageInstruction } from '../list/claude/claude-runtime.provider.js';

/**
 * The gray line under a tool row ("Check whether daheng dir is indexed…") is
 * the model-written tool-call `description`, not a UI string — locale files
 * cannot translate it. The steer has to happen on the run: the interface
 * language rides into the SDK's system-prompt `append`, and the model writes
 * its descriptions in that language. These tests pin the instruction text and
 * the languages that must stay untouched.
 */

test('the user language becomes an append directive naming the language', () => {
  const instruction = buildLanguageInstruction('zh-CN');

  assert.ok(instruction, 'a supported non-English language yields an instruction');
  assert.match(instruction, /Simplified Chinese \(简体中文\)/);
  assert.match(instruction, /"description" field of tool calls/);
  assert.match(instruction, /Keep code, file paths, shell commands, identifiers/);
});

test('english and unknown languages leave the preset prompt untouched', () => {
  assert.equal(buildLanguageInstruction('en'), undefined);
  assert.equal(buildLanguageInstruction('xx-YY'), undefined);
});

test('a missing or malformed language option yields no instruction', () => {
  assert.equal(buildLanguageInstruction(undefined), undefined);
  assert.equal(buildLanguageInstruction(42), undefined);
  assert.equal(buildLanguageInstruction(null), undefined);
});
