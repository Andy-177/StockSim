import { describe, it, expect } from 'vitest';
import {
  translate,
  lookup,
  interpolate,
  languageLocale,
  numberLocale,
  dateLocale,
  formatGameTime,
} from './format';
import { en } from './dictionaries/en';
import { de } from './dictionaries/de';
import { zh } from './dictionaries/zh';
import { tw } from './dictionaries/tw';
import type { TranslationDictionary } from './types';

/** Collect all dot-notation leaf keys in a dictionary. */
function collectKeys(dict: TranslationDictionary, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(key);
    else if (v && typeof v === 'object') out.push(...collectKeys(v, key));
  }
  return out.sort();
}

describe('i18n dictionaries', () => {
  it('en, de, zh and tw dictionaries expose identical key sets', () => {
    expect(collectKeys(de)).toEqual(collectKeys(en));
    expect(collectKeys(zh)).toEqual(collectKeys(en));
    expect(collectKeys(tw)).toEqual(collectKeys(en));
  });

  it('translates a known key in all languages', () => {
    expect(translate('en', 'settings.title')).toBe('Settings');
    expect(translate('de', 'settings.title')).toBe('Einstellungen');
    expect(translate('zh', 'settings.title')).toBe('设置');
    expect(translate('tw', 'settings.title')).toBe('設定');
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
    expect(translate('de', 'nav.market')).toBe('Markt');
    expect(translate('zh', 'nav.dashboard')).toBe('仪表盘');
    expect(translate('tw', 'nav.dashboard')).toBe('儀表板');
  });

  it('interpolates params', () => {
    expect(translate('en', 'topbar.toClose', { mins: 32 })).toBe('32m to close');
    expect(translate('de', 'topbar.toClose', { mins: 32 })).toBe('32 Min. bis Schluss');
    expect(translate('zh', 'topbar.toClose', { mins: 32 })).toBe('距收盘 32 分钟');
    expect(translate('tw', 'topbar.toClose', { mins: 32 })).toBe('距收盤 32 分鐘');
    expect(interpolate('Hello {name} ({n})', { name: 'A', n: 3 })).toBe('Hello A (3)');
  });

  it('falls back to English for a key only partially translated, then to the key itself', () => {
    // lookup missing key in de by removing it temporarily
    const saved = (de.topbar as Record<string, string>).saved;
    delete (de.topbar as Record<string, string>).saved;
    try {
      expect(lookup(de, 'topbar.saved')).toBeUndefined();
      expect(translate('de', 'topbar.saved')).toBe('Saved!');
      expect(translate('de', 'does.not.exist')).toBe('does.not.exist');
    } finally {
      (de.topbar as Record<string, string>).saved = saved;
    }
  });
});

describe('locale resolution', () => {
  it('maps languages to Intl locales', () => {
    expect(languageLocale('en')).toBe('en-US');
    expect(languageLocale('de')).toBe('de-DE');
    expect(languageLocale('zh')).toBe('zh-CN');
    expect(languageLocale('tw')).toBe('zh-TW');
    expect(dateLocale('zh')).toBe('zh-CN');
    expect(dateLocale('tw')).toBe('zh-TW');
  });

  it('numberFormat overrides the number locale', () => {
    expect(numberLocale('en', 'us')).toBe('en-US');
    expect(numberLocale('en', 'eu')).toBe('de-DE');
    expect(numberLocale('de', 'us')).toBe('en-US');
    expect(numberLocale('de', 'eu')).toBe('de-DE');
  });
});

describe('formatGameTime', () => {
  it('renders English format with weekday + time', () => {
    const out = formatGameTime({ language: 'en', numberFormat: 'us' }, '2026-11-09T14:30:00');
    expect(out).toMatch(/Mon/);
    expect(out).toContain('—');
    expect(out).not.toContain('Sa');
  });

  it('renders German weekdays (Di vs Tue) via Intl', () => {
    const deOut = formatGameTime({ language: 'de', numberFormat: 'eu' }, '2026-11-10T14:30:00');
    expect(deOut).toMatch(/Di/);
    expect(deOut).toContain('—');
  });

  it('renders Simplified and Traditional Chinese weekdays via Intl', () => {
    const zhOut = formatGameTime({ language: 'zh', numberFormat: 'us' }, '2026-11-09T14:30:00');
    const twOut = formatGameTime({ language: 'tw', numberFormat: 'us' }, '2026-11-09T14:30:00');
    expect(zhOut).toContain('—');
    expect(twOut).toContain('—');
    expect(zhOut).not.toContain('Mon');
  });

  it('returns an em-dash for empty/invalid input', () => {
    expect(formatGameTime({ language: 'en', numberFormat: 'us' }, '')).toBe('—');
    expect(formatGameTime({ language: 'de', numberFormat: 'eu' }, 'not-a-date')).toBe('—');
  });
});
