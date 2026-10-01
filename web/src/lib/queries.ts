import { queryAll, queryOne } from './db';

/**
 * Every read the site needs, in one place. All of it runs at build time.
 *
 * The recurring theme here is that velocity data does not exist until the
 * collector has been running for a while. Rather than printing zeros — which
 * would read as "this repo gained nothing" — each function reports whether the
 * window it was asked for is actually resolved, and the views say so out loud.
 */

export type Window = '1d' | '7d' | '30d';
export type TrendingPeriod = 'daily' | 'weekly' | 'monthly';

export const PERIOD_TO_WINDOW: Record<TrendingPeriod, Window> = {
  daily: '1d',
  weekly: '7d',
  monthly: '30d',
};

const WINDOW_COLUMNS: Record<Window, { delta: string; rate: string }> = {
  '1d': { delta: 'd1', rate: 'vel_1d' },
  '7d': { delta: 'd7', rate: 'vel_7d' },
  '30d': { delta: 'd30', rate: 'vel_30d' },
};

/** Lifecycle states whose pages we are willing to build at all. */
const BUILDABLE = `('seo_ready', 'published')`;
/** Only this state may be indexed by search engines. */
export const INDEXABLE_LIFECYCLE = 'published';

export interface SiteStats {
  repos: number;
  snapshotDays: number;
  firstDay: string | null;
  lastDay: string | null;
  seoReady: number;
  published: number;
  velocityWindows: Record<Window, number>;
}

export function getSiteStats(): SiteStats {
  const repos = queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM repos WHERE gone_at IS NULL`,
  )?.n ?? 0;

  const span = queryOne<{ days: number; first_day: string | null; last_day: string | null }>(
    `SELECT COUNT(DISTINCT snapshot_date) AS days,
            MIN(snapshot_date) AS first_day,
            MAX(snapshot_date) AS last_day
       FROM repo_metrics_daily`,
  );

  const lifecycle = queryAll<{ lifecycle: string; n: number }>(
    `SELECT lifecycle, COUNT(*) AS n FROM repos WHERE gone_at IS NULL GROUP BY lifecycle`,
  );
  const byLifecycle = new Map(lifecycle.map(l => [l.lifecycle, l.n]));

  const resolved = queryOne<{ d1: number; d7: number; d30: number }>(
    `SELECT SUM(CASE WHEN d1  IS NOT NULL THEN 1 ELSE 0 END) AS d1,
            SUM(CASE WHEN d7  IS NOT NULL THEN 1 ELSE 0 END) AS d7,
            SUM(CASE WHEN d30 IS NOT NULL THEN 1 ELSE 0 END) AS d30
       FROM repo_velocity
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM repo_velocity)`,
  );

  return {
    repos,
    snapshotDays: span?.days ?? 0,
    firstDay: span?.first_day ?? null,
    lastDay: span?.last_day ?? null,
    seoReady: byLifecycle.get('seo_ready') ?? 0,
    published: byLifecycle.get('published') ?? 0,
    velocityWindows: {
      '1d': resolved?.d1 ?? 0,
      '7d': resolved?.d7 ?? 0,
      '30d': resolved?.d30 ?? 0,
    },
  };
}

export interface RepoSummary {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  ownerType: string | null;
  description: string | null;
  language: string | null;
  license: string | null;
  topics: string[];
  stars: number;
  forks: number;
  lifecycle: string;
  qualityScore: number | null;
  pushedAt: string | null;
  createdAt: string | null;
  /** Star gain over the requested window; null when not yet derivable. */
  delta: number | null;
  ratePerDay: number | null;
  accel: number | null;
  relative: number | null;
}

interface RepoRowRaw {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  owner_type: string | null;
  description: string | null;
  primary_language: string | null;
  license_spdx: string | null;
  topics: string;
  stars: number;
  forks: number;
  lifecycle: string;
  quality_score: number | null;
  gh_pushed_at: string | null;
  gh_created_at: string | null;
  delta: number | null;
  rate: number | null;
  accel: number | null;
  rel_7d: number | null;
}

function toSummary(r: RepoRowRaw): RepoSummary {
  let topics: string[] = [];
  try {
    const parsed: unknown = JSON.parse(r.topics ?? '[]');
    if (Array.isArray(parsed)) topics = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    topics = [];
  }
  return {
    id: r.id,
    fullName: r.full_name,
    owner: r.owner,
    name: r.name,
    ownerType: r.owner_type,
    description: r.description,
    language: r.primary_language,
    license: r.license_spdx,
    topics,
    stars: r.stars,
    forks: r.forks,
    lifecycle: r.lifecycle,
    qualityScore: r.quality_score,
    pushedAt: r.gh_pushed_at,
    createdAt: r.gh_created_at,
    delta: r.delta,
    ratePerDay: r.rate,
    accel: r.accel,
    relative: r.rel_7d,
  };
}

export type RankingBasis = 'velocity' | 'stars';

export interface Ranking {
  window: Window;
  /**
   * 'velocity' when the window is genuinely resolved, 'stars' when it is not and
   * the list fell back to total stars. Views must surface which one they got —
   * presenting a stars ranking as a velocity ranking is the exact dishonesty
   * this project exists to avoid.
   */
  basis: RankingBasis;
  snapshotDate: string | null;
  repos: RepoSummary[];
}

/**
 * Ranks repos by star gain over a window, falling back to total stars while the
 * collector is still accumulating history.
 */
export function getRanking(
  window: Window,
  opts: { limit?: number; language?: string; sort?: 'abs' | 'rel' | 'accel' } = {},
): Ranking {
  const limit = opts.limit ?? 25;
  const cols = WINDOW_COLUMNS[window];
  const latest = queryOne<{ d: string | null }>(
    `SELECT MAX(snapshot_date) AS d FROM repo_velocity`,
  )?.d ?? null;

  const select = `
      SELECT r.id, r.full_name, r.owner, r.name, r.owner_type, r.description,
             r.primary_language, r.license_spdx, r.topics, r.stars, r.forks,
             r.lifecycle, r.quality_score, r.gh_pushed_at, r.gh_created_at,
             v.${cols.delta} AS delta, v.${cols.rate} AS rate, v.accel, v.rel_7d`;

  const orderBy =
    opts.sort === 'rel' ? 'v.rel_7d' :
    opts.sort === 'accel' ? 'v.accel' :
    `v.${cols.delta}`;

  if (latest) {
    const rows = queryAll<RepoRowRaw>(
      `${select}
         FROM repo_velocity v
         JOIN repos r ON r.id = v.repo_id
        WHERE v.snapshot_date = ?
          AND r.gone_at IS NULL
          AND r.is_fork = 0
          AND v.${cols.delta} IS NOT NULL
          AND (? IS NULL OR r.primary_language = ?)
        ORDER BY ${orderBy} DESC
        LIMIT ?`,
      latest, opts.language ?? null, opts.language ?? null, limit,
    );
    if (rows.length > 0) {
      return { window, basis: 'velocity', snapshotDate: latest, repos: rows.map(toSummary) };
    }
  }

  // No resolved window yet — rank by total stars and say so.
  const rows = queryAll<RepoRowRaw>(
    `SELECT r.id, r.full_name, r.owner, r.name, r.owner_type, r.description,
            r.primary_language, r.license_spdx, r.topics, r.stars, r.forks,
            r.lifecycle, r.quality_score, r.gh_pushed_at, r.gh_created_at,
            NULL AS delta, NULL AS rate, NULL AS accel, NULL AS rel_7d
       FROM repos r
      WHERE r.gone_at IS NULL
        AND r.is_fork = 0
        AND (? IS NULL OR r.primary_language = ?)
      ORDER BY r.stars DESC
      LIMIT ?`,
    opts.language ?? null, opts.language ?? null, limit,
  );
  return { window, basis: 'stars', snapshotDate: latest, repos: rows.map(toSummary) };
}

export function getRepo(owner: string, name: string): RepoSummary | null {
  const row = queryOne<RepoRowRaw>(
    `SELECT r.id, r.full_name, r.owner, r.name, r.owner_type, r.description,
            r.primary_language, r.license_spdx, r.topics, r.stars, r.forks,
            r.lifecycle, r.quality_score, r.gh_pushed_at, r.gh_created_at,
            v.d7 AS delta, v.vel_7d AS rate, v.accel, v.rel_7d
       FROM repos r
       LEFT JOIN repo_velocity v
              ON v.repo_id = r.id
             AND v.snapshot_date = (SELECT MAX(snapshot_date) FROM repo_velocity)
      WHERE r.full_name = ? COLLATE NOCASE
        AND r.gone_at IS NULL`,
    `${owner}/${name}`,
  );
  return row ? toSummary(row) : null;
}

export interface HistoryPoint {
  day: string;
  stars: number;
  /** 'snapshot' is observed directly; 'backfill' is reconstructed from starred_at. */
  source: 'snapshot' | 'backfill';
}

/**
 * Star totals over time, preferring directly observed snapshots and filling
 * gaps with backfilled history where it exists.
 */
export function getRepoHistory(repoId: number): HistoryPoint[] {
  const snapshots = queryAll<{ day: string; stars: number }>(
    `SELECT snapshot_date AS day, stars
       FROM repo_metrics_daily
      WHERE repo_id = ?
      ORDER BY snapshot_date ASC`,
    repoId,
  );

  const backfilled = queryAll<{ day: string; stars: number }>(
    `SELECT day, stars_cum AS stars
       FROM star_history
      WHERE repo_id = ? AND stars_cum IS NOT NULL
      ORDER BY day ASC`,
    repoId,
  );

  const byDay = new Map<string, HistoryPoint>();
  for (const b of backfilled) byDay.set(b.day, { day: b.day, stars: b.stars, source: 'backfill' });
  // Observed values win over reconstructed ones.
  for (const s of snapshots) byDay.set(s.day, { day: s.day, stars: s.stars, source: 'snapshot' });

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface LanguageCount {
  language: string;
  repos: number;
  stars: number;
}

export function getLanguages(limit = 24): LanguageCount[] {
  return queryAll<LanguageCount>(
    `SELECT primary_language AS language, COUNT(*) AS repos, SUM(stars) AS stars
       FROM repos
      WHERE gone_at IS NULL AND primary_language IS NOT NULL AND is_fork = 0
      GROUP BY primary_language
      ORDER BY repos DESC
      LIMIT ?`,
    limit,
  );
}

export interface OwnerSummary {
  owner: string;
  ownerType: string | null;
  repos: number;
  stars: number;
}

export function getTopOwners(ownerType: 'User' | 'Organization', limit = 50): OwnerSummary[] {
  return queryAll<{ owner: string; owner_type: string | null; repos: number; stars: number }>(
    `SELECT owner, owner_type, COUNT(*) AS repos, SUM(stars) AS stars
       FROM repos
      WHERE gone_at IS NULL AND is_fork = 0 AND owner_type = ?
      GROUP BY owner, owner_type
      ORDER BY stars DESC
      LIMIT ?`,
    ownerType, limit,
  ).map(r => ({ owner: r.owner, ownerType: r.owner_type, repos: r.repos, stars: r.stars }));
}

export function getOwnerRepos(owner: string, limit = 50): RepoSummary[] {
  return queryAll<RepoRowRaw>(
    `SELECT r.id, r.full_name, r.owner, r.name, r.owner_type, r.description,
            r.primary_language, r.license_spdx, r.topics, r.stars, r.forks,
            r.lifecycle, r.quality_score, r.gh_pushed_at, r.gh_created_at,
            v.d7 AS delta, v.vel_7d AS rate, v.accel, v.rel_7d
       FROM repos r
       LEFT JOIN repo_velocity v
              ON v.repo_id = r.id
             AND v.snapshot_date = (SELECT MAX(snapshot_date) FROM repo_velocity)
      WHERE r.owner = ? COLLATE NOCASE AND r.gone_at IS NULL
      ORDER BY r.stars DESC
      LIMIT ?`,
    owner, limit,
  ).map(toSummary);
}

/**
 * Which repo pages to build.
 *
 * Capped on purpose: 5,000 repos across two locales is 10,000 pages, which makes
 * every build slow for very little gain while most repos have no review yet.
 * The cap is reported by the build so it never silently looks like full coverage.
 */
export function getBuildableRepoSlugs(limit: number): { slugs: { owner: string; name: string }[]; total: number } {
  const total = queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM repos WHERE gone_at IS NULL AND lifecycle IN ${BUILDABLE}`,
  )?.n ?? 0;

  const slugs = queryAll<{ owner: string; name: string }>(
    `SELECT owner, name
       FROM repos
      WHERE gone_at IS NULL AND lifecycle IN ${BUILDABLE} AND is_fork = 0
      ORDER BY stars DESC
      LIMIT ?`,
    limit,
  );
  return { slugs, total };
}

export function isIndexable(repo: RepoSummary): boolean {
  return repo.lifecycle === INDEXABLE_LIFECYCLE;
}
