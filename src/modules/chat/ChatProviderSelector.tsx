import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LLMProviderLogo } from '@/shared/ui';
import type { LLMProvider } from '@/shared/types';

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'opencode', label: 'OpenCode' },
];

type ChatProviderSelectorProps = {
  target: HTMLElement | null;
  provider: LLMProvider;
  canSwitch: boolean;
  onSelect: (provider: LLMProvider) => void;
};

/** Used by ChatInterface to place a provider-only picker in the workspace header for new conversations. */
export default function ChatProviderSelector({ target, provider, canSwitch, onSelect }: ChatProviderSelectorProps) {
  const { t } = useTranslation('chat');
  if (!target || !canSwitch) return null;

  return createPortal(
    <label className="relative flex h-8 items-center gap-1.5 rounded-md border border-border/40 bg-muted/50 px-2 text-xs text-muted-foreground shadow-inner shadow-black/[0.025] transition-colors hover:bg-accent/60 dark:shadow-black/10">
      <LLMProviderLogo provider={provider} className="pointer-events-none h-3.5 w-3.5 shrink-0" />
      <select
        aria-label={t('providerSelection.chooseProvider', { defaultValue: 'Choose AI provider' })}
        value={provider}
        style={{ backgroundImage: 'none' }}
        onChange={(event) => {
          const next = PROVIDERS.find((item) => item.id === event.target.value);
          if (next) onSelect(next.id);
        }}
        className="h-full cursor-pointer appearance-none bg-transparent pr-4 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 h-3 w-3" />
    </label>,
    target,
  );
}
