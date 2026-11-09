/**
 * Lightweight i18n types — no external dependency (react-intl / i18next intentionally unused).
 *
 * Language is persisted in `localStorage` under `stocksim-settings` (GameSettings.language),
 * driven by `App.tsx`. This module only reads/writes the language + number-format preference.
 */

export type Language = 'en' | 'de' | 'zh' | 'tw';
export type NumberFormat = 'us' | 'eu';

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export interface I18nContextValue {
  language: Language;
  numberFormat: NumberFormat;
  locale: string;
  numberLocale: string;
  dateLocale: string;
  t: TranslateFn;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatMoney: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (iso: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (iso: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (iso: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatGameTime: (iso: string) => string;
}

export const SETTINGS_STORAGE_KEY = 'stocksim-settings';
export const I18N_LANGUAGE_EVENT = 'stocksim-language-changed';

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'de' || value === 'zh' || value === 'tw';
}

export function isNumberFormat(value: unknown): value is NumberFormat {
  return value === 'us' || value === 'eu';
}

/** Read persisted language/numberFormat without React (used before mount). */
export function getStoredSettings(): { language: Language; numberFormat: NumberFormat } {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { language: 'en', numberFormat: 'us' };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const language = isLanguage(parsed.language) ? parsed.language : 'en';
    const numberFormat = isNumberFormat(parsed.numberFormat) ? parsed.numberFormat : 'us';
    return { language, numberFormat };
  } catch {
    return { language: 'en', numberFormat: 'us' };
  }
}

export function getStoredLanguage(): Language {
  return getStoredSettings().language;
}

/** Change the document's `<html lang>` attribute — call whenever language changes. */
export function syncDocumentLanguage(language: Language): void {
  try {
    document.documentElement.lang =
      language === 'zh' ? 'zh-CN' : language === 'tw' ? 'zh-TW' : language;
  } catch {
    /* non-DOM environment (tests) — ignore */
  }
}
