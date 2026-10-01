import { db, tx } from '../db/index.ts';
import { log, progress, progressDone } from '../log.ts';
import { dayDiff, utcDay } from '../util.ts';

export interface VelocityStats {
  snapshotDate: string;
  repos: number;
  withD1: number;
  withD7: number;
  withD30: number;
  rowsWritten: number;
}

/** How far back of a gap we tolerate when looking for the reference point. */
const TOLERANCE_DAYS: Record<number, number> = { 1: 2, 7: 5, 30: 14 };

interface Reference { day: string; stars: number }

/**
 * Stars at (or just before) `targetDay`, preferring a real snapshot and falling
 * back to backfilled star history. Returns null when there is genuinely no
 * earlier data point — the caller must leave the window empty rather than
 * inventing a zero, which would read as "gained nothing" instead of "unknown".
 */
function starsAtOrBefore(repoId: number, targetDay: string, earliestDay: string): Reference | null {
  const snap = db().prepare(
    `SELECT snapshot_date AS day, stars
       FROM repo_metrics_daily
      WHERE repo_id = ? AND snapshot_date <= ? AND snapshot_date >= ?
      ORDER BY snapshot_date DESC
      LIMIT 1`,
  ).get(repoId, targetDay, earliestDay) as Reference | undefined;
  if (snap) return snap;

  const hist = db().prepare(
    `SELECT day, stars_cum AS stars
       FROM star_history
      WHERE repo_id = ? AND day <= ? AND day >= ? AND stars_cum IS NOT NULL
      ORDER BY day DESC
      LIMIT 1`,
  ).get(repoId, targetDay, earliestDay) as Reference | undefined;
  return hist ?? null;
}

function shiftDay(day: string, deltaDays: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return utcDay(d);
}

/**
 * Derives per-window star velocity for every repo snapshotted on `snapshotDate`.
 * Idempotent: safe to re-run, and re-running after a backfill fills in windows
 * that were previously unknown.
 */
export function computeVelocity(snapshotDate: string = utcDay()): VelocityStats {
  const today = db().prepare(
    `SELECT repo_id, stars FROM repo_metrics_daily WHERE snapshot_date = ?`,
  ).all(snapshotDate) as unknown as { repo_id: number; stars: number }[];

  const stats: VelocityStats = {
    snapshotDate, repos: today.length, withD1: 0, withD7: 0, withD30: 0, rowsWritten: 0,
  };

  if (today.length === 0) {
    log.warn(`velocity: no snapshot rows for ${snapshotDate} — run snapshot first`);
    return stats;
  }

  const upsert = db().prepare(
    `INSERT INTO repo_velocity
       (repo_id, snapshot_date, stars, d1, d7, d30, vel_1d, vel_7d, vel_30d, accel, rel_7d)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (repo_id, snapshot_date) DO UPDATE SET
       stars = excluded.stars, d1 = excluded.d1, d7 = excluded.d7, d30 = excluded.d30,
       vel_1d = excluded.vel_1d, vel_7d = excluded.vel_7d, vel_30d = excluded.vel_30d,
       accel = excluded.accel, rel_7d = excluded.rel_7d`,
  );

  let processed = 0;

  tx(() => {
    for (const row of today) {
      const windows: Record<number, { delta: number; perDay: number } | null> = { 1: null, 7: null, 30: null };

      for (const n of [1, 7, 30]) {
        const target = shiftDay(snapshotDate, -n);
        const earliest = shiftDay(snapshotDate, -(n + (TOLERANCE_DAYS[n] ?? 0)));
        const ref = starsAtOrBefore(row.repo_id, target, earliest);
        if (!ref) continue;

        const gap = dayDiff(snapshotDate, ref.day);
        if (gap <= 0) continue;

        const rawDelta = row.stars - ref.stars;
        const perDay = rawDelta / gap;
        // Normalise to a clean n-day figure so an uneven gap does not distort
        // the comparison between repos.
        windows[n] = { delta: perDay * n, perDay };
      }

      const w1 = windows[1], w7 = windows[7], w30 = windows[30];
      if (w1) stats.withD1++;
      if (w7) stats.withD7++;
      if (w30) stats.withD30++;

      const accel = w7 && w30 ? w7.perDay - w30.perDay : null;
      const rel7 = w7 ? w7.delta / Math.max(row.stars - w7.delta, 1) : null;

      const res = upsert.run(
        row.repo_id, snapshotDate, row.stars,
        w1?.delta ?? null, w7?.delta ?? null, w30?.delta ?? null,
        w1?.perDay ?? null, w7?.perDay ?? null, w30?.perDay ?? null,
        accel, rel7,
      );
      stats.rowsWritten += Number(res.changes);

      if (++processed % 500 === 0) progress(`velocity ${processed}/${today.length}`);
    }
  });

  progressDone();
  log.info(
    `velocity ${snapshotDate} · ${stats.repos} repos · ` +
    `1d:${stats.withD1} 7d:${stats.withD7} 30d:${stats.withD30} windows resolved`,
  );
  if (stats.withD7 === 0) {
    log.warn(
      'no 7-day windows yet — velocity needs a history of daily snapshots. ' +
      'Keep the scheduled run going: 1d appears after two days, 7d after a week.',
    );
  }
  return stats;
}
