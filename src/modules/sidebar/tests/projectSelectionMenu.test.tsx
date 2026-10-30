import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import SidebarProjectItem from '@/modules/sidebar/SidebarProjectItem';

vi.mock('@/modules/sidebar/SidebarProjectSessions', () => ({ default: () => null }));
vi.mock('@/shared/ui', () => ({
  ActionMenu: ({ items }: { items: { key: string; label: string; onSelect: () => void }[] }) => (
    <div>{items.map((item) => <button key={item.key} onClick={item.onSelect}>{item.label}</button>)}</div>
  ),
}));

const noop = () => {};
function projectProps(): ComponentProps<typeof SidebarProjectItem> {
  return {
    project: { projectId: 'project', name: 'project', displayName: 'Project', fullPath: '/project', sessions: [] },
    selectedProject: null, selectedSession: null, isExpanded: false,
    isDeleting: false, isStarred: false, isEditing: false, renameDraft: '',
    sessions: [{ id: 'session', __provider: 'claude' }], initialSessionsLoaded: true,
    isLoadingMoreSessions: false, currentTime: new Date(), sessionRenameId: null, sessionRenameDraft: '',
    tasksEnabled: false, mcpServerStatus: null, activeSessions: new Set(),
    backgroundSessionIds: new Set(), attentionSessionIds: new Set(), selectedSessionIds: null,
    onRenameDraftChange: noop, onToggleProject: vi.fn(), onProjectSelect: vi.fn(), onToggleStarProject: noop,
    onStartEditingProject: noop, onCancelEditingProject: noop, onSaveProjectName: noop, onDeleteProject: noop,
    onSessionSelect: noop, onDeleteSession: noop, onLoadMoreSessions: noop, onNewSession: noop,
    onStartEditingSession: noop, onCancelEditingSession: noop, onSaveEditingSession: noop,
    onSetSessionSelection: vi.fn(), onToggleSessionSelected: noop, onCancelSessionSelection: noop,
    onDeleteSelectedSessions: noop,
    t: ((key: string) => key) as ComponentProps<typeof SidebarProjectItem>['t'],
  };
}

describe('project menu session selection', () => {
  it('toggles the project from its full title button, including its icon and count', () => {
    const props = projectProps();
    const { rerender } = render(<SidebarProjectItem {...props} />);
    const row = screen.getByRole('button', { name: 'Project 1' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByText('Project'));
    expect(props.onProjectSelect).toHaveBeenCalledWith(props.project);
    expect(props.onToggleProject).toHaveBeenCalledExactlyOnceWith('project');

    rerender(<SidebarProjectItem {...props} selectedProject={props.project} isExpanded />);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(row.querySelector('svg')!);
    expect(props.onToggleProject).toHaveBeenCalledTimes(3);
    expect(props.onProjectSelect).toHaveBeenCalledOnce();
  });

  it('does not toggle when creating a session or using another project action', () => {
    const props = { ...projectProps(), onNewSession: vi.fn(), onToggleStarProject: vi.fn() };
    render(<SidebarProjectItem {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.newSession: Project' }));
    fireEvent.click(screen.getByRole('button', { name: 'navigation.pin' }));
    expect(props.onNewSession).toHaveBeenCalledExactlyOnceWith(props.project);
    expect(props.onToggleStarProject).toHaveBeenCalledExactlyOnceWith('project');
    expect(props.onToggleProject).not.toHaveBeenCalled();
    expect(props.onProjectSelect).not.toHaveBeenCalled();
  });

  it('expands a collapsed project before entering selection without switching projects', () => {
    const props = projectProps();
    render(<SidebarProjectItem {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.select' }));
    expect(props.onToggleProject).toHaveBeenCalledWith('project');
    expect(props.onSetSessionSelection).toHaveBeenCalledWith({ projectId: 'project', sessionIds: new Set() });
    expect(props.onProjectSelect).not.toHaveBeenCalled();
    expect(vi.mocked(props.onToggleProject).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(props.onSetSessionSelection).mock.invocationCallOrder[0],
    );
  });

  it('keeps an already expanded project open', () => {
    const props = projectProps();
    render(<SidebarProjectItem {...props} isExpanded />);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.select' }));
    expect(props.onToggleProject).not.toHaveBeenCalled();
    expect(props.onSetSessionSelection).toHaveBeenCalledOnce();
  });

  it('hides selection when all loaded sessions are running', () => {
    render(<SidebarProjectItem {...projectProps()} activeSessions={new Set(['session'])} />);
    expect(screen.queryByRole('button', { name: 'sessions.select' })).toBeNull();
  });
});
