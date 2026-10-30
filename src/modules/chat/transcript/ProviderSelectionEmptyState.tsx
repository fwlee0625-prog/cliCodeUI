import type { Dispatch, SetStateAction } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { ProjectSession, LLMProvider } from '@/shared/types';
import { NextTaskBanner } from '@/modules/task-master';

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
const PROVIDER_NAMES: Record<LLMProvider, string> = { claude: 'Claude', codex: 'Codex', cursor: 'Cursor', opencode: 'OpenCode' };

type ProviderSelectionEmptyStateProps = {
  selectedSession: ProjectSession | null;
  currentSessionId: string | null;
  provider: LLMProvider;
  providerModels: Record<LLMProvider, string>;
  tasksEnabled: boolean;
  isTaskMasterInstalled: boolean | null;
  onShowAllTasks?: (() => void) | null;
  setInput: Dispatch<SetStateAction<string>>;
};

/** Used by ChatMessagesPane for new-chat guidance; provider/model controls live in the header and composer. */
export default function ProviderSelectionEmptyState({ selectedSession, currentSessionId, provider, providerModels,
  tasksEnabled, isTaskMasterInstalled, onShowAllTasks, setInput }: ProviderSelectionEmptyStateProps) {
  const { t } = useTranslation('chat');
  const nextTaskPrompt = t('tasks.nextTaskPrompt', { defaultValue: 'Start the next task' });
  if (!selectedSession && !currentSessionId) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-[34.25rem] text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {t('providerSelection.startWithProvider', { provider: PROVIDER_NAMES[provider], defaultValue: 'Start a conversation with {{provider}}' })}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground/70">
            {t(`providerSelection.readyPrompt.${provider}`, { model: providerModels[provider] })}
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <Trans ns="chat" i18nKey="providerSelection.pressToSearch" values={{ shortcut: MOD_KEY === '⌘' ? '⌘K' : 'Ctrl+K' }}
              components={{ kbd: <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]" /> }} />
          </p>
          {tasksEnabled && isTaskMasterInstalled && <div className="mt-5"><NextTaskBanner onStartTask={() => setInput(nextTaskPrompt)} onShowAllTasks={onShowAllTasks} /></div>}
        </div>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-[34.25rem] px-6 text-center">
          <p className="mb-1.5 text-lg font-semibold text-foreground">
            {t("session.continue.title")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("session.continue.description")}
          </p>

          {tasksEnabled && isTaskMasterInstalled && (
            <div className="mt-5">
              <NextTaskBanner
                onStartTask={() => setInput(nextTaskPrompt)}
                onShowAllTasks={onShowAllTasks}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
