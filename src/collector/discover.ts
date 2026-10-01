import type { GitHubClient } from '../github/client.ts';
import { upsertRepo, countRepos, type RepoInput } from '../db/repos.ts';
import { tx } from '../db/index.ts';
import { db } from '../db/index.ts';
import { config } from '../config.ts';
import { log, progress, progressDone } from '../log.ts';
import { daysAgo } from '../util.ts';

/** Shape of one item in a /search/repositories response. */
interface SearchItem {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: { login: string; type: string } | null;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  is_template?: boolean;
  created_at: string;
  pushed_at: string | null;
}

interface SearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: SearchItem[];
}

export interface DiscoverStats {
  queries: number;
  inserted: number;
  updated: number;
  cappedQueries: string[];
}

/**
 * Star buckets, widest first. Search only ever returns the first 1000 matches
 * for a query, so slicing the star axis is how we reach past that ceiling.
 * Buckets are deliberately narrow at the top where a few hundred repos live.
 */
const STAR_BUCKETS = [
  '>=100000', '60000..99999', '40000..59999', '30000..39999',
  '24000..29999', '20000..23999', '17000..19999', '15000..16999',
  '13000..14999', '11500..12999', '10000..11499', '9000..9999',
  '8000..8999', '7000..7999', '6000..6999', '5000..5999',
];

function toRepoInput(it: SearchItem): RepoInput {
  return {
    id: it.id,
    nodeId: it.node_id ?? null,
    owner: it.owner?.login ?? it.full_name.split('/')[0] ?? '',
    name: it.name,
    fullName: it.full_name,
    ownerType: it.owner?.type ?? null,
    description: it.description,
    primaryLanguage: it.language,
    licenseSpdx: it.license?.spdx_id ?? null,
    homepage: it.homepage,
    topics: it.topics ?? [],
    isFork: Boolean(it.fork),
    isArchived: Boolean(it.archived),
    isTemplate: Boolean(it.is_template),
    ghCreatedAt: it.created_at,
    ghPushedAt: it.pushed_at,
    stars: it.stargazers_count,
    forks: it.forks_count,
  };
}

function recordCursor(queryKey: string, resultCount: number, capped: boolean) {
  db().prepare(
    `INSERT INTO discovery_cursors (query_key, last_run_at, result_count, capped)
     VALUES (?,?,?,?)
     ON CONFLICT (query_key) DO UPDATE SET
       last_run_at  = excluded.last_run_at,
       result_count = excluded.result_count,
       capped       = excluded.capped`,
  ).run(queryKey, new Date().toISOString(), resultCount, capped ? 1 : 0);
}

/**
 * Walks one search query, upserting every repo it returns.
 * Stops at maxPages, at the API's own 1000-result ceiling, or when the
 * universe cap is reached.
 */
async function runQuery(
  gh: GitHubClient,
  q: string,
  via: string,
  maxPages: number,
  stats: DiscoverStats,
  budget: { left: number },
): Promise<void> {
  stats.queries++;
  let seen = 0;
  let capped = false;

  for (let page = 1; page <= maxPages; page++) {
    if (budget.left <= 0) break;

    const path =
      `/search/repositories?q=${encodeURIComponent(q)}` +
      `&sort=stars&order=desc&per_page=100&page=${page}`;
    const res = await gh.rest<SearchResponse>(path);

    // 422 (returned as null) means we walked past the 1000-result ceiling.
    if (res === null) { capped = true; break; }
    if (res.items.length === 0) break;

    tx(() => {
      for (const it of res.items) {
        if (budget.left <= 0) break;
        const outcome = upsertRepo(toRepoInput(it), via);
        if (outcome === 'inserted') { stats.inserted++; budget.left--; }
        else stats.updated++;
        seen++;
      }
    });

    progress(`${via} · ${q.slice(0, 46)} · page ${page} · +${stats.inserted} new · budget ${budget.left}`);

    if (res.items.length < 100) break;
    if (page === 10) { capped = res.total_count > 1000; break; } // hard API ceiling
  }

  progressDone();
  if (capped) stats.cappedQueries.push(q);
  recordCursor(`${via}:${q}`, seen, capped);
}

/** Highest-starred repos overall — the stable backbone of the universe. */
export async function discoverTop(gh: GitHubClient, budget: { left: number }): Promise<DiscoverStats> {
  const stats: DiscoverStats = { queries: 0, inserted: 0, updated: 0, cappedQueries: [] };
  for (const bucket of STAR_BUCKETS) {
    if (budget.left <= 0) break;
    await runQuery(gh, `stars:${bucket}`, 'top', 10, stats, budget);
  }
  return stats;
}

/**
 * Recently created repos that already have traction. These are the ones whose
 * velocity actually matters and that a total-stars ranking buries.
 */
export async function discoverNew(gh: GitHubClient, budget: { left: number }): Promise<DiscoverStats> {
  const stats: DiscoverStats = { queries: 0, inserted: 0, updated: 0, cappedQueries: [] };
  const since = daysAgo(config.discovery.newWindowDays);
  const min = config.discovery.minStars;

  // Language-agnostic sweep first, then per-language to beat the 1000 ceiling.
  await runQuery(gh, `created:>=${since} stars:>=${min}`, 'new', 10, stats, budget);

  for (const lang of config.discovery.languages) {
    if (budget.left <= 0) break;
    await runQuery(gh, `created:>=${since} stars:>=${min} language:"${lang}"`, 'new-lang', 5, stats, budget);
  }
  return stats;
}

/**
 * Repos pushed to in the last week with real traction — catches older projects
 * that suddenly come back to life, which neither of the other two passes sees.
 */
export async function discoverActive(gh: GitHubClient, budget: { left: number }): Promise<DiscoverStats> {
  const stats: DiscoverStats = { queries: 0, inserted: 0, updated: 0, cappedQueries: [] };
  const since = daysAgo(7);
  for (const lang of config.discovery.languages) {
    if (budget.left <= 0) break;
    await runQuery(gh, `pushed:>=${since} stars:>=500 language:"${lang}"`, 'active', 4, stats, budget);
  }
  return stats;
}

/**
 * Budget shares per pass. Without these, the `top` pass — which runs against
 * the densest star buckets — would consume every free slot and the newly rising
 * repos this whole product is about would never get imported.
 * Anything a pass leaves unspent is swept up by a final `top` pass.
 */
const PASS_SHARES: { name: string; run: typeof discoverTop; share: number }[] = [
  { name: 'new',    run: discoverNew,    share: 0.45 },
  { name: 'top',    run: discoverTop,    share: 0.35 },
  { name: 'active', run: discoverActive, share: 0.20 },
];

export async function discoverAll(gh: GitHubClient): Promise<DiscoverStats> {
  const { alive } = countRepos();
  const room = Math.max(config.maxTrackedRepos - alive, 0);

  if (room === 0) {
    // Inserts are what the cap gates; metadata refreshes still go through.
    log.info(`universe already at cap (${alive}/${config.maxTrackedRepos}); refreshing metadata only`);
  }
  log.info(`discovery starting · ${alive} tracked · room for ${room} more`);

  const total: DiscoverStats = { queries: 0, inserted: 0, updated: 0, cappedQueries: [] };
  let unspent = room;

  const merge = (s: DiscoverStats) => {
    total.queries += s.queries;
    total.inserted += s.inserted;
    total.updated += s.updated;
    total.cappedQueries.push(...s.cappedQueries);
  };

  for (const pass of PASS_SHARES) {
    const allocation = Math.min(Math.ceil(room * pass.share), unspent);
    const sub = { left: allocation };
    log.info(`pass "${pass.name}" · allocation ${allocation}`);
    merge(await pass.run(gh, sub));
    unspent -= allocation - sub.left; // only what was actually used
  }

  // Leftovers go to the star-bucket sweep, which always has more to give.
  if (unspent > 0 && room > 0) {
    log.info(`sweeping ${unspent} unspent slot(s) into the top-stars pass`);
    const sub = { left: unspent };
    merge(await discoverTop(gh, sub));
  }

  log.info(
    `discovery done · ${total.queries} queries · +${total.inserted} new · ${total.updated} refreshed · ${gh.rateSummary()}`,
  );
  if (total.cappedQueries.length) {
    // Never let a silent ceiling read as full coverage.
    log.warn(`${total.cappedQueries.length} query(ies) hit the 1000-result ceiling — coverage is partial`);
    for (const q of total.cappedQueries.slice(0, 8)) log.debug(`  capped: ${q}`);
  }
  return total;
}
