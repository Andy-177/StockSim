import type { Language, NumberFormat, TranslationDictionary } from './types';
import { en } from './dictionaries/en';
import { de } from './dictionaries/de';
import { zh } from './dictionaries/zh';
import { tw } from './dictionaries/tw';

export const dictionaries: Record<Language, TranslationDictionary> = { en, de, zh, tw };

/** Resolve a dot-notation key in a nested dictionary. */
export function lookup(dict: TranslationDictionary, key: string): string | undefined {
  const parts = key.split('.');
  let node: string | TranslationDictionary | undefined = dict;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as TranslationDictionary)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Translate with fallback: current language -&gt; English -&gt; raw key.
 * Keeps English UI working even when a German string is missing.
 */
export function translate(
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const current = lookup(dictionaries[language] ?? en, key);
  const fallback = language !== 'en' ? lookup(en, key) : undefined;
  const template = current ?? fallback ?? key;
  return interpolate(template, params);
}

/* ---------- Locale resolution ---------- */

export function languageLocale(language: Language): string {
  switch (language) {
    case 'de': return 'de-DE';
    case 'zh': return 'zh-CN';
    case 'tw': return 'zh-TW';
    default: return 'en-US';
  }
}

export function numberLocale(language: Language, numberFormat: NumberFormat): string {
  if (numberFormat === 'eu') return 'de-DE';
  if (numberFormat === 'us') return 'en-US';
  return languageLocale(language);
}

export function dateLocale(language: Language): string {
  return languageLocale(language);
}

export function localeFor(language: Language, numberFormat: NumberFormat): string {
  return numberLocale(language, numberFormat);
}

/* ---------- Pure formatters (Intl-based) ---------- */

export interface FormatContext {
  language: Language;
  numberFormat: NumberFormat;
}

export function formatNumber(
  ctx: FormatContext,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(numberLocale(ctx.language, ctx.numberFormat), options).format(value);
}

export function formatMoney(
  ctx: FormatContext,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return formatNumber(ctx, value, { style: 'currency', currency: 'USD', ...options });
}

export function formatPercent(
  ctx: FormatContext,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return formatNumber(ctx, value, { style: 'percent', ...options });
}

export function formatDate(
  ctx: FormatContext,
  iso: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(dateLocale(ctx.language), options).format(d);
}

export function formatDateTime(
  ctx: FormatContext,
  iso: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDate(ctx, iso, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatTime(
  ctx: FormatContext,
  iso: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDate(ctx, iso, { hour: '2-digit', minute: '2-digit', ...options });
}

/**
 * Game clock — replaces TopBar's hand-rolled `days[]`/`months[]`/`AM-PM` logic
 * with `Intl.DateTimeFormat` so weekdays/months localize automatically.
 */
export function formatGameTime(ctx: FormatContext, iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const loc = dateLocale(ctx.language);
  const datePart = new Intl.DateTimeFormat(loc, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
  const timePart = new Intl.DateTimeFormat(loc, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${datePart} — ${timePart}`;
}
