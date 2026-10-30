import { describe, expect, test, vi } from 'vitest';

import { languages, isLanguageSupported } from '@/modules/i18n/languages';

const preferences = vi.hoisted(() => ({
  saved: 'fr' as string | null,
  onChange: () => {},
}));

vi.mock('@/shared/userSettings', () => ({
  readUserPreference: () => preferences.saved,
  writeUserPreference: vi.fn(),
  subscribeToUserPreferences: (listener: () => void) => {
    preferences.onChange = listener;
  },
}));

import i18n from '@/modules/i18n/config';

describe('supported application languages', () => {
  test('offers and loads only English and Simplified Chinese', () => {
    expect(languages.map(language => language.value)).toEqual(['en', 'zh-CN']);
    expect(Object.keys(i18n.options.resources ?? {}).sort()).toEqual(['en', 'zh-CN']);
    // i18next adds its internal key-display mode to this list during init.
    expect(i18n.options.supportedLngs).toEqual(['en', 'zh-CN', 'cimode']);
    expect(isLanguageSupported('zh-TW')).toBe(false);
    expect(isLanguageSupported('fr')).toBe(false);
  });

  test('starts in Simplified Chinese when a removed language was saved', () => {
    expect(i18n.language).toBe('zh-CN');
  });

  test('honors supported preferences and normalizes removed or missing preferences on hydration', async () => {
    for (const [saved, expected] of [
      ['en', 'en'],
      ['zh-CN', 'zh-CN'],
      ['en', 'en'],
      ['zh-TW', 'zh-CN'],
      ['en', 'en'],
      [null, 'zh-CN'],
    ] as const) {
      preferences.saved = saved;
      preferences.onChange();
      await Promise.resolve();
      expect(i18n.language).toBe(expected);
    }
  });
});
