import { ExternalLink, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  APP_VERSION,
  BRAND_NAME,
  BRAND_REPOSITORY_URL,
  BRAND_WORDMARK_FONT_FAMILY,
  UPSTREAM_REPOSITORY_URL,
} from '@/shared/constants';
import { BrandLogo } from '@/shared/ui';

/** Rendered by Settings to identify this fork, its source, and the original project's license. */
export default function AboutTab() {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BrandLogo className="h-12 w-12 flex-shrink-0" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold" style={{ fontFamily: BRAND_WORDMARK_FONT_FAMILY }}>
              {BRAND_NAME}
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">v{APP_VERSION}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('about.tagline')}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{t('about.forkDescription')}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t('about.modifiedVersion')}</p>
        <p className="mt-3 font-mono text-xs text-foreground">Claude Code · Codex · Cursor CLI · OpenCode</p>
      </div>
      <a href={BRAND_REPOSITORY_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
        <Github className="h-4 w-4" />{t('about.sourceCode')}
      </a>
      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="text-sm font-medium">{t('about.upstreamAttribution')}</h4>
        <a href={UPSTREAM_REPOSITORY_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          CloudCLI UI <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <p className="text-xs text-muted-foreground">Copyright 2025–2026 Siteboon AI B.V. and contributors.</p>
        <a href={`${BRAND_REPOSITORY_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer"
          className="block text-xs text-muted-foreground hover:underline">
          AGPL-3.0-or-later · {t('about.licenseDetails')}
        </a>
      </div>
    </div>
  );
}
