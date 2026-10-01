export function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

/** UTC calendar day, YYYY-MM-DD. All snapshot bucketing uses UTC. */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return utcDay(d);
}

export function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

/** 1234 -> "1.2k", 1200000 -> "1.2M" */
export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
