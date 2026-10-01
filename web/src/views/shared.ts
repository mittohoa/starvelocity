import type { Window } from '@/lib/queries';

/** Total days of recording a window needs before it can be computed at all. */
export const DAYS_REQUIRED: Record<Window, number> = { '1d': 2, '7d': 8, '30d': 31 };

export const WINDOW_LABEL: Record<Window, string> = { '1d': '1d', '7d': '7d', '30d': '30d' };

export function daysStillNeeded(window: Window, daysAvailable: number): number {
  return Math.max(DAYS_REQUIRED[window] - daysAvailable, 0);
}
