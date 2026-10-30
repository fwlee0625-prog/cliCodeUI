import { ChevronRight, RotateCcw, Zap } from 'lucide-react';

import '@/modules/chat/composer/ComposerReasoningControl.css';

type ComposerReasoningControlProps = {
  value: string;
  options: { value: string }[];
  getLabel: (value: string) => string;
  label: string;
  resetLabel: string;
  onReset: () => void;
  onChange: (value: string) => void;
  modelLabel?: string;
  onOpenModels: () => void;
};

/** Used by chat's ComposerModelMenu for its reasoning overview and discrete, draggable effort control. */
export function ComposerReasoningControl({
  value,
  options,
  getLabel,
  label,
  resetLabel,
  onReset,
  onChange,
  modelLabel,
  onOpenModels,
}: ComposerReasoningControlProps) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const position = (index: number) => options.length > 1 ? index / (options.length - 1) : 0;
  // Match the native range's thumb-center travel so dots, fill and thumb line up at both ends.
  const offset = (index: number) => `calc(0.875rem + (100% - 1.75rem) * ${position(index)})`;

  return (
    <div className="px-3 pb-3 pt-2">
      <div className="grid grid-cols-[1.75rem_1fr_1.75rem] items-center">
        <Zap className="h-4 w-4 justify-self-start text-muted-foreground" aria-hidden="true" />
        <span className="text-center text-lg font-medium leading-7 text-primary">{getLabel(value)}</span>
        <button type="button" onClick={onReset} aria-label={resetLabel} title={resetLabel}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {modelLabel && (
        <button type="button" onClick={onOpenModels}
          className="mx-auto flex max-w-full items-center justify-center gap-0.5 rounded px-1 text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="truncate">{modelLabel}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      )}

      <div className="relative mt-3 h-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border/40">
          <div className="absolute inset-y-0 left-0 rounded-l-full bg-primary" style={{ width: offset(activeIndex) }} />
          {options.map((option, index) => (
            <span key={option.value}
              className={`absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${index <= activeIndex ? 'bg-primary-foreground/40' : 'bg-muted-foreground/40'}`}
              style={{ left: offset(index) }} />
          ))}
        </div>
        <input type="range" min={0} max={Math.max(0, options.length - 1)} step={1} value={activeIndex}
          disabled={options.length < 2} aria-label={label} aria-valuetext={getLabel(value)}
          onChange={(event) => {
            const option = options[Number(event.currentTarget.value)];
            if (option) onChange(option.value);
          }}
          className="composer-reasoning-range absolute inset-0 m-0 h-8 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default" />
      </div>
    </div>
  );
}
