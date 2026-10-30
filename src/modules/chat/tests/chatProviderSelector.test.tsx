import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import ChatProviderSelector from '@/modules/chat/ChatProviderSelector';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('@/shared/ui', () => ({ LLMProviderLogo: () => null }));

afterEach(() => document.querySelector('[data-header-target]')?.remove());
function headerTarget() {
  const target = document.createElement('div');
  target.dataset.headerTarget = '';
  document.body.append(target);
  return target;
}

test('the header offers providers only and sends the selected provider to chat', () => {
  const onSelect = vi.fn();
  const target = headerTarget();
  render(<ChatProviderSelector target={target} provider="claude" canSwitch onSelect={onSelect} />);
  const picker = screen.getByRole('combobox', { name: 'Choose AI provider' });
  expect(target.contains(picker)).toBe(true);
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Claude', 'Codex', 'Cursor', 'OpenCode']);
  fireEvent.change(picker, { target: { value: 'codex' } });
  expect(onSelect).toHaveBeenCalledWith('codex');
});

test('an established conversation has no provider picker, including after a new chat becomes established', () => {
  const target = headerTarget();
  const onSelect = vi.fn();
  const { rerender } = render(<ChatProviderSelector target={target} provider="codex" canSwitch onSelect={onSelect} />);
  expect(screen.getByRole('combobox')).toBeTruthy();
  rerender(<ChatProviderSelector target={target} provider="codex" canSwitch={false} onSelect={onSelect} />);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(target.childElementCount).toBe(0);
});
