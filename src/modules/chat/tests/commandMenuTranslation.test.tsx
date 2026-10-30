import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, test, vi } from 'vitest';

import CommandMenu from '@/modules/chat/composer/CommandMenu';
import { i18n } from '@/modules/i18n';

const previousLanguage = i18n.language;
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage(previousLanguage);
});

test('translates known built-in descriptions while preserving custom and unknown commands', async () => {
  await i18n.changeLanguage('zh-CN');
  const commands = [
    ...['help', 'cost', 'memory', 'config', 'status'].map(name => ({
      name: `/${name}`, namespace: 'builtin', description: 'English description', metadata: { type: 'builtin' },
    })),
    { name: '/help', namespace: 'project', description: 'My custom description' },
    { name: '/other', namespace: 'builtin', description: 'Unknown built-in description' },
  ];
  render(<I18nextProvider i18n={i18n}><CommandMenu isOpen commands={commands} frequentCommands={[commands[0]]} onClose={vi.fn()} /></I18nextProvider>);

  for (const description of ['显示 Claude Code 帮助文档', '显示 Token 用量信息', '打开 CLAUDE.md 记忆文件进行编辑', '打开设置和配置', '显示系统状态和版本信息', 'My custom description', 'Unknown built-in description']) {
    expect(screen.getByText(description)).toBeTruthy();
  }
  expect(screen.getAllByText('内置')).toHaveLength(5);
  expect(screen.getByText('显示 Token 用量信息').getAttribute('title')).toBe('显示 Token 用量信息');
});

test('built-in descriptions follow the selected language', async () => {
  await i18n.changeLanguage('en');
  render(<I18nextProvider i18n={i18n}><CommandMenu isOpen commands={[{ name: '/cost', namespace: 'builtin', description: 'Display token usage information' }]} onClose={vi.fn()} /></I18nextProvider>);
  expect(screen.getByText('Display token usage information')).toBeTruthy();
});
