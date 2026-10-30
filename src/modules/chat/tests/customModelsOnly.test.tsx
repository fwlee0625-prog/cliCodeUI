import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import ModelLibraryPanel from '@/modules/chat/modals/ModelLibraryPanel';
import { i18n } from '@/modules/i18n';

const previousLanguage = i18n.language;
afterEach(async () => { await i18n.changeLanguage(previousLanguage); });

test('model library shows fetched time and refreshes the selected provider without the retired checkbox', async () => {
  await i18n.changeLanguage('zh-CN');
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<ModelLibraryPanel initialProvider="claude" providerModelCatalog={{ claude: {
    OPTIONS: [{ value: 'real-model', label: 'Real Model' }], DEFAULT: 'real-model', FETCHED_AT: '2026-10-29T00:00:00Z',
  } }} actions={{ create: vi.fn(), update: vi.fn(), remove: vi.fn(), refresh }} />);
  expect(screen.queryByText('仅使用我的模型')).toBeNull();
  expect(screen.getByText(/获取时间：/)).toBeTruthy();
  expect(screen.getByText('Real Model')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '刷新模型' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledWith('claude'));
});

test('failed refresh keeps existing rows and exposes the failure', async () => {
  await i18n.changeLanguage('zh-CN');
  render(<ModelLibraryPanel initialProvider="claude" providerModelCatalog={{ claude: {
    OPTIONS: [{ value: 'saved-model', label: 'Saved Model' }], DEFAULT: 'saved-model',
  } }} actions={{ create: vi.fn(), update: vi.fn(), remove: vi.fn(), refresh: vi.fn().mockRejectedValue(new Error('CLI offline')) }} />);
  fireEvent.click(screen.getByRole('button', { name: '刷新模型' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('CLI offline'));
  expect(screen.getByText('Saved Model')).toBeTruthy();
});
