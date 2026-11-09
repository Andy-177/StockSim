import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { I18nContextValue, Language, NumberFormat } from './types';
import { getStoredSettings, syncDocumentLanguage } from './types';
import {
  formatDate,
  formatDateTime,
  formatGameTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTime,
  dateLocale,
  numberLocale,
  translate,
} from './format';

/**
 * I18n provider — controlled by `App.tsx` via `gameSettings.language` /
 * `gameSettings.numberFormat`. When props are omitted it reads the persisted
 * settings from `localStorage` (useful for isolated rendering / tests).
 *
 * V1 scope: UI chrome only. Glossary/wiki/decision-case text, scenario
 * descriptions and backend news headlines remain English-only.
 */
const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  language?: Language;
  numberFormat?: NumberFormat;
  children: ReactNode;
}

export function I18nProvider({ language: languageProp, numberFormat: numberFormatProp, children }: I18nProviderProps) {
  const controlled = languageProp !== undefined || numberFormatProp !== undefined;
  const [stored, setStored] = useState(() => getStoredSettings());
  const language: Language = languageProp ?? stored.language;
  const numberFormat: NumberFormat = numberFormatProp ?? stored.numberFormat;

  // Uncontrolled mode: re-read persisted settings when App.tsx dispatches
  // `settingsChanged` after writing to localStorage.
  useEffect(() => {
    if (controlled) return;
    const onSettingsChanged = () => setStored(getStoredSettings());
    window.addEventListener('settingsChanged', onSettingsChanged);
    return () => window.removeEventListener('settingsChanged', onSettingsChanged);
  }, [controlled]);

  useEffect(() => {
    syncDocumentLanguage(language);
  }, [language]);

  const ctx = useMemo<FormatContextValue>(() => ({
    language,
    numberFormat,
  }), [language, numberFormat]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      numberFormat,
      locale: numberLocale(language, numberFormat),
      numberLocale: numberLocale(language, numberFormat),
      dateLocale: dateLocale(language),
      t,
      formatNumber: (v, opts) => formatNumber(ctx, v, opts),
      formatMoney: (v, opts) => formatMoney(ctx, v, opts),
      formatPercent: (v, opts) => formatPercent(ctx, v, opts),
      formatDate: (iso, opts) => formatDate(ctx, iso, opts),
      formatDateTime: (iso, opts) => formatDateTime(ctx, iso, opts),
      formatTime: (iso, opts) => formatTime(ctx, iso, opts),
      formatGameTime: (iso) => formatGameTime(ctx, iso),
    }),
    [language, numberFormat, t, ctx],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

interface FormatContextValue {
  language: Language;
  numberFormat: NumberFormat;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within <I18nProvider>');
  }
  return ctx;
}
