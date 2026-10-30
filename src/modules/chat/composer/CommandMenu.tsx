import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactElement } from 'react';
import {
  CornerDownLeft,
  Folder,
  MessageSquare,
  Sparkles,
  Star,
  Terminal,
  User,
  type LucideIcon,
} from 'lucide-react';

type CommandMenuCommand = {
  name: string;
  description?: string;
  namespace?: string;
  path?: string;
  type?: string;
  metadata?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type CommandMenuProps = {
  commands?: CommandMenuCommand[];
  selectedIndex?: number;
  onSelect?: (command: CommandMenuCommand, index: number, isHover: boolean) => void;
  onClose: () => void;
  position?: { top: number; left: number; bottom?: number };
  isOpen?: boolean;
  frequentCommands?: CommandMenuCommand[];
};

type CommandMenuRow = {
  command: CommandMenuCommand;
  commandIndex: number;
  renderKey: string;
};

const menuBaseStyle: CSSProperties = {
  maxHeight: '360px',
  overflowY: 'auto',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  zIndex: 1000,
  padding: '6px',
  transition: 'opacity 150ms ease-in-out, transform 150ms ease-in-out',
  backdropFilter: 'blur(12px)',
};

const BUILTIN_DESCRIPTION_KEYS: Record<string, string> = {
  '/help': 'help',
  '/cost': 'cost',
  '/memory': 'memory',
  '/config': 'config',
  '/status': 'status',
};

const namespaceLabels: Record<string, string> = {
  frequent: 'Frequently Used',
  builtin: 'Built-in Commands',
  skill: 'Skills',
  project: 'Project Commands',
  user: 'User Commands',
  other: 'Other Commands',
};

const namespaceIcons: Record<string, LucideIcon> = {
  frequent: Star,
  builtin: Terminal,
  skill: Sparkles,
  project: Folder,
  user: User,
  other: MessageSquare,
};

const MENU_EDGE_GAP = 16;
const MENU_MAX_HEIGHT = 360;
const MENU_MIN_HEIGHT = 160;

const getCommandKey = (command: CommandMenuCommand) =>
  `${command.name}::${command.namespace || command.type || 'other'}::${command.path || ''}`;

const getNamespace = (command: CommandMenuCommand) => command.namespace || command.type || 'other';

const getNamespaceIcon = (namespace: string) => namespaceIcons[namespace] || namespaceIcons.other;

const getMenuPosition = (position: { top: number; left: number; bottom?: number }): CSSProperties => {
  if (typeof window === 'undefined') {
    return { position: 'fixed', top: '16px', left: '16px' };
  }
  const maxAnchorBottom = Math.max(MENU_EDGE_GAP, window.innerHeight - MENU_EDGE_GAP - MENU_MIN_HEIGHT);
  if (window.innerWidth < 640) {
    const anchorBottom = Math.min(Math.max(MENU_EDGE_GAP, position.bottom ?? 90), maxAnchorBottom);
    return {
      position: 'fixed',
      bottom: `${anchorBottom}px`,
      left: '16px',
      right: '16px',
      width: 'auto',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: `min(54vh, calc(100vh - ${anchorBottom}px - ${MENU_EDGE_GAP}px))`,
    };
  }
  const anchorBottom = Math.min(Math.max(MENU_EDGE_GAP, position.bottom ?? 90), maxAnchorBottom);
  const clampedLeft = Math.max(
    MENU_EDGE_GAP,
    Math.min(position.left, window.innerWidth - 440 - MENU_EDGE_GAP),
  );

  return {
    position: 'fixed',
    bottom: `${anchorBottom}px`,
    left: `${clampedLeft}px`,
    width: 'min(440px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: `min(${MENU_MAX_HEIGHT}px, calc(100vh - ${anchorBottom}px - ${MENU_EDGE_GAP}px))`,
  };
};

/**
 * Rendered by chat's ChatComposer as the slash-command palette that appears
 * while the user is typing a command in the input.
 */
export default function CommandMenu({
  commands = [],
  selectedIndex = -1,
  onSelect,
  onClose,
  position = { top: 0, left: 0 },
  isOpen = false,
  frequentCommands = [],
}: CommandMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const menuPosition = getMenuPosition(position);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current || !(event.target instanceof Node)) {
        return;
      }
      if (!menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!selectedItemRef.current || !menuRef.current) {
      return;
    }
    const menuRect = menuRef.current.getBoundingClientRect();
    const itemRect = selectedItemRef.current.getBoundingClientRect();
    if (itemRect.bottom > menuRect.bottom || itemRect.top < menuRect.top) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  const hasFrequentCommands = frequentCommands.length > 0;
  const frequentCommandKeys = new Set(frequentCommands.map(getCommandKey));
  const commandIndexesByKey = new Map<string, number[]>();
  commands.forEach((command, index) => {
    const key = getCommandKey(command);
    const commandIndexes = commandIndexesByKey.get(key) ?? [];
    commandIndexes.push(index);
    commandIndexesByKey.set(key, commandIndexes);
  });
  const frequentCommandOccurrences = new Map<string, number>();
  const getFrequentCommandIndex = (command: CommandMenuCommand): number => {
    const key = getCommandKey(command);
    const occurrence = frequentCommandOccurrences.get(key) ?? 0;
    frequentCommandOccurrences.set(key, occurrence + 1);

    const commandIndexes = commandIndexesByKey.get(key) ?? [];
    return commandIndexes[occurrence] ?? commandIndexes[0] ?? -1;
  };

  const groupedCommands = commands.reduce<Record<string, CommandMenuRow[]>>((groups, command, index) => {
    if (hasFrequentCommands && frequentCommandKeys.has(getCommandKey(command))) {
      return groups;
    }
    const namespace = getNamespace(command);
    if (!groups[namespace]) {
      groups[namespace] = [];
    }
    groups[namespace].push({
      command,
      commandIndex: index,
      renderKey: `${namespace}-${index}-${getCommandKey(command)}`,
    });
    return groups;
  }, {});
  if (hasFrequentCommands) {
    groupedCommands.frequent = frequentCommands
      .map((command, index) => {
        const commandIndex = getFrequentCommandIndex(command);
        return {
          command,
          commandIndex,
          renderKey: `frequent-${index}-${commandIndex}-${getCommandKey(command)}`,
        };
      })
      .filter((row) => row.commandIndex >= 0);
  }

  const preferredOrder = hasFrequentCommands
    ? ['frequent', 'builtin', 'skill', 'project', 'user', 'other']
    : ['builtin', 'skill', 'project', 'user', 'other'];
  const extraNamespaces = Object.keys(groupedCommands).filter((namespace) => !preferredOrder.includes(namespace));
  const orderedNamespaces = [...preferredOrder, ...extraNamespaces].filter((namespace) => groupedCommands[namespace]);
  const renderInPortal = (node: ReactElement) =>
    typeof document === 'undefined' ? node : createPortal(node, document.body);

  if (commands.length === 0) {
    return renderInPortal(
      <div
        ref={menuRef}
        className="command-menu command-menu-empty border border-border bg-popover/95 text-sm text-muted-foreground"
        style={{
          ...menuBaseStyle,
          ...menuPosition,
          overflowY: 'hidden',
          padding: '20px',
          opacity: 1,
          transform: 'translateY(0)',
          textAlign: 'center',
        }}
      >
        No commands available
      </div>
    );
  }

  return renderInPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label={t('chat:misc.availableCommands')}
      className="command-menu border border-border bg-popover/95 text-popover-foreground"
      style={{ ...menuBaseStyle, ...menuPosition, opacity: 1, transform: 'translateY(0)' }}
    >
      {orderedNamespaces.map((namespace) => (
        <div key={namespace} className="command-group">
          {orderedNamespaces.length > 1 && (
            <div className="flex items-center justify-between px-2 pb-1.5 pt-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60">
              <span>{namespaceLabels[namespace] || namespace}</span>
              <span className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground/60">
                {(groupedCommands[namespace] || []).length}
              </span>
            </div>
          )}

          {(groupedCommands[namespace] || []).map(({ command, commandIndex, renderKey }) => {
            const descriptionKey = getNamespace(command) === 'builtin' ? BUILTIN_DESCRIPTION_KEYS[command.name] : undefined;
            const description = descriptionKey
              ? t(`chat:commandMenu.descriptions.${descriptionKey}`, { defaultValue: command.description ?? '' })
              : command.description;
            const isSelected = commandIndex === selectedIndex;
            const NamespaceIcon = getNamespaceIcon(namespace);
            return (
              <div
                key={renderKey}
                ref={isSelected ? selectedItemRef : null}
                role="option"
                aria-selected={isSelected}
                className={`command-item group flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[12px] transition-colors ${
                  isSelected ? 'bg-accent/60' : 'hover:bg-accent/40'
                }`}
                onMouseEnter={() => onSelect && commandIndex >= 0 && onSelect(command, commandIndex, true)}
                onClick={() => onSelect && commandIndex >= 0 && onSelect(command, commandIndex, false)}
                onMouseDown={(event) => event.preventDefault()}
              >
                <NamespaceIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/65" strokeWidth={1.6} />
                <span className="max-w-[45%] shrink-0 truncate font-normal text-foreground/65" title={command.name}>
                  {command.name}
                </span>
                {description && (
                  <span className="min-w-0 flex-1 truncate text-muted-foreground/60" title={description}>
                    {description}
                  </span>
                )}
                {command.metadata?.type && (
                  <span className="command-metadata-badge ml-auto shrink-0 text-[9px] text-muted-foreground/50">
                    {command.metadata.type === 'builtin' ? t('chat:commandMenu.builtin') : command.metadata.type}
                  </span>
                )}
                {isSelected && <CornerDownLeft aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground/60" />}

              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
