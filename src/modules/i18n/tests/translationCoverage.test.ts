import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { i18n } from '@/modules/i18n';
import zhCNGit from '@/modules/i18n/locales/zh-CN/git.json';

/**
 * Guards the class of bug behind the "Git panel is still English in Chinese"
 * report: `fallbackLng: 'en'` makes a missing key render English silently, so a
 * locale that simply never shipped a namespace looks like a translation-quality
 * problem instead of the missing-file problem it is.
 *
 * The Git namespace is the one these assertions cover because it is the
 * namespace the Chinese locale was missing entirely.
 */

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'locales',
);

const CHINESE_LOCALES = ['zh-CN'] as const;

/** Flattens a bundle into `a.b.c` -> leaf value, the form i18next resolves. */
const flatten = (
  value: unknown,
  prefix = '',
  into = new Map<string, string>(),
): Map<string, string> => {
  if (value === null || typeof value !== 'object') {
    into.set(prefix, String(value));
    return into;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, into);
  }

  return into;
};

/** `{{ name }}` interpolations a translation must keep verbatim. */
const placeholdersOf = (text: string): string[] =>
  (text.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map(token => token.replace(/\s+/g, ''));

/** Rich-text tags a translation must keep balanced and identical in count. */
const refTagsOf = (text: string): number => (text.match(/<\/?ref>/g) ?? []).length;

const zhGitBundles = {
  'zh-CN': zhCNGit,
} as const;

describe('Chinese locales ship a complete Git namespace', () => {
  // Without this floor every assertion below would pass vacuously if the
  // resource bundles silently stopped importing (an empty bundle has no
  // missing keys and no blank values).
  test('the English git baseline actually loaded', () => {
    expect(flatten(i18n.getResourceBundle('en', 'git')).size).toBeGreaterThan(150);
  });

  test.each(CHINESE_LOCALES)('%s registers the git namespace', locale => {
    expect(i18n.hasResourceBundle(locale, 'git')).toBe(true);
  });

  test.each(CHINESE_LOCALES)('%s translates every English git key', locale => {
    const en = flatten(i18n.getResourceBundle('en', 'git'));
    const localized = flatten(zhGitBundles[locale]);

    const missing = [...en.keys()].filter(key => !localized.has(key));

    expect(missing, `missing ${locale} git keys: ${missing.join(', ')}`).toEqual([]);
  });

  test.each(CHINESE_LOCALES)('%s has no empty git translation', locale => {
    const blank = [...flatten(zhGitBundles[locale])]
      .filter(([, text]) => text.trim() === '')
      .map(([key]) => key);

    expect(blank, `blank ${locale} git keys: ${blank.join(', ')}`).toEqual([]);
  });

  test.each(CHINESE_LOCALES)('%s keeps the git placeholders intact', locale => {
    const en = flatten(i18n.getResourceBundle('en', 'git'));
    const localized = flatten(zhGitBundles[locale]);

    const drifted: string[] = [];

    for (const [key, english] of en) {
      const translation = localized.get(key);

      if (translation === undefined) {
        continue;
      }

      const expected = placeholdersOf(english).sort().join('|');
      const actual = placeholdersOf(translation).sort().join('|');

      if (expected !== actual || refTagsOf(english) !== refTagsOf(translation)) {
        drifted.push(key);
      }
    }

    expect(drifted, `placeholder drift in ${locale}: ${drifted.join(', ')}`).toEqual([]);
  });
});

/**
 * The reported symptom was literal English on screen, so the strongest
 * assertion is the one that asks i18next the same question the Git panel asks.
 * A key can exist and still resolve to English if it lands in the wrong nesting
 * level, which the flatten-based checks above cannot see.
 */
describe('the Git panel resolves Chinese text, not the English fallback', () => {
  // Labels taken verbatim from the reported screen: the tab strip, the commit
  // composer, the staged-file list and the status legend.
  const PANEL_KEYS = [
    'tabs.changes',
    'tabs.compare',
    'tabs.history',
    'tabs.branches',
    'tabs.worktrees',
    'composer.commit',
    'composer.placeholder',
    'changes.stageAll',
    'changes.noStagedFiles',
    'legend.title',
  ] as const;

  test.each(CHINESE_LOCALES)('%s renders those labels in Chinese', async locale => {
    const previous = i18n.language;
    await i18n.changeLanguage(locale);

    try {
      const english = i18n.getResourceBundle('en', 'git') as Record<string, unknown>;
      const read = (bundle: Record<string, unknown>, key: string): unknown =>
        key.split('.').reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          bundle,
        );

      const untranslated = PANEL_KEYS.filter(key => {
        const rendered = i18n.t(`git:${key}`);
        // Equal to the English source means the fallback fired.
        if (rendered === read(english, key)) {
          return true;
        }
        // A Chinese locale must actually contain CJK somewhere in the string.
        return !/[\u4e00-\u9fff]/.test(rendered);
      });

      expect(
        untranslated,
        `${locale} still falls back to English for: ${untranslated.join(', ')}`,
      ).toEqual([]);
    } finally {
      await i18n.changeLanguage(previous);
    }
  });
});

describe('locale bundles on disk match what i18n registers', () => {
  // The original bug was two-fold: the JSON file did not exist, and config.ts
  // never imported a git namespace for these locales. Checking the registered
  // namespace set against the directory contents catches the second half, which
  // a file-existence assertion alone would miss.
  test.each(CHINESE_LOCALES)('%s has a bundle for every namespace file', locale => {
    const onDisk = fs
      .readdirSync(path.join(LOCALES_DIR, locale))
      .filter(entry => entry.endsWith('.json'))
      .map(entry => entry.slice(0, -'.json'.length))
      .sort();

    // `options.ns` is typed as `string | readonly string[]` because i18next
    // accepts a single namespace as a bare string too.
    const declaredNs = i18n.options.ns;
    const namespaces = (Array.isArray(declaredNs) ? declaredNs : [declaredNs])
      .filter((namespace): namespace is string => typeof namespace === 'string')
      .filter(namespace => i18n.hasResourceBundle(locale, namespace))
      .sort();

    expect(namespaces).toEqual(onDisk);
  });

  test('the git bundle is committed for both Chinese locales', () => {
    for (const locale of CHINESE_LOCALES) {
      expect(
        fs.existsSync(path.join(LOCALES_DIR, locale, 'git.json')),
        `${locale}/git.json is missing`,
      ).toBe(true);
    }
  });
});

describe('permission requests resolve Simplified Chinese labels', () => {
  test('translates every label shown in the permission banner', () => {
    const keys = ['required', 'tool', 'allowRule', 'viewInput', 'deny', 'allowSaved', 'allowRemember', 'allowOnce'];

    for (const key of keys) {
      const label = i18n.t(`chat:permissionRequest.${key}`, { lng: 'zh-CN' });
      expect(label, key).toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

describe('running sessions sidebar resolves Simplified Chinese labels', () => {
  test('translates the tab, search and all list states', () => {
    const keys = [
      'search.runningTooltip',
      'search.runningPlaceholder',
      'running.title',
      'running.emptyTitle',
      'running.emptyDescription',
      'running.noMatchingSessions',
    ];

    for (const key of keys) {
      expect(i18n.t(`sidebar:${key}`, { lng: 'zh-CN' }), key).toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

describe('archive sidebar resolves Simplified Chinese labels', () => {
  test('translates the tab, search, list states and actions', () => {
    const keys = [
      'search.archiveOnlyTooltip', 'search.archivedPlaceholder',
      'archived.loadingTitle', 'archived.loadingDescription', 'archived.noMatchingSessions',
      'archived.emptyTitle', 'archived.tryDifferentSearch', 'archived.emptyDescription',
      'archived.title', 'archived.restoreHint', 'archived.restoreProject',
      'archived.restoreAction', 'archived.restore', 'archived.deletePermanently',
    ];

    for (const key of keys) {
      expect(i18n.t(`sidebar:${key}`, { lng: 'zh-CN' }), key).toMatch(/[\u4e00-\u9fff]/);
    }
    expect(i18n.t('sidebar:archived.visibleCount', { lng: 'zh-CN', visible: 2, total: 5 }))
      .toBe('共 5 项，显示 2 项');
  });
});

test('project expansion setting resolves Simplified Chinese labels', () => {
  for (const key of ['section', 'label', 'description']) {
    expect(i18n.t(`settings:appearanceSettings.keepProjectsExpanded.${key}`, { lng: 'zh-CN' }), key)
      .toMatch(/[\u4e00-\u9fff]/);
  }
});

test('browser settings resolve Simplified Chinese text for every state', () => {
  const english = i18n.getResourceBundle('en', 'settings').browserUseSettings as Record<string, string>;
  const chinese = i18n.getResourceBundle('zh-CN', 'settings').browserUseSettings as Record<string, string>;
  expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort());
  for (const key of Object.keys(english).filter(key => !['playwrightLabel', 'chromiumLabel'].includes(key))) {
    expect(i18n.t(`settings:browserUseSettings.${key}`, { lng: 'zh-CN' }), key).toMatch(/[\u4e00-\u9fff]/);
  }
});
