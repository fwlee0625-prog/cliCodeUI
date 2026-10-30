import { memo } from 'react';
import { Check, CheckSquare, ChevronDown, ChevronRight, Edit3, Folder, MoreHorizontal, Pin, Plus, Trash2, X } from 'lucide-react';
import type { TFunction } from 'i18next';

import { ActionMenu } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { LLMProvider, MCPServerStatus, Project, ProjectSession, SessionWithProvider, SidebarSessionSelection } from '@/shared/types';
import SidebarProjectSessions from '@/modules/sidebar/SidebarProjectSessions';

type SidebarProjectItemProps = {
  project: Project;
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  isExpanded: boolean;
  isDeleting: boolean;
  isStarred: boolean;
  /** Resolved for this row: only the project being renamed re-renders on a keystroke. */
  isEditing: boolean;
  renameDraft: string;
  sessions: SessionWithProvider[];
  initialSessionsLoaded: boolean;
  isLoadingMoreSessions: boolean;
  currentTime: Date;
  /** The session being renamed, when it belongs to this project. */
  sessionRenameId: string | null;
  sessionRenameDraft: string;
  tasksEnabled: boolean;
  mcpServerStatus: MCPServerStatus;
  onRenameDraftChange: (name: string) => void;
  onToggleProject: (projectId: string) => void;
  onProjectSelect: (project: Project) => void;
  onToggleStarProject: (projectId: string) => void;
  onStartEditingProject: (project: Project) => void;
  onCancelEditingProject: () => void;
  onSaveProjectName: (projectId: string, nextName: string) => void;
  onDeleteProject: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (sessionId: string, sessionTitle: string) => void;
  onForkSession?: (session: SessionWithProvider) => void;
  onLoadMoreSessions: (projectId: string) => void;
  activeSessions: ReadonlySet<string>;
  backgroundSessionIds: ReadonlySet<string>;
  attentionSessionIds: ReadonlySet<string>;
  onNewSession: (project: Project) => void;
  onStartEditingSession: (projectId: string, sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  /** The sessions ticked in this project's list, or null when it is not the one selecting. */
  selectedSessionIds: ReadonlySet<string> | null;
  onSetSessionSelection: (selection: SidebarSessionSelection) => void;
  onToggleSessionSelected: (projectId: string, sessionId: string) => void;
  onCancelSessionSelection: () => void;
  onDeleteSelectedSessions: (sessionIds: string[]) => void;
  t: TFunction;
};

/** Rendered by SidebarProjectList for one project row, including its expand, rename, star and delete controls. */
function SidebarProjectItem({
  project,
  selectedProject,
  selectedSession,
  isExpanded,
  isDeleting,
  isStarred,
  isEditing,
  renameDraft,
  sessions,
  initialSessionsLoaded,
  isLoadingMoreSessions,
  currentTime,
  sessionRenameId,
  sessionRenameDraft,
  onRenameDraftChange,
  onToggleProject,
  onProjectSelect,
  onToggleStarProject,
  onStartEditingProject,
  onCancelEditingProject,
  onSaveProjectName,
  onDeleteProject,
  onSessionSelect,
  onDeleteSession,
  onForkSession,
  onLoadMoreSessions,
  activeSessions,
  backgroundSessionIds,
  attentionSessionIds,
  onNewSession,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  selectedSessionIds,
  onSetSessionSelection,
  onToggleSessionSelected,
  onCancelSessionSelection,
  onDeleteSelectedSessions,
  t,
}: SidebarProjectItemProps) {
  // Project identity is tracked by the DB-assigned `projectId` everywhere
  // after the projectName → projectId migration.
  const isSelected = selectedProject?.projectId === project.projectId;
  const selectProject = () => {
    if (!isSelected) onProjectSelect(project);
    onToggleProject(project.projectId);
  };
  const canSelectSessions = initialSessionsLoaded && sessions.some((session) =>
    !activeSessions.has(session.id) || backgroundSessionIds.has(session.id));
  const startSessionSelection = () => {
    // Expanding clears the previous selection, so enter selection mode afterwards.
    if (!isExpanded) onToggleProject(project.projectId);
    onSetSessionSelection({ projectId: project.projectId, sessionIds: new Set() });
  };
  const saveProjectName = () => onSaveProjectName(project.projectId, renameDraft);

  return (
    <div className={cn('pb-0.5', isDeleting && 'pointer-events-none opacity-50')}>
      <div className={cn('group my-1 flex min-h-7 items-center gap-1 rounded-lg px-1 hover:bg-accent/60', isSelected && 'bg-accent/50')}>
        {isEditing ? (
          <>
            <button type="button" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
              aria-label={`${t('navigation.toggleProject')}: ${project.displayName}`} aria-expanded={isExpanded}
              onClick={() => onToggleProject(project.projectId)}>
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 items-center gap-1">
            <input autoFocus aria-label={t('projects.projectNamePlaceholder')} value={renameDraft}
              onChange={(event) => onRenameDraftChange(event.target.value)}
              className="w-full min-w-0 rounded border border-border bg-background px-2 py-1 text-[13px]"
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveProjectName();
                if (event.key === 'Escape') { event.stopPropagation(); onCancelEditingProject(); }
              }} />
            <button aria-label={t('tooltips.save')} onClick={saveProjectName}><Check className="h-4 w-4" /></button>
            <button aria-label={t('tooltips.cancel')} onClick={onCancelEditingProject}><X className="h-4 w-4" /></button>
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={selectProject} title={project.fullPath}
              aria-expanded={isExpanded}
              className="flex min-h-7 min-w-0 flex-1 items-center gap-1 rounded py-0.5 text-left text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex w-6 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate pl-1">{project.displayName}</span>
              {/* Session count is hover-only on desktop to match the session rows' metadata. */}
              <span className="text-[9px] tabular-nums text-muted-foreground/60 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                {project.sessionMeta?.total ?? sessions.length}
              </span>
            </button>
            <button type="button" className="flex h-6 w-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100"
              aria-label={`${t('sessions.newSession')}: ${project.displayName}`} onClick={() => onNewSession(project)}><Plus className="h-3.5 w-3.5" /></button>
            <ActionMenu label={t('navigation.projectOptions')} ariaLabel={`${t('navigation.projectOptions')}: ${project.displayName}`}
              icon={MoreHorizontal} iconOnly portal variant="ghost" size="icon"
              triggerClassName="h-6 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
              items={[
                { key: 'pin', label: t(isStarred ? 'navigation.unpin' : 'navigation.pin'), icon: Pin, onSelect: () => onToggleStarProject(project.projectId) },
                { key: 'new', label: t('sessions.newSession'), icon: Plus, onSelect: () => onNewSession(project) },
                ...(canSelectSessions ? [{ key: 'select', label: t('sessions.select'), icon: CheckSquare, onSelect: startSessionSelection }] : []),
                { key: 'rename', label: t('tooltips.renameProject'), icon: Edit3, onSelect: () => onStartEditingProject(project) },
                { key: 'archive', label: t('navigation.manageProject'), icon: Trash2, onSelect: () => onDeleteProject(project) },
              ]} />
          </>
        )}
      </div>

      <SidebarProjectSessions
        project={project}
        isExpanded={isExpanded}
        sessions={sessions}
        selectedSession={selectedSession}
        initialSessionsLoaded={initialSessionsLoaded}
        hasMoreSessions={Boolean(project.sessionMeta?.hasMore)}
        isLoadingMoreSessions={isLoadingMoreSessions}
        activeSessions={activeSessions}
        backgroundSessionIds={backgroundSessionIds}
        attentionSessionIds={attentionSessionIds}
        currentTime={currentTime}
        sessionRenameId={sessionRenameId}
        sessionRenameDraft={sessionRenameDraft}
        onRenameDraftChange={onRenameDraftChange}
        onStartEditingSession={onStartEditingSession}
        onCancelEditingSession={onCancelEditingSession}
        onSaveEditingSession={onSaveEditingSession}
        onProjectSelect={onProjectSelect}
        onSessionSelect={onSessionSelect}
        onDeleteSession={onDeleteSession}
        onForkSession={onForkSession}
        onLoadMoreSessions={onLoadMoreSessions}
        onNewSession={onNewSession}
        selectedSessionIds={selectedSessionIds}
        onSetSessionSelection={onSetSessionSelection}
        onToggleSessionSelected={onToggleSessionSelected}
        onCancelSessionSelection={onCancelSessionSelection}
        onDeleteSelectedSessions={onDeleteSelectedSessions}
        t={t}
      />
    </div>
  );
}

/**
 * Memoized: a websocket session delta re-renders the sidebar roughly every
 * 0.5-2s during a run, and a rename keystroke re-renders it per character.
 *
 * Both renames are resolved to scalars by SidebarProjectList and the sorted
 * session array is cached per project, so a keystroke changes props on exactly
 * one row and every other row's compare succeeds. See sidebarRowProps.test.tsx.
 */
export default memo(SidebarProjectItem);
