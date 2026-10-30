import assert from 'node:assert/strict';
import { fireEvent, render } from '@testing-library/react';
import { test, vi } from 'vitest';

import { ComposerReasoningControl } from '@/modules/chat/composer/ComposerReasoningControl';

test('the slider maps discrete positions to provider effort values and announces the selected label', () => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const onOpenModels = vi.fn();
  const { getByRole } = render(
    <ComposerReasoningControl
      value="medium" options={[{ value: 'default' }, { value: 'low' }, { value: 'medium' }, { value: 'high' }]}
      getLabel={(value) => `Effort: ${value}`} label="Reasoning strength"
      resetLabel="Reset effort" onReset={onReset} onChange={onChange}
      modelLabel="GPT-6.1 Sol" onOpenModels={onOpenModels}
    />,
  );
  const slider = getByRole('slider', { name: 'Reasoning strength' });
  assert.equal(slider.getAttribute('aria-valuetext'), 'Effort: medium');
  assert.equal((slider as HTMLInputElement).value, '2');
  fireEvent.change(slider, { target: { value: '3' } });
  assert.deepEqual(onChange.mock.calls, [['high']]);
  fireEvent.click(getByRole('button', { name: 'Reset effort' }));
  assert.equal(onReset.mock.calls.length, 1);
  fireEvent.click(getByRole('button', { name: 'GPT-6.1 Sol' }));
  assert.equal(onOpenModels.mock.calls.length, 1);
});

test('a single available effort value disables sliding and works without a model selector', () => {
  const { getByRole, queryByRole } = render(
    <ComposerReasoningControl value="low" options={[{ value: 'low' }]}
      getLabel={(value) => value} label="Reasoning strength" resetLabel="Reset effort"
      onReset={() => {}} onChange={() => {}} onOpenModels={() => {}} />,
  );
  assert.equal((getByRole('slider') as HTMLInputElement).disabled, true);
  assert.equal(queryByRole('button', { name: 'GPT-6.1 Sol' }), null);
});
