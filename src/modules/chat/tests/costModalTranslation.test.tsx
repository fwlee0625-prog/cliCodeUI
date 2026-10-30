import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, test, vi } from 'vitest';

import CommandResultModal from '@/modules/chat/modals/CommandResultModal';
import { i18n } from '@/modules/i18n';
import type { CostCommandData } from '@/shared/types';

const renderCost = (data: CostCommandData) => render(
  <I18nextProvider i18n={i18n}>
    <CommandResultModal
      payload={{ kind: 'cost', data }}
      onClose={vi.fn()}
    />
  </I18nextProvider>,
);

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('Simplified Chinese token usage modal', () => {
  test('shows translated labels when a breakdown is unavailable', async () => {
    await i18n.changeLanguage('zh-CN');
    renderCost({ tokenUsage: { used: 0, total: 200000 }, provider: 'claude', model: 'fable' });

    for (const text of ['会话用量统计', '本次会话的输入、输出及 Token 总数。', '已使用的 Token 总数', '用量明细', '暂无数据', '上下文窗口', '提供商', '模型', '按 Esc 关闭窗口。']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.getByText('fable')).toBeTruthy();
  });

  test('translates input and output rows and unknown values', async () => {
    await i18n.changeLanguage('zh-CN');
    renderCost({ tokenBreakdown: { input: 12, output: 5 } });
    expect(screen.getByText('输入 Token')).toBeTruthy();
    expect(screen.getByText('输出 Token')).toBeTruthy();
    expect(screen.getAllByText('未知')).toHaveLength(2);
  });
});


describe('token usage formatting', () => {
  test('uses k and M at their thresholds for every usage row', () => {
    renderCost({
      tokenUsage: { used: 156476, total: 1_000_000 },
      tokenBreakdown: { input: 155913, output: 563 },
    });

    for (const value of ['156.476k', '155.913k', '563', '1M']) {
      expect(screen.getByText(value)).toBeTruthy();
    }
  });

  test.each([
    [999, '999'],
    [1000, '1k'],
    [999999, '999.999k'],
    [1000000, '1M'],
    [1500000, '1.5M'],
  ])('formats %i as %s', (used, expected) => {
    renderCost({ tokenUsage: { used } });
    expect(screen.getByText(expected)).toBeTruthy();
  });
});
