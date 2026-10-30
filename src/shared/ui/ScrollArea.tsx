import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent, PointerEvent } from 'react';

import { cn } from '@/shared/utils';
import '@/shared/ui/ScrollArea.css';

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  /** Layout and size belong on className; scrolling styles belong here. */
  viewportClassName?: string;
  contentClassName?: string;
  always?: boolean;
  hideDelay?: number;
  minThumbSize?: number;
};

type AxisGeometry = { size: number; offset: number; travel: number; maxScroll: number };
type ScrollGeometry = { vertical: AxisGeometry; horizontal: AxisGeometry };
type ScrollAxis = keyof ScrollGeometry;

const EMPTY_AXIS: AxisGeometry = { size: 0, offset: 0, travel: 0, maxScroll: 0 };

function measureAxis(viewportSize: number, contentSize: number, scroll: number, trackSize: number, minSize: number): AxisGeometry {
  const maxScroll = Math.max(0, contentSize - viewportSize);
  if (maxScroll <= 1 || trackSize <= 0) return EMPTY_AXIS;
  const size = Math.min(trackSize, Math.max(minSize, trackSize * viewportSize / contentSize));
  const travel = trackSize - size;
  return { size, travel, maxScroll, offset: travel * Math.min(1, Math.max(0, scroll / maxScroll)) };
}

/** Used by sidebar, file-tree, and chat command/output panels for native scrolling with reusable, auto-hiding overlay scrollbars. The forwarded ref is the native viewport. */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea({
  className, viewportClassName, contentClassName, children, always = false,
  hideDelay = 800, minThumbSize = 20, onScroll, tabIndex = 0, ...props
}, ref) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ axis: ScrollAxis; pointerId: number; grab: number } | null>(null);
  const hoveringBar = useRef(false);
  const viewportId = useId();
  // Geometry must follow content, viewport and scroll changes to keep both thumbs accurate.
  const [geometry, setGeometry] = useState<ScrollGeometry>({ vertical: EMPTY_AXIS, horizontal: EMPTY_AXIS });
  // Activity controls overlay visibility independently of whether content overflows.
  const [active, setActive] = useState(false);
  useImperativeHandle(ref, () => viewportRef.current!, []);

  const update = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { clientHeight, clientWidth, scrollHeight, scrollWidth, scrollTop, scrollLeft } = viewport;
    const hasVertical = scrollHeight > clientHeight + 1;
    const hasHorizontal = scrollWidth > clientWidth + 1;
    const next = {
      vertical: measureAxis(clientHeight, scrollHeight, scrollTop, clientHeight - 4 - (hasHorizontal ? 10 : 0), minThumbSize),
      horizontal: measureAxis(clientWidth, scrollWidth, scrollLeft, clientWidth - 4 - (hasVertical ? 10 : 0), minThumbSize),
    };
    setGeometry((previous) =>
      (['vertical', 'horizontal'] as const).every((axis) =>
        (Object.keys(next[axis]) as (keyof AxisGeometry)[]).every((key) => next[axis][key] === previous[axis][key]))
        ? previous : next);
  }, [minThumbSize]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (drag.current || hoveringBar.current) return;
    hideTimer.current = setTimeout(() => setActive(false), Math.max(0, hideDelay));
  }, [hideDelay]);

  const show = useCallback(() => {
    setActive(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(viewport);
    observer?.observe(content);
    // Covers fixed-size content wrappers whose descendants change their overflow dimensions.
    const mutations = new MutationObserver(update);
    mutations.observe(content, { subtree: true, childList: true, characterData: true, attributes: true });
    window.addEventListener('resize', update);
    content.addEventListener('load', update, true);
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', update);
      content.removeEventListener('load', update, true);
    };
  }, [update]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const setScroll = (axis: ScrollAxis, value: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const clamped = Math.min(geometry[axis].maxScroll, Math.max(0, value));
    if (axis === 'vertical') viewport.scrollTop = clamped;
    else viewport.scrollLeft = clamped;
    update();
    show();
  };

  const pointerDown = (axis: ScrollAxis, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewportRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const bar = event.currentTarget;
    const rect = bar.getBoundingClientRect();
    const cursor = axis === 'vertical' ? event.clientY - rect.top : event.clientX - rect.left;
    const current = geometry[axis];
    const onThumb = (event.target as HTMLElement).hasAttribute('data-scroll-thumb');
    drag.current = { axis, pointerId: event.pointerId, grab: onThumb ? cursor - current.offset : current.size / 2 };
    bar.setPointerCapture(event.pointerId);
    if (!onThumb && current.travel > 0) setScroll(axis, (cursor - current.size / 2) / current.travel * current.maxScroll);
    show();
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cursor = currentDrag.axis === 'vertical' ? event.clientY - rect.top : event.clientX - rect.left;
    const current = geometry[currentDrag.axis];
    if (current.travel > 0) setScroll(currentDrag.axis, (cursor - currentDrag.grab) / current.travel * current.maxScroll);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    scheduleHide();
  };

  const keyDown = (axis: ScrollAxis, event: KeyboardEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const position = axis === 'vertical' ? viewport.scrollTop : viewport.scrollLeft;
    const page = axis === 'vertical' ? viewport.clientHeight : viewport.clientWidth;
    const backward = axis === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const forward = axis === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? geometry[axis].maxScroll
      : event.key === backward ? position - 40 : event.key === forward ? position + 40
        : event.key === 'PageUp' ? position - page : event.key === 'PageDown' ? position + page : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setScroll(axis, next);
  };

  return (
    <div {...props} className={cn('relative flex min-h-0 min-w-0 flex-col overflow-hidden', className)}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
        <div ref={viewportRef} id={viewportId} tabIndex={tabIndex}
          className={cn('scroll-area-viewport min-h-0 min-w-0 flex-1 overflow-auto rounded-[inherit]', viewportClassName)}
          onScroll={(event) => { update(); show(); onScroll?.(event); }}>
          <div ref={contentRef} className={cn('flow-root min-w-full', contentClassName)}>{children}</div>
        </div>
        {(['vertical', 'horizontal'] as const).map((axis) => {
          const current = geometry[axis];
          if (!current.size) return null;
          const vertical = axis === 'vertical';
          return (
            <div key={axis} role="scrollbar" aria-controls={viewportId} aria-orientation={axis}
              aria-valuemin={0} aria-valuemax={Math.round(current.maxScroll)}
              aria-valuenow={Math.round(current.travel ? current.offset / current.travel * current.maxScroll : 0)}
              tabIndex={0} data-visible={always || active} className={`scroll-area-bar scroll-area-bar-${axis}`}
              style={vertical ? { bottom: geometry.horizontal.size ? 12 : 2 } : { right: geometry.vertical.size ? 12 : 2 }}
              onPointerDown={(event) => pointerDown(axis, event)} onPointerMove={pointerMove}
              onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
              onPointerEnter={() => { hoveringBar.current = true; clearTimeout(hideTimer.current); }}
              onPointerLeave={() => { hoveringBar.current = false; scheduleHide(); }}
              onFocus={show} onBlur={scheduleHide} onKeyDown={(event) => keyDown(axis, event)}>
              <div data-scroll-thumb="" className="scroll-area-thumb"
                style={vertical ? { height: current.size, transform: `translateY(${current.offset}px)` }
                  : { width: current.size, transform: `translateX(${current.offset}px)` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
