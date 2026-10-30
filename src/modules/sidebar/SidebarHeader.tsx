import { ArrowLeft, FolderPlus, PanelLeftClose, RefreshCw, Search, SquarePen, X } from 'lucide-react';
import type { TFunction } from 'i18next';

import { BrandLogo, Input } from '@/shared/ui';
import { BRAND_NAME } from '@/shared/constants';
import type { SidebarSearchMode } from '@/shared/types';

type SidebarHeaderProps = {
  isPWA: boolean;
  isMobile: boolean;
  isLoading: boolean;
  projectsCount: number;
  runningSessionsCount: number;
  archivedSessionsCount: number;
  isArchivedSessionsLoading: boolean;
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  onClearSearchFilter: () => void;
  searchMode: SidebarSearchMode;
  onSearchModeChange: (mode: SidebarSearchMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCreateProject: () => void;
  onCollapseSidebar: () => void;
  onNewSession: () => void;
  t: TFunction;
};


/** Used by SidebarContent for workspace actions and the current search scope. */
export default function SidebarHeader({ searchFilter, onSearchFilterChange, onClearSearchFilter,
  searchMode, onSearchModeChange, onRefresh, isRefreshing, onCreateProject, onCollapseSidebar, onNewSession, t }: SidebarHeaderProps) {
  const scopeLabel = searchMode === 'projects' ? t('navigation.workspace')
    : searchMode === 'conversations' ? t('navigation.recentTitle')
    : searchMode === 'running' ? t('running.title') : t('archived.title');
  const placeholder = searchMode === 'conversations' ? t('search.conversationsPlaceholder')
    : searchMode === 'archived' ? t('search.archivedPlaceholder')
    : searchMode === 'running' ? t('search.runningPlaceholder') : t('projects.searchPlaceholder');
  return (
    <div className="shrink-0 px-3 pb-2 pt-4">
      <div className="mb-5 flex items-center gap-2 px-1">
        <BrandLogo className="h-6 w-6" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{BRAND_NAME}</span>
        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" onClick={onRefresh} disabled={isRefreshing} aria-label={t('tooltips.refresh')}>
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" onClick={onCollapseSidebar} aria-label={t('tooltips.hideSidebar')}><PanelLeftClose className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mb-3 space-y-0.5">
        <button onClick={onNewSession} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs font-medium hover:bg-accent"><SquarePen className="h-4 w-4 text-muted-foreground" />{t('sessions.newSession')}</button>
        <button onClick={onCreateProject} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><FolderPlus className="h-4 w-4" />{t('navigation.addProject')}</button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input aria-label={placeholder} placeholder={placeholder} value={searchFilter} onChange={(event) => onSearchFilterChange(event.target.value)}
          className="nav-search-input h-8 rounded-lg border-0 pl-8 pr-8 text-[11px] placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-border" />
        {searchFilter && <button onClick={onClearSearchFilter} aria-label={t('tooltips.clearSearch')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
      </div>
      {searchMode !== 'projects' && <button onClick={() => onSearchModeChange('projects')} className="mt-3 flex items-center gap-2 px-2 text-[11px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />{t('navigation.workspace')}<span className="text-muted-foreground/40">/</span>{scopeLabel}</button>}
    </div>
  );
}
