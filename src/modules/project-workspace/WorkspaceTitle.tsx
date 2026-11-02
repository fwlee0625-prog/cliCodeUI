import { useTranslation } from 'react-i18next';

import { LLMProviderLogo } from '@/shared/ui';
import type { Project, ProjectSession } from '@/shared/types';
import { getSessionTitle } from '@/shared/utils';

type WorkspaceTitleProps = {
  selectedProject: Project;
  selectedSession: ProjectSession | null;
};

/** Rendered by WorkspaceHeader to label the workspace with the selected session's name and provider. */
export default function WorkspaceTitle({ selectedProject, selectedSession }: WorkspaceTitleProps) {
  const { t } = useTranslation();
  const title = selectedSession ? getSessionTitle(selectedSession) : selectedProject.displayName;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {selectedSession && (
        <LLMProviderLogo provider={selectedSession.__provider} className="h-3.5 w-3.5 shrink-0" />
      )}
      <h2 className="truncate text-xs font-semibold leading-tight text-foreground">
        {title || t('mainContent.newSession')}
      </h2>
    </div>
  );
}
