import { expect, test } from 'vitest';

import { describeShellCommand } from '@/shared/utils';

test.each([
  ['cat src/main.ts', 'read', 'src/main.ts'],
  ['head -n 20 "a file.ts"', 'read', 'a file.ts'],
  ["sed -n '1,80p' src/main.ts", 'read', 'src/main.ts'],
  ['ls -la src', 'list', 'src'],
  ['rg --files src', 'list', 'src'],
  ["rg 'TODO' src", 'search', 'TODO · src'],
])('recognizes literal exploration commands: %s', (command, kind, summary) => {
  expect(describeShellCommand(command)).toEqual({ kind, summary });
});

test.each(['cat a > b', 'cat a; rm b', 'cat $(secret)', 'sed -i s/a/b/ file', 'find . -delete', 'npm test', 'rg --pre=script pattern file'])('keeps complex or mutating commands as runs: %s', (command) => {
  expect(describeShellCommand(command).kind).toBe('run');
});
