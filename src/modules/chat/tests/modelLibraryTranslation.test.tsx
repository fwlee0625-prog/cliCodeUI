import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { i18n } from '@/modules/i18n';
import ModelLibraryPanel from '@/modules/chat/modals/ModelLibraryPanel';
import type { ProviderModelActions, ProviderModelsDefinition } from '@/shared/types';

const previousLanguage = i18n.language;
afterEach(async () => { await i18n.changeLanguage(previousLanguage); });

const catalog: ProviderModelsDefinition = {
  OPTIONS: [
    { value: 'default', label: 'Default (recommended)' },
    { value: 'best', label: 'Best available' },
    { value: 'custom-id', label: 'My Model', isCustom: true, recordId: 1 },
  ],
  DEFAULT: 'default',
  EFFORT_LEVELS: [],
};

const renderLibrary = (options = catalog) => {
  const actions: ProviderModelActions = {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  render(<ModelLibraryPanel initialProvider="claude" providerModelCatalog={{ claude: options }} actions={actions} />);
  return actions;
};

test.each([
  ['zh-CN', '模型名称', '模型 ID', '添加模型', '我的模型', '内置模型', '默认（推荐）', '最佳可用模型'],
  ['en', 'Model name', 'Model ID', 'Add model', 'Your models', 'Built-in models', 'Default (recommended)', 'Best available'],
])('the model settings form and built-in aliases render in %s', async (language, name, id, add, yours, builtIn, defaultModel, best) => {
  await i18n.changeLanguage(language);
  const actions = renderLibrary();
  expect(screen.queryByText('Model library')).toBeNull();
  expect(screen.getByText(yours)).toBeTruthy();
  expect(screen.getByText(builtIn)).toBeTruthy();
  expect(screen.getByText(defaultModel)).toBeTruthy();
  expect(screen.getByText(best)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(name), { target: { value: 'New Model' } });
  fireEvent.change(screen.getByLabelText(id), { target: { value: 'new-model' } });
  fireEvent.click(screen.getByRole('button', { name: add }));
  await waitFor(() => expect(actions.create).toHaveBeenCalledWith('claude', { model: 'New Model', id: 'new-model' }));
  expect(await screen.findByText(language === 'en' ? 'New Model was added.' : '已添加 New Model。')).toBeTruthy();
});

test('Chinese validation, editing, and deletion controls use localized text', async () => {
  await i18n.changeLanguage('zh-CN');
  const actions = renderLibrary();
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText('模型 ID'), { target: { value: 'bad id' } });
  fireEvent.click(screen.getByRole('button', { name: '添加模型' }));
  expect(screen.getByRole('alert').textContent).toBe('模型 ID 不能包含空格。');
  expect(actions.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '编辑 My Model' }));
  expect(screen.getByText('编辑自定义模型')).toBeTruthy();
  expect(screen.getByRole('button', { name: '保存修改' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '删除 My Model' }));
  expect(screen.getByText('确定从所有模型选择器中删除此模型？')).toBeTruthy();
  expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(await screen.findByText('已删除 My Model。')).toBeTruthy();
});

test('the empty model list renders in Chinese', async () => {
  await i18n.changeLanguage('zh-CN');
  renderLibrary({ ...catalog, OPTIONS: [] });
  expect(screen.getByText('暂无自定义模型')).toBeTruthy();
  expect(screen.getByText('通过左侧表单添加模型后，即可在所有模型选择器中使用。')).toBeTruthy();
});
