import { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ScrollArea } from '@/shared/ui/ScrollArea';

let resize: () => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderArea(extra: { always?: boolean; onScroll?: () => void } = {}) {
  const ref = createRef<HTMLDivElement>();
  const result = render(<ScrollArea ref={ref} {...extra}><div>Contents</div></ScrollArea>);
  const viewport = ref.current!;
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 1000 },
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 300 },
  });
  act(() => resize());
  return { ...result, viewport };
}

test('native viewport ref and scroll callback work, and scrolling shows then hides the overlay', () => {
  const onScroll = vi.fn();
  const { getByRole, viewport } = renderArea({ onScroll });
  const bar = getByRole('scrollbar');
  expect(bar.getAttribute('data-visible')).toBe('false');
  viewport.scrollTop = 200;
  fireEvent.scroll(viewport);
  expect(onScroll).toHaveBeenCalledOnce();
  expect(bar.getAttribute('data-visible')).toBe('true');
  expect(bar.getAttribute('aria-valuenow')).toBe('200');
  expect(bar.getAttribute('aria-valuemax')).toBe('600');
  expect((bar.firstElementChild as HTMLElement).style.height).toBe('158.4px');
  act(() => vi.advanceTimersByTime(600));
  fireEvent.scroll(viewport);
  act(() => vi.advanceTimersByTime(600));
  expect(bar.getAttribute('data-visible')).toBe('true');
  act(() => vi.advanceTimersByTime(201));
  expect(bar.getAttribute('data-visible')).toBe('false');
});

test('resize recalculates overflow, both axes and minimum thumb size', () => {
  const { getAllByRole, queryByRole, viewport } = renderArea();
  Object.defineProperties(viewport, {
    scrollWidth: { configurable: true, value: 100000 },
    scrollHeight: { configurable: true, value: 100000 },
  });
  act(() => resize());
  const bars = getAllByRole('scrollbar');
  expect(bars).toHaveLength(2);
  expect((bars[0].firstElementChild as HTMLElement).style.height).toBe('20px');
  expect((bars[1].firstElementChild as HTMLElement).style.width).toBe('20px');
  Object.defineProperties(viewport, {
    scrollWidth: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 400 },
  });
  act(() => resize());
  expect(queryByRole('scrollbar')).toBeNull();
});

test('track click and captured thumb dragging move the native viewport and cancel cleanly', () => {
  const { getByRole, viewport, unmount } = renderArea();
  const bar = getByRole('scrollbar');
  bar.setPointerCapture = vi.fn();
  bar.hasPointerCapture = vi.fn(() => true);
  bar.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientY: 198 });
  expect(viewport.scrollTop).toBeCloseTo(300);
  fireEvent.pointerMove(bar, { pointerId: 1, clientY: 900 });
  expect(viewport.scrollTop).toBe(600);
  fireEvent.pointerCancel(bar, { pointerId: 1 });
  fireEvent.pointerMove(bar, { pointerId: 1, clientY: 0 });
  expect(viewport.scrollTop).toBe(600);
  expect(bar.releasePointerCapture).toHaveBeenCalledWith(1);

  fireEvent.pointerDown(bar.firstElementChild!, { button: 0, pointerId: 2, clientY: 250 });
  fireEvent.pointerMove(bar, { pointerId: 2, clientY: 230 });
  expect(viewport.scrollTop).toBeLessThan(600);
  unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test('keyboard controls scroll, and always keeps an overflowing bar visible', () => {
  const { getByRole, viewport } = renderArea({ always: true });
  const bar = getByRole('scrollbar');
  fireEvent.keyDown(bar, { key: 'End' });
  expect(viewport.scrollTop).toBe(600);
  fireEvent.keyDown(bar, { key: 'PageUp' });
  expect(viewport.scrollTop).toBe(200);
  fireEvent.keyDown(bar, { key: 'ArrowUp' });
  expect(viewport.scrollTop).toBe(160);
  fireEvent.keyDown(bar, { key: 'Home' });
  expect(viewport.scrollTop).toBe(0);
  act(() => vi.advanceTimersByTime(1000));
  expect(bar.getAttribute('data-visible')).toBe('true');
});
