import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { ToolActivityDisplay } from '@/modules/chat/tools/ToolActivityDisplay';
import { ToolRenderer } from '@/modules/chat/tools/ToolRenderer';
import { shouldHideToolResult } from '@/modules/chat/tools/configs/toolConfigs';
import { i18n } from '@/modules/i18n';
import { groupConsecutiveTools, isToolGroupItem } from '@/modules/chat/utils/toolGrouping';
import type { ChatMessage } from '@/shared/types';

const previousLanguage = i18n.language;
afterEach(async () => { await i18n.changeLanguage(previousLanguage); });

test('a named browser action folds its script and result together', async () => {
  await i18n.changeLanguage('zh-CN');
  render(<ToolActivityDisplay label="浏览器操作" title="检查视频播放" code="await tab.getScreenshot()" output="播放器正常" />);
  expect(screen.getByText('播放器正常').closest('[data-state]')?.getAttribute('data-state')).toBe('closed');
  const trigger = screen.getByRole('button', { name: /检查视频播放/ });
  fireEvent.click(trigger);
  expect(screen.getByText('操作')).toBeTruthy();
  expect(screen.getByText('输出')).toBeTruthy();
  expect(screen.getByText('await tab.getScreenshot()')).toBeTruthy();
  expect(screen.getByText('播放器正常')).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(trigger);
  expect(screen.getByText('播放器正常').closest('[data-state]')?.getAttribute('data-state')).toBe('closed');
});

test('consecutive browser actions form their own group; a single action remains individual', () => {
  const first: ChatMessage = { id: 'browser-1', timestamp: '2026-10-29T12:00:00Z', type: 'assistant', isToolUse: true, toolName: 'Browser', toolInput: { title: '打开页面' } };
  const second = { ...first, id: 'browser-2', toolInput: { title: '检查播放' } };
  const grouped = groupConsecutiveTools([first, second]);
  expect(grouped).toHaveLength(1);
  expect(isToolGroupItem(grouped[0])).toBe(true);
  expect(isToolGroupItem(grouped[0]) && grouped[0].toolName).toBe('Browser');
  expect(groupConsecutiveTools([first])).toEqual([first]);
});


test.each([
  ['text(ALL_TOOLS.filter(x=>x.name.includes("local_server_manage")));', '查找可用工具'],
  ['await tools.unknown_wrapper({ value: true });', '运行脚本'],
])('sandbox script %s pairs its output in a single closed activity with a meaningful title', async (code, title) => {
  await i18n.changeLanguage('zh-CN');
  const result = { content: 'result payload', isError: false };
  render(<ToolRenderer toolName="exec" toolInput={code} toolResult={result} mode="input" />);
  const trigger = screen.getByRole('button', { name: title });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByText('Sandbox script')).toBeNull();
  expect(shouldHideToolResult('exec', result)).toBe(true);
  expect(shouldHideToolResult('exec', { ...result, isError: true })).toBe(true);
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText(code)).toBeTruthy();
  expect(screen.getByText('result payload')).toBeTruthy();
});


test('unmapped MCP calls fold input and result into one named call, including errors', async () => {
  await i18n.changeLanguage('en');
  const toolName = 'mcp__example__inspect';
  const result = { content: 'Inspection failed', isError: true };
  render(<ToolRenderer toolName={toolName} toolInput={{ path: '/demo' }} toolResult={result} mode="input" />);
  const trigger = screen.getByRole('button', { name: /Called.*inspect/ });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(shouldHideToolResult(toolName, result)).toBe(true);
  fireEvent.click(trigger);
  expect(screen.getByText('Inspection failed')).toBeTruthy();
});
