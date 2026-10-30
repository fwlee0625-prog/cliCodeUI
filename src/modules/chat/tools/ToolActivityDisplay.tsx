import { useTranslation } from 'react-i18next';

import { CollapsibleDisplay } from '@/modules/chat/tools/CollapsibleDisplay';
import { ToolStatusBadge } from '@/modules/chat/tools/ToolStatusBadge';
import { ScrollArea } from '@/shared/ui';
import type { ToolStatus } from '@/shared/types';

type ToolActivityDisplayProps = {
  label?: string;
  title: string;
  code: string;
  output: string;
  status?: ToolStatus;
};

/** Used by ToolRenderer to fold browser actions and sandbox scripts together with their results in one named row. */
export function ToolActivityDisplay({ label, title, code, output, status }: ToolActivityDisplayProps) {
  const { t } = useTranslation();
  return (
    <CollapsibleDisplay
      toolName={label || ''}
      title={title}
      badge={status && status !== 'completed' ? <ToolStatusBadge status={status} /> : undefined}
    >
      {[
        { label: t('chat:toolDetails.action'), content: code },
        { label: t('chat:toolDetails.output'), content: output },
      ].filter((section) => section.content).map((section) => (
        <section key={section.label} className="mb-2">
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">{section.label}</p>
          <ScrollArea className="max-h-32 rounded-md bg-muted/70 dark:bg-black/20"
            viewportClassName="max-h-32 overscroll-contain" contentClassName="px-2 py-1.5"
            aria-label={section.label}>
            <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-muted-foreground">{section.content}</pre>
          </ScrollArea>
        </section>
      ))}
    </CollapsibleDisplay>
  );
}
