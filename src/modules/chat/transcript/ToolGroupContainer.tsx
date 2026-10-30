import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, CircleDashed, Search, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { getToolActivityTranslationKey } from '@/shared/utils';
import type { ChatMessage, ClaudePermissionSuggestion, PermissionGrantResult, LLMProvider,DiffLine,DiffStats,Project,ToolGroupItem } from '@/shared/types';
import { getToolConfig } from '@/modules/chat/tools';
import MessageComponent from '@/modules/chat/transcript/MessageComponent';
import { useIsExportingTranscript } from '@/modules/chat/context/TranscriptRenderContext';
import { DiffStatsBadge } from '@/modules/chat/tools/DiffStatsBadge';
import { parseToolPayload, summarizeDiff } from '@/modules/chat/utils/messageTransforms';

type ToolGroupContainerProps = {
  group: ToolGroupItem;
  prevMessage: ChatMessage | null;
  createDiff: (oldStr: string, newStr: string) => DiffLine[];
  getMessageKey: (message: ChatMessage) => string;
  onFileOpen?: (filePath: string, diffInfo?: unknown) => void;
  onShowSettings?: () => void;
  onGrantToolPermission?: (suggestion: ClaudePermissionSuggestion) => PermissionGrantResult | null | undefined;
  showRawParameters?: boolean;
  showThinking?: boolean;
  selectedProject?: Project | null;
  provider: LLMProvider | string;
};

/**
 * Totals the lines a run of file edits added and removed.
 *
 * A collapsed group hides every individual diff behind `x4`, so without this
 * the one thing the row could usefully say about a batch of edits — how big it
 * is — is the one thing it did not. Returns null for groups of tools that do
 * not render a diff at all.
 */
function useGroupDiffStats(
  toolName: string,
  messages: ChatMessage[],
  createDiff: (oldStr: string, newStr: string) => DiffLine[],
): DiffStats | null {
  return useMemo(() => {
    const config = getToolConfig(toolName).input;
    if (config.contentType !== 'diff' || !config.getContentProps) {
      return null;
    }

    let added = 0;
    let removed = 0;
    let counted = 0;

    for (const message of messages) {
      const contentProps = config.getContentProps(parseToolPayload(message.toolInput) ?? {});
      if (typeof contentProps?.oldContent !== 'string' || typeof contentProps?.newContent !== 'string') {
        continue;
      }

      const stats = summarizeDiff(createDiff(contentProps.oldContent, contentProps.newContent));
      added += stats.added;
      removed += stats.removed;
      counted += 1;
    }

    return counted > 0 ? { added, removed } : null;
  }, [createDiff, messages, toolName]);
}

function getToolGroupIcon(icon: string | undefined, toolName: string): string {
  if (icon === 'terminal') {
    return '$';
  }

  return icon || toolName.slice(0, 1).toUpperCase();
}

// Symbol glyphs (◌ ⌕ ◎) come from fallback fonts whose metrics sit them low in
// the 16px icon chip, so they render as SVGs that flexbox centers exactly;
// '$' and letter icons are plain Latin glyphs that center fine as text.
const GROUP_ICON_SVGS: Record<string, LucideIcon> = {
  '◌': CircleDashed,
  '⌕': Search,
  '◎': Target,
};

/**
 * Rendered by chat's ChatMessagesPane to collapse a run of consecutive tool
 * calls into a single expandable group in the transcript.
 */
function ToolGroupContainer({
  group,
  prevMessage,
  createDiff,
  getMessageKey,
  onFileOpen,
  onShowSettings,
  onGrantToolPermission,
  showRawParameters,
  showThinking,
  selectedProject,
  provider,
}: ToolGroupContainerProps) {
  const { t } = useTranslation();
  const isExporting = useIsExportingTranscript();
  // Collapsed on screen, always open in an export: the whole point of the
  // group row is to hide detail the reader can ask for, and an exported file
  // has no way to ask.
  const [isExpanded, setIsExpanded] = useState(false);
  const showChildren = isExpanded || isExporting;
  const config = getToolConfig(group.toolName).input;
  const activityKey = getToolActivityTranslationKey(group.toolName);
  const active = group.messages.some((message) => message.toolStatus === 'in_progress' || (!message.toolResult && !['completed', 'failed', 'stopped'].includes(message.toolStatus || '')));
  const failures = group.messages.filter((message) => message.toolResult?.isError).length;
  const label = group.toolName === 'Activity'
    ? t(active ? 'chat:toolActivity.activityRunning' : 'chat:toolActivity.activityCompleted')
    : group.toolName === 'Exploration'
    ? t(active ? 'chat:toolActivity.exploring' : 'chat:toolActivity.explored')
    : group.toolName === 'Browser'
      ? t(active ? 'chat:toolActivity.usingComputer' : 'chat:toolActivity.usedComputer')
      : activityKey ? t(activityKey) : config.label || group.toolName;
  const mixedSummary = group.toolName === 'Activity'
    ? Object.entries(group.activityCounts || {}).map(([category, count]) => {
      const summaryKey = category === 'Bash' ? 'commandsSummary'
        : category === 'Browser' ? 'computerSummary'
          : category === 'Exploration' ? 'explorationSummary'
            : ['Edit', 'Write', 'ApplyPatch'].includes(category) ? 'filesSummary'
              : category === 'exec' ? 'scriptsSummary' : 'toolsSummary';
      return t(`chat:toolActivity.${summaryKey}`, { count, tool: category });
    }).join(' · ')
    : null;
  const borderClass = config.colorScheme?.border || 'border-border';
  const iconClass = config.colorScheme?.icon || 'text-muted-foreground';
  const icon = getToolGroupIcon(config.icon, group.toolName);
  const IconSvg = config.icon ? GROUP_ICON_SVGS[config.icon] : undefined;

  const groupDiffStats = useGroupDiffStats(group.toolName, group.messages, createDiff);

  // Keys only have to be unique among this group's own rows, so repeats of the
  // same key are disambiguated here by occurrence.
  const messageKeys = useMemo(() => {
    const occurrences = new Map<string, number>();
    return group.messages.map((message) => {
      const key = getMessageKey(message);
      const seen = occurrences.get(key) ?? 0;
      occurrences.set(key, seen + 1);
      return seen === 0 ? key : `${key}__${seen}`;
    });
  }, [group.messages, getMessageKey]);

  return (
    <div className="chat-message tool px-3 sm:px-0" data-message-timestamp={group.timestamp || undefined}>
      <button
        type="button"
        className={`group flex w-full items-center gap-1.5 border-l-2 ${borderClass} rounded-r-md bg-muted/25 px-2 py-1 text-left transition-colors hover:bg-muted/40 dark:bg-muted/10 dark:hover:bg-muted/20`}
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className={`${iconClass} flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-background/80 text-xs font-medium`}>
          {IconSvg ? <IconSvg className="h-3 w-3" aria-hidden /> : icon}
        </span>
        <span className="min-w-0 flex-shrink-0 text-xs font-medium text-foreground">{label}</span>
        {mixedSummary ? (
          <span className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground">{mixedSummary}</span>
        ) : (
          <span className="flex-shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t('chat:toolActivity.actionCount', { count: group.messages.length })}
          </span>
        )}
        {failures > 0 && <span className="text-[10px] text-destructive">{t('chat:toolActivity.failedCount', { count: failures })}</span>}
        {groupDiffStats && <DiffStatsBadge stats={groupDiffStats} className="ml-auto pl-2" />}
      </button>

      {showChildren && (
        <div className="mt-2 space-y-3 sm:space-y-4">
          {group.messages.map((message, index) => (
            <MessageComponent
              key={messageKeys[index]}
              message={message}
              prevMessage={index > 0 ? group.messages[index - 1] : prevMessage}
              createDiff={createDiff}
              onFileOpen={onFileOpen}
              onShowSettings={onShowSettings}
              onGrantToolPermission={onGrantToolPermission}
              showRawParameters={showRawParameters}
              showThinking={showThinking}
              selectedProject={selectedProject}
              provider={provider}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Memoized for the transcript re-renders that are not message changes — the
 * pane re-renders when isProcessing or the activity indicator flips, and on
 * every 100ms stream tick, and the group is unchanged then.
 *
 * Bailing out depends on two identities the pane keeps stable on its side:
 * `group`, which groupConsecutiveTools reuses while the run's rows are
 * unchanged, and `getMessageKey`, a module-level function. Adding a prop
 * rebuilt per render here would cost every group on screen a render per tick.
 */
export default memo(ToolGroupContainer);
