import type { Locale } from './i18n';

const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', vi: 'vi-VN' };

export function fmtInt(n: number, locale: Locale = 'en'): string {
  return n.toLocaleString(INTL_LOCALE[locale]);
}

/** 1234 -> "1.2k", 1200000 -> "1.2M". Used wherever exact digits add noise. */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Signed, for deltas: +512, -3. */
export function fmtDelta(n: number): string {
  const rounded = Math.round(n);
  return rounded > 0 ? `+${fmtCompact(rounded)}` : fmtCompact(rounded);
}

export function fmtRate(n: number): string {
  if (Math.abs(n) >= 100) return String(Math.round(n));
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function fmtPercent(ratio: number): string {
  const pct = ratio * 100;
  if (pct >= 100) return `${Math.round(pct)}%`;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

export function fmtDate(iso: string | null, locale: Locale = 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(INTL_LOCALE[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "3 days ago" / "3 ngày trước", for push recency. */
export function fmtRelative(iso: string | null, locale: Locale = 'en'): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const days = Math.round((Date.now() - then) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' });
  if (Math.abs(days) < 31) return rtf.format(-days, 'day');
  if (Math.abs(days) < 365) return rtf.format(-Math.round(days / 30), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}

/** Deterministic accent colour per language, so a language reads the same everywhere. */
export function languageHue(language: string | null): number {
  if (!language) return 220;
  let hash = 0;
  for (let i = 0; i < language.length; i++) hash = (hash * 31 + language.charCodeAt(i)) % 360;
  return hash;
}
