import { memo, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type TokenUsageSummaryProps = {
  usage: Record<string, unknown> | null;
  onClick?: () => void;
};

const formatTokenCount = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

const readUsageNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Rendered by ChatComposer as a compact gauge with usage details above it on hover or focus.
 */
function TokenUsageSummary({ usage, onClick }: TokenUsageSummaryProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  // A viewport anchor keeps the hover card above the icon without being clipped by the input.
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const showUsage = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)),
      bottom: window.innerHeight - rect.top + 8,
    });
  };
  const breakdown =
    usage?.breakdown && typeof usage.breakdown === 'object'
      ? usage.breakdown as Record<string, unknown>
      : null;
  const inputTokens = readUsageNumber(usage?.inputTokens ?? breakdown?.input);
  const outputTokens = readUsageNumber(usage?.outputTokens ?? breakdown?.output);
  const usedTokens = readUsageNumber(usage?.used) || inputTokens + outputTokens;

  const contextWindow = readUsageNumber(usage?.total);
  const rows = [
    { label: t('chat:cost.totalTokens'), value: formatTokenCount(usedTokens) },
    { label: t('chat:cost.inputTokens'), value: formatTokenCount(inputTokens) },
    { label: t('chat:cost.outputTokens'), value: formatTokenCount(outputTokens) },
    { label: t('chat:cost.contextWindow'), value: contextWindow > 0 ? formatTokenCount(contextWindow) : t('chat:cost.unavailable') },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onClick}
        onMouseEnter={showUsage}
        onMouseLeave={() => setAnchor(null)}
        onFocus={showUsage}
        onBlur={() => setAnchor(null)}
        onKeyDown={(event) => { if (event.key === 'Escape') setAnchor(null); }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('chat:misc.showTokenUsage')}
        aria-describedby={anchor ? tooltipId : undefined}
      >
        <Gauge className="h-4 w-4" aria-hidden="true" />
      </button>
      {anchor && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[9999] w-56 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
          style={anchor}
        >
          <dl className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Memoized so typing in the composer does not re-render unchanged usage. */
export default memo(TokenUsageSummary);
