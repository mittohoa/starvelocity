import { GitHubClient } from '../github/client.ts';
import { db, startRun, finishRun } from '../db/index.ts';
import { pruneToCap, countRepos } from '../db/repos.ts';
import { config, requireToken } from '../config.ts';
import { log } from '../log.ts';
import { utcDay } from '../util.ts';
import { discoverAll } from './discover.ts';
import { snapshotAll } from './snapshot.ts';
import { computeVelocity } from './velocity.ts';
import { scoreAll } from './score.ts';

/** Discovery is expensive in search quota; once every this many hours is plenty. */
const DISCOVERY_INTERVAL_HOURS = 24;

function hoursSinceLastRun(kind: string): number {
  const row = db().prepare(
    `SELECT started_at FROM collector_runs
      WHERE kind = ? AND status = 'ok'
      ORDER BY started_at DESC LIMIT 1`,
  ).get(kind) as { started_at: string } | undefined;
  if (!row) return Number.POSITIVE_INFINITY;
  return (Date.now() - Date.parse(row.started_at)) / 3_600_000;
}

export interface CycleOptions {
  /** Run discovery even if it ran recently. */
  forceDiscover?: boolean;
  /** Skip discovery entirely (useful on a tight search budget). */
  skipDiscover?: boolean;
  date?: string;
}

/**
 * One full collector cycle, in the order the data depends on:
 * discover -> snapshot -> velocity -> score. Safe to run repeatedly; each step
 * resumes rather than duplicating.
 */
export async function runCycle(opts: CycleOptions = {}): Promise<void> {
  const gh = new GitHubClient(requireToken());
  const runId = startRun('run');
  const snapshotDate = opts.date ?? utcDay();
  let discovered = 0;

  try {
    const since = hoursSinceLastRun('discover');
    const shouldDiscover =
      !opts.skipDiscover && (opts.forceDiscover || since >= DISCOVERY_INTERVAL_HOURS);

    if (shouldDiscover) {
      const dRun = startRun('discover');
      try {
        const s = await discoverAll(gh);
        discovered = s.inserted;
        finishRun(dRun, 'ok', {
          reposDiscovered: s.inserted,
          apiCalls: gh.apiCalls,
          notes: `${s.queries} queries, ${s.cappedQueries.length} capped`,
        });
      } catch (err) {
        finishRun(dRun, 'error', { notes: String(err).slice(0, 500) });
        throw err;
      }

      const pruned = pruneToCap(config.maxTrackedRepos);
      if (pruned > 0) log.info(`pruned ${pruned} least-starred repo(s) to stay at the cap`);
    } else {
      log.info(
        `skipping discovery · last successful run ${Number.isFinite(since) ? `${since.toFixed(1)}h` : 'never'} ago ` +
        `(interval ${DISCOVERY_INTERVAL_HOURS}h)`,
      );
    }

    const snap = await snapshotAll(gh, { date: snapshotDate });
    const vel = computeVelocity(snapshotDate);
    scoreAll();

    const { alive } = countRepos();
    finishRun(runId, 'ok', {
      reposDiscovered: discovered,
      reposSnapshotted: snap.snapshotted,
      apiCalls: gh.apiCalls,
      graphqlPoints: gh.graphqlPoints,
      rowsWritten: snap.rowsWritten + vel.rowsWritten,
      notes: `alive=${alive} gone=${snap.gone} renamed=${snap.renamed}`,
    });

    log.info(`cycle complete · ${alive} repos tracked · ${gh.rateSummary()}`);
  } catch (err) {
    finishRun(runId, 'error', {
      apiCalls: gh.apiCalls,
      graphqlPoints: gh.graphqlPoints,
      notes: String(err).slice(0, 500),
    });
    throw err;
  }
}
