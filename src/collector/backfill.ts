import type { GitHubClient } from '../github/client.ts';
import { db, tx } from '../db/index.ts';
import { config } from '../config.ts';
import { log, progress, progressDone } from '../log.ts';

/**
 * Historical star timestamps, so velocity does not have to be accumulated from
 * scratch over weeks.
 *
 * Measured reality (2026-09): the stargazer *list* is unavailable to us. REST
 * /stargazers answers 404 with a token and 401 without one, and the GraphQL
 * `stargazers` connection reports totalCount 0 with no edges even though
 * `stargazerCount` returns the true figure. Other user connections on the same
 * repo (watchers, mentionableUsers) work, so this is specific to stargazers.
 *
 * The module therefore probes first and reports the capability as unavailable
 * rather than marking every repo as failed. If a different token or network
 * path ever exposes the connection, the pagination below runs unchanged.
 *
 * GraphQL is used instead of REST deliberately: ordering by STARRED_AT DESC
 * reaches the newest stargazers directly, which sidesteps REST's 40,000-
 * stargazer pagination ceiling entirely.
 */

export type StargazerAccess = 'available' | 'unavailable';

export interface BackfillStats {
  access: StargazerAccess;
  attempted: number;
  ok: number;
  errors: number;
  daysWritten: number;
}

interface Candidate {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  stars: number;
}

interface StargazerPage {
  repository: {
    stargazerCount: number;
    stargazers: {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { starredAt: string }[];
    } | null;
  } | null;
}

const PAGE_QUERY = `query Stargazers($owner: String!, $name: String!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $name) {
    stargazerCount
    stargazers(first: 100, after: $after, orderBy: {field: STARRED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { starredAt }
    }
  }
}`;

/**
 * One cheap query against a repo we know has hundreds of thousands of stars.
 * An empty edge list there can only mean the connection is closed to us.
 */
export async function probeStargazerAccess(gh: GitHubClient): Promise<StargazerAccess> {
  const data = await gh.graphql<StargazerPage>(PAGE_QUERY, {
    owner: 'sindresorhus',
    name: 'awesome',
    after: null,
  });
  const repo = data.repository;
  if (!repo) return 'unavailable';
  if (repo.stargazerCount > 1000 && (repo.stargazers?.edges.length ?? 0) === 0) return 'unavailable';
  return (repo.stargazers?.edges.length ?? 0) > 0 ? 'available' : 'unavailable';
}

function candidates(limit: number, includeDone: boolean): Candidate[] {
  const doneClause = includeDone
    ? ''
    : `AND NOT EXISTS (
         SELECT 1 FROM star_backfill_state s
          WHERE s.repo_id = r.id AND s.status = 'ok'
       )`;
  return db().prepare(
    `SELECT r.id, r.full_name, r.owner, r.name, r.stars
       FROM repos r
      WHERE r.gone_at IS NULL AND r.stars > 0
        ${doneClause}
      ORDER BY r.stars DESC
      LIMIT ?`,
  ).all(limit) as unknown as Candidate[];
}

function recordState(
  repoId: number,
  status: 'ok' | 'partial' | 'out_of_reach' | 'error',
  pages: number,
  oldest: string | null,
  newest: string | null,
  note: string | null,
) {
  db().prepare(
    `INSERT INTO star_backfill_state (repo_id, attempted_at, status, pages_fetched, oldest_day, newest_day, note)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT (repo_id) DO UPDATE SET
       attempted_at = excluded.attempted_at, status = excluded.status,
       pages_fetched = excluded.pages_fetched, oldest_day = excluded.oldest_day,
       newest_day = excluded.newest_day, note = excluded.note`,
  ).run(repoId, new Date().toISOString(), status, pages, oldest, newest, note);
}

async function backfillOne(gh: GitHubClient, c: Candidate): Promise<'ok' | 'error'> {
  const perDay = new Map<string, number>();
  let cursor: string | null = null;
  let pages = 0;
  let liveStars = c.stars;

  // Paging is capped per repo: a repo gaining thousands of stars a day would
  // otherwise consume the whole rate-limit budget reaching back a single week.
  while (pages < config.backfill.maxPagesPerRepo) {
    const data: StargazerPage = await gh.graphql<StargazerPage>(PAGE_QUERY, {
      owner: c.owner,
      name: c.name,
      after: cursor,
    });
    const repo = data.repository;
    if (!repo?.stargazers) break;

    liveStars = repo.stargazerCount;
    pages++;
    for (const edge of repo.stargazers.edges) {
      const day = edge.starredAt.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }

    if (!repo.stargazers.pageInfo.hasNextPage) break;
    cursor = repo.stargazers.pageInfo.endCursor;
    if (!cursor) break;
  }

  if (perDay.size === 0) {
    recordState(c.id, 'error', pages, null, null, 'stargazers connection returned no edges');
    return 'error';
  }

  const days = [...perDay.keys()].sort();
  const oldest = days[0]!;
  const newest = days[days.length - 1]!;

  // Walk backwards from the live total. Unstars make this an estimate rather
  // than an exact reconstruction, which is what the `source` column records.
  let cum = liveStars;
  const rows: { day: string; added: number; cum: number }[] = [];
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]!;
    const added = perDay.get(day)!;
    rows.push({ day, added, cum });
    cum -= added;
  }

  const insert = db().prepare(
    `INSERT INTO star_history (repo_id, day, stars_new, stars_cum, source)
     VALUES (?,?,?,?, 'graphql_stargazers')
     ON CONFLICT (repo_id, day) DO UPDATE SET
       stars_new = excluded.stars_new,
       stars_cum = excluded.stars_cum,
       source    = excluded.source`,
  );

  tx(() => {
    for (const r of rows) {
      // The oldest day is only partially covered — paging stopped mid-day — so
      // keeping it would understate that day's count.
      if (r.day === oldest && rows.length > 1) continue;
      insert.run(c.id, r.day, r.added, r.cum);
    }
  });

  recordState(c.id, 'ok', pages, oldest, newest, `${rows.length - 1} full day(s) reconstructed`);
  return 'ok';
}

export async function backfillStars(
  gh: GitHubClient,
  opts: { limit?: number; redo?: boolean } = {},
): Promise<BackfillStats> {
  const stats: BackfillStats = { access: 'unavailable', attempted: 0, ok: 0, errors: 0, daysWritten: 0 };

  stats.access = await probeStargazerAccess(gh);
  if (stats.access === 'unavailable') {
    log.warn(
      'stargazer history is not available to this token: stargazerCount returns real ' +
      'figures but the stargazers connection is empty (REST /stargazers answers 404).',
    );
    log.warn(
      'Velocity therefore has to come from the daily snapshot series. Keep `npm run run` ' +
      'on a schedule — 1d figures appear tomorrow, 7d in a week, 30d in a month.',
    );
    return stats;
  }

  const limit = opts.limit ?? 100;
  const list = candidates(limit, opts.redo ?? false);
  if (list.length === 0) {
    log.info('backfill: nothing left to do for the current selection');
    return stats;
  }

  log.info(
    `backfill: ${list.length} repo(s), up to ${config.backfill.maxPagesPerRepo} pages each ` +
    `(${config.backfill.maxPagesPerRepo * 100} newest stars per repo)`,
  );

  const before = db().prepare(`SELECT COUNT(*) AS n FROM star_history`).get() as { n: number };

  for (const c of list) {
    stats.attempted++;
    try {
      if ((await backfillOne(gh, c)) === 'ok') stats.ok++;
      else stats.errors++;
    } catch (err) {
      stats.errors++;
      recordState(c.id, 'error', 0, null, null, String(err).slice(0, 300));
      log.warn(`backfill failed for ${c.full_name}`, String(err));
    }
    progress(`${stats.attempted}/${list.length} · ok ${stats.ok} · ${gh.rateSummary()}`);
  }

  progressDone();
  const after = db().prepare(`SELECT COUNT(*) AS n FROM star_history`).get() as { n: number };
  stats.daysWritten = after.n - before.n;

  log.info(`backfill done · ok ${stats.ok} · errors ${stats.errors} · +${stats.daysWritten} history day(s)`);
  return stats;
}
