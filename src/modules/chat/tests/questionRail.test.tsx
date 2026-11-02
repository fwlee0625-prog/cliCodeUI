import assert from 'node:assert/strict';

import { expect, test, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { ChatMessage } from '@/shared/types';
import QuestionRail from '@/modules/chat/transcript/QuestionRail';

// The rail lists the transcript's user questions as jump markers. These tests
// pin the question filter, the hover preview, and the click-to-jump contract.

function userQuestion(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    type: 'user',
    content,
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ChatMessage;
}

/** Harness that renders the rail the way ChatInterface does. */
function RailHarness({ messages, onJumpToMessage }: {
  messages: ChatMessage[];
  onJumpToMessage: (message: ChatMessage) => void;
}) {
  return (
    <QuestionRail
      messages={messages}
      onJumpToMessage={onJumpToMessage}
    />
  );
}

const MESSAGES: ChatMessage[] = [
  userQuestion('怎么导出会话记录？', { timestamp: '2026-01-01T00:00:01.000Z' }),
  { type: 'assistant', content: '回答', timestamp: '2026-01-01T00:00:02.000Z' } as ChatMessage,
  userQuestion('第二个问题', { timestamp: '2026-01-01T00:00:03.000Z' }),
  // A local command the CLI answered itself is not a question.
  userQuestion('<command-name>/model</command-name>', { timestamp: '2026-01-01T00:00:04.000Z', isLocalCommand: true }),
  // An attachment-only user turn has nothing to preview.
  userQuestion('   ', { timestamp: '2026-01-01T00:00:05.000Z' }),
];

test('renders one marker per user question, skipping non-questions', () => {
  const { container } = render(<RailHarness messages={MESSAGES} onJumpToMessage={vi.fn()} />);
  const markers = container.querySelectorAll('[data-question-index]');
  assert.equal(markers.length, 2);
});

test('marker aria-label carries the question text', () => {
  render(<RailHarness messages={MESSAGES} onJumpToMessage={vi.fn()} />);
  expect(screen.getByRole('button', { name: '怎么导出会话记录？' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '第二个问题' })).toBeTruthy();
});

test('renders nothing when there are no user questions', () => {
  const { container } = render(
    <RailHarness
      messages={[{ type: 'assistant', content: 'hi', timestamp: '2026-01-01T00:00:00.000Z' } as ChatMessage]}
      onJumpToMessage={vi.fn()}
    />,
  );
  assert.equal(container.querySelector('[data-question-index]'), null);
});

test('hovering a marker opens a plain-text preview of the question', async () => {
  render(<RailHarness messages={MESSAGES} onJumpToMessage={vi.fn()} />);
  fireEvent.mouseEnter(screen.getByRole('button', { name: '怎么导出会话记录？' }));

  await waitFor(() => {
    expect(screen.getByRole('tooltip').textContent).toBe('怎么导出会话记录？');
  });
});

test('leaving the rail closes the preview', async () => {
  const { container } = render(<RailHarness messages={MESSAGES} onJumpToMessage={vi.fn()} />);
  const marker = screen.getByRole('button', { name: '第二个问题' });
  fireEvent.mouseEnter(marker);
  await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());

  // mouseleave does not bubble, so it is fired on the rail root itself.
  fireEvent.mouseLeave(container.querySelector('[data-testid="question-rail"]') as HTMLElement);
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
});

test('clicking a marker jumps to that message', () => {
  const onJumpToMessage = vi.fn();
  render(<RailHarness messages={MESSAGES} onJumpToMessage={onJumpToMessage} />);
  fireEvent.click(screen.getByRole('button', { name: '第二个问题' }));

  assert.equal(onJumpToMessage.mock.calls.length, 1);
  assert.equal((onJumpToMessage.mock.calls[0][0] as ChatMessage).content, '第二个问题');
});

test('clicking a marker closes an open preview', async () => {
  const onJumpToMessage = vi.fn();
  render(<RailHarness messages={MESSAGES} onJumpToMessage={onJumpToMessage} />);
  const marker = screen.getByRole('button', { name: '怎么导出会话记录？' });
  fireEvent.mouseEnter(marker);
  await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());

  fireEvent.click(marker);
  assert.equal(screen.queryByRole('tooltip'), null);
});

test('marker widths taper with distance from the hovered marker', async () => {
  const { container } = render(
    <RailHarness
      messages={[
        userQuestion('Q1', { timestamp: '2026-01-01T00:00:01.000Z' }),
        userQuestion('Q2', { timestamp: '2026-01-01T00:00:02.000Z' }),
        userQuestion('Q3', { timestamp: '2026-01-01T00:00:03.000Z' }),
        userQuestion('Q4', { timestamp: '2026-01-01T00:00:04.000Z' }),
      ]}
      onJumpToMessage={vi.fn()}
    />,
  );
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Q1' }));
  await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());

  // The hovered dash is widest; each neighbour, above and below, is a step shorter.
  const widths = Array.from(container.querySelectorAll<HTMLElement>('[data-question-index] span'))
    .map((span) => span.style.width);
  assert.deepEqual(widths, ['20px', '14px', '10px', '8px']);
});

test('dashes rest at the neutral width before any hover', () => {
  const { container } = render(<RailHarness messages={MESSAGES} onJumpToMessage={vi.fn()} />);
  const widths = Array.from(container.querySelectorAll<HTMLElement>('[data-question-index] span'))
    .map((span) => span.style.width);
  assert.deepEqual(widths, ['8px', '8px']);
});

test('dashes return to the neutral width after the pointer leaves', async () => {
  const { container } = render(<RailHarness messages={MESSAGES} onJumpToMessage={vi.fn()} />);
  const dashWidths = () => Array.from(container.querySelectorAll<HTMLElement>('[data-question-index] span'))
    .map((span) => span.style.width);

  fireEvent.mouseEnter(screen.getByRole('button', { name: '怎么导出会话记录？' }));
  await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());
  expect(dashWidths()[0]).toBe('20px');

  fireEvent.mouseLeave(container.querySelector('[data-testid="question-rail"]') as HTMLElement);
  await waitFor(() => assert.deepEqual(dashWidths(), ['8px', '8px']));
});
