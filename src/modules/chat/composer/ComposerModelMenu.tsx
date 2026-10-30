import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { ComposerReasoningControl } from '@/modules/chat/composer/ComposerReasoningControl';
import type { ProviderModelOption } from '@/shared/types';
import { DEFAULT_EFFORT_VALUE } from '@/shared/constants';
import { useComposerMenuAnchor } from '@/modules/chat/hooks/useComposerMenuAnchor';
import { ComposerMenuItem } from '@/modules/chat/composer/ComposerMenuPrimitives';

type EffortOption = NonNullable<ProviderModelOption['effort']>['values'][number];

type ComposerModelMenuProps = {
  effort: string;
  /** Effort values the active provider/model actually accepts; empty hides the section. */
  effortOptions: EffortOption[];
  onSelectEffort: (effort: string) => void;
  model: string;
  /** Model catalog for the active provider; empty hides the section. */
  modelOptions: ProviderModelOption[];
  onSelectModel: (model: string) => void;
  modelsLoading: boolean;
};

/**
 * Rendered by chat's ChatComposer as the popover for choosing the active
 * provider's model and reasoning effort for the next turn.
 */
function ComposerModelMenu({
  effort,
  effortOptions,
  onSelectEffort,
  model,
  modelOptions,
  onSelectModel,
  modelsLoading,
}: ComposerModelMenuProps) {
  const { t } = useTranslation('chat');
  // Keep the anchored model picker open while the user adjusts reasoning strength.
  const [isOpen, setIsOpen] = useState(false);
  // The popover opens on a compact overview (reasoning + current model) and only
  // shows the model list once the model row is clicked, mirroring Codex.
  const [view, setView] = useState<'overview' | 'models'>('overview');
  const close = useCallback(() => setIsOpen(false), []);
  const { triggerRef, menuRef, anchor, updateAnchor } = useComposerMenuAnchor(isOpen, close, 200);

  // Every reopen starts from the overview so the model list is never skipped.
  useEffect(() => {
    if (!isOpen) {
      setView('overview');
    }
  }, [isOpen]);

  const defaultEffortLabel = t('composer.effortDefault', { defaultValue: 'Default' });
  // Effort values come from providers as raw ids; translate the known ones and
  // fall back to the id so unknown levels still render.
  const effortText = useCallback(
    (value: string) =>
      value === DEFAULT_EFFORT_VALUE
        ? defaultEffortLabel
        : t(`composer.effort.${value}`, { defaultValue: value }),
    [defaultEffortLabel, t],
  );
  const resolvedEffortOptions = useMemo<EffortOption[]>(
    () => (effortOptions.length > 0 ? [{ value: DEFAULT_EFFORT_VALUE }, ...effortOptions] : []),
    [effortOptions],
  );
  const effortLabel = effortText(effort);
  const selectedModelOption = useMemo(
    () => modelOptions.find((option) => option.value === model) ?? null,
    [model, modelOptions],
  );
  const modelLabel = selectedModelOption?.label || model;

  const hasEffortSection = resolvedEffortOptions.length > 0;
  const hasModelSection = modelOptions.length > 0 || modelsLoading;
  if (!hasEffortSection && !hasModelSection) {
    return null;
  }

  const triggerLabel = hasModelSection ? modelLabel : effortLabel;
  const ariaLabel = t('composer.modelMenu', {
    defaultValue: 'Select model and reasoning effort',
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updateAnchor();
          setIsOpen((current) => !current);
        }}
        className="flex h-8 max-w-20 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:max-w-56"
        aria-haspopup={hasEffortSection ? 'dialog' : 'menu'}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span className="truncate">{triggerLabel}</span>
        {hasModelSection && hasEffortSection && effort !== DEFAULT_EFFORT_VALUE && (
          <span className="hidden shrink-0 text-muted-foreground sm:inline">· {effortLabel}</span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {isOpen && anchor && createPortal(
        <div
          ref={menuRef}
          role={view === 'overview' && hasEffortSection ? 'dialog' : 'menu'}
          aria-label={ariaLabel}
          className={`fixed z-[100] w-[200px] overflow-y-auto overscroll-contain rounded-[20px] border border-border bg-popover text-popover-foreground shadow-xl ${view === 'models' || !hasEffortSection ? 'p-2' : ''}`}
          style={{ right: anchor.right, bottom: anchor.bottom, maxHeight: anchor.maxHeight, maxWidth: anchor.maxWidth }}
        >
          {view === 'models' ? (
            <>
              <div className="flex items-center gap-1 px-1 pb-0.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setView('overview')}
                  aria-label={t('composer.backToReasoning', { defaultValue: 'Back to reasoning' })}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('composer.model', { defaultValue: 'Model' })}
                </span>
              </div>
              {modelOptions.length === 0 && modelsLoading && (
                <p className="px-2.5 py-1.5 text-sm text-muted-foreground">
                  {t('composer.loadingModels', { defaultValue: 'Loading models…' })}
                </p>
              )}
              {modelOptions.map((option) => (
                <ComposerMenuItem
                  key={option.value}
                  label={option.label || option.value}
                  className="text-xs"
                  isSelected={option.value === model}
                  onSelect={() => {
                    onSelectModel(option.value);
                    setIsOpen(false);
                  }}
                />
              ))}
            </>
          ) : hasEffortSection ? (
            <ComposerReasoningControl
              value={effort}
              options={resolvedEffortOptions}
              getLabel={effortText}
              label={ariaLabel}
              resetLabel={effortText(DEFAULT_EFFORT_VALUE)}
              onReset={() => onSelectEffort(DEFAULT_EFFORT_VALUE)}
              onChange={onSelectEffort}
              modelLabel={hasModelSection ? modelLabel : undefined}
              onOpenModels={() => setView('models')}
            />
          ) : hasModelSection ? (
            <ComposerMenuItem
              role="menuitem"
              label={modelLabel}
              isSelected={false}
              onSelect={() => setView('models')}
              trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              className="text-muted-foreground"
            />
          ) : null}
        </div>,
        document.body,
      )}
    </>
  );
}

/** Memoized: the composer re-renders on every keystroke and none of this menu's props change while typing. */
export default memo(ComposerModelMenu);
