import { useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from '@/shared/types';

type QuestionRailProps = {
  /** The session's loaded messages; the rail lists the user questions among them. */
  messages: ChatMessage[];
  /** Brings a message's transcript row into view; the chat module's revealMessage. */
  onJumpToMessage: (message: ChatMessage) => void;
};

/** Hover time before a question preview opens, so sweeping across markers does not strobe popovers. */
const PREVIEW_OPEN_DELAY_MS = 150;
/** Grace period after the pointer leaves the rail, so the marker → preview crossing keeps it open. */
const PREVIEW_CLOSE_DELAY_MS = 120;
/** Preview height cap; also the half-height used to keep the preview inside the window vertically. */
const PREVIEW_MAX_HEIGHT_PX = 240;
/** Longest collapsed snippet used as a marker's accessible name. */
const ARIA_SNIPPET_MAX_CHARS = 120;
/**
 * Marker width in px by distance from the hovered marker: the hovered dash is
 * widest and its neighbours taper shorter on both sides. Distances beyond the
 * list clamp to the last, narrowest width. Steps are deliberately steep so the
 * gradient reads at 2px dash height.
 */
const QUESTION_RAIL_WIDTH_BY_DISTANCE_PX = [20, 14, 10, 8, 6];
/** Dash width while no marker is hovered — the rail's resting state. */
const NEUTRAL_MARKER_WIDTH_PX = 8;

/** Collapses whitespace and truncates a question for use as a marker's aria-label. */
function toAccessibleName(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  return collapsed.length > ARIA_SNIPPET_MAX_CHARS
    ? `${collapsed.slice(0, ARIA_SNIPPET_MAX_CHARS)}…`
    : collapsed;
}

/**
 * Rendered by the chat module's ChatInterface as a fixed rail beside the
 * transcript: one dash per user question. Hovering a dash tapers the widths
 * around it and previews the question as plain text; moving away restores
 * every dash to the neutral width, and clicking jumps the transcript to that
 * message.
 */
function QuestionRail({ messages, onJumpToMessage }: QuestionRailProps) {
  const questions = useMemo(
    () => messages.filter((message) =>
      message.type === 'user'
      && typeof message.content === 'string'
      && message.content.trim().length > 0
      // Local-command rows (slash commands the CLI answers itself) are not questions.
      && !message.isLocalCommand
      && !message.isLocalCommandStdout
    ),
    [messages],
  );

  // The open question preview and its fixed-window anchor (the hovered
  // marker's edge); null while closed. Fixed positioning is what lets the
  // preview open to the right of a narrow, internally-scrolling rail without
  // being clipped by it.
  const [preview, setPreview] = useState<{ index: number; left: number; top: number } | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  // A session switch can shrink the list under an open preview index, so the
  // rendered preview is derived clamped rather than synced through an effect.
  const visiblePreview = preview && preview.index < questions.length ? preview : null;

  useEffect(() => () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const cancelOpen = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const schedulePreview = (index: number) => {
    cancelClose();
    cancelOpen();
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      const marker = railRef.current?.querySelector<HTMLElement>(`[data-question-index="${index}"]`);
      if (!marker) {
        return;
      }
      const rect = marker.getBoundingClientRect();
      const halfHeight = PREVIEW_MAX_HEIGHT_PX / 2;
      setPreview({
        index,
        left: rect.right + 6,
        top: Math.min(
          Math.max(rect.top + rect.height / 2, halfHeight + 8),
          window.innerHeight - halfHeight - 8,
        ),
      });
    }, PREVIEW_OPEN_DELAY_MS);
  };

  const schedulePreviewClose = () => {
    cancelOpen();
    if (closeTimerRef.current !== null) {
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setPreview(null);
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  const handleJump = (message: ChatMessage) => {
    cancelOpen();
    cancelClose();
    setPreview(null);
    onJumpToMessage(message);
  };

  if (questions.length === 0) {
    return null;
  }

  return (
    <div
      ref={railRef}
      data-testid="question-rail"
      className="pointer-events-none absolute inset-y-0 left-1.5 z-20 hidden w-7 lg:block"
      onMouseLeave={schedulePreviewClose}
    >
      {/* my-auto centers a short rail and lets a long one fill and scroll instead. */}
      <div className="flex h-full flex-col">
        <div className="pointer-events-auto my-auto flex max-h-full flex-col gap-0.5 overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {questions.map((question, index) => {
            // Only a hovered (or keyboard-focused) marker radiates the taper;
            // with the pointer away every dash rests at the neutral width.
            const focusIndex = visiblePreview ? visiblePreview.index : -1;
            const width = focusIndex >= 0
              ? QUESTION_RAIL_WIDTH_BY_DISTANCE_PX[
                Math.min(Math.abs(index - focusIndex), QUESTION_RAIL_WIDTH_BY_DISTANCE_PX.length - 1)
              ]
              : NEUTRAL_MARKER_WIDTH_PX;
            const content = String(question.content || '');
            return (
              <button
                key={`${String(question.timestamp ?? '')}-${index}`}
                type="button"
                data-question-index={index}
                aria-label={toAccessibleName(content)}
                className="flex cursor-pointer items-center px-0.5 py-1"
                onMouseEnter={() => schedulePreview(index)}
                onFocus={() => schedulePreview(index)}
                onBlur={schedulePreviewClose}
                onClick={() => handleJump(question)}
              >
                <span
                  style={{ width }}
                  className={`h-[2px] rounded-full transition-all duration-200 ${
                    focusIndex === index
                      ? 'bg-gray-800 dark:bg-gray-100'
                      : 'bg-gray-300 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {visiblePreview && (
        <div
          role="tooltip"
          style={{ left: visiblePreview.left, top: visiblePreview.top, maxHeight: PREVIEW_MAX_HEIGHT_PX }}
          className="fixed z-30 w-72 max-w-[min(20rem,calc(100vw-3rem))] -translate-y-1/2 overflow-y-auto rounded-xl border border-border/60 bg-popover p-3 shadow-lg"
          onMouseEnter={cancelClose}
          onMouseLeave={schedulePreviewClose}
        >
          {/* The question as plain text: no markdown, wrapping at the preview edge. */}
          <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">
            {String(questions[visiblePreview.index]?.content ?? '')}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionRail;
