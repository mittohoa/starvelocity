import { isResourceLimitError, type GitHubClient } from '../github/client.ts';
import {
  buildRepoBatchQuery,
  buildRepoBatchVariables,
  type GqlRepo,
  type RepoBatchResult,
} from '../github/queries.ts';
import { db, tx } from '../db/index.ts';
import { reposDueForSnapshot, upsertRepo, markGone, type RepoRow } from '../db/repos.ts';
import { config } from '../config.ts';
import { log, progress, progressDone } from '../log.ts';
import { chunk, utcDay } from '../util.ts';

export interface SnapshotStats {
  snapshotDate: string;
  batches: number;
  snapshotted: number;
  rowsWritten: number;
  renamed: number;
  gone: number;
  /** Batches GitHub refused as too expensive, which we then split. */
  splits: number;
  /** Repos we could not capture even at the minimum batch size. */
  refused: number;
}

function isGqlRepo(v: unknown): v is GqlRepo {
  return typeof v === 'object' && v !== null && 'stargazerCount' in v;
}

function writeMetrics(repoId: number, snapshotDate: string, r: GqlRepo): number {
  const res = db().prepare(
    `INSERT INTO repo_metrics_daily
       (repo_id, snapshot_date, captured_at, stars, forks, watchers, open_issues, open_prs)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT (repo_id, snapshot_date) DO UPDATE SET
       captured_at = excluded.captured_at,
       stars       = excluded.stars,
       forks       = excluded.forks,
       watchers    = excluded.watchers,
       open_issues = excluded.open_issues,
       open_prs    = excluded.open_prs`,
  ).run(
    repoId, snapshotDate, new Date().toISOString(),
    r.stargazerCount, r.forkCount,
    r.watchers?.totalCount ?? null,
    r.issues?.totalCount ?? null,
    r.pullRequests?.totalCount ?? null,
  );
  return Number(res.changes);
}

function applyBatch(batch: readonly RepoRow[], data: RepoBatchResult, snapshotDate: string, stats: SnapshotStats) {
  const missing: number[] = [];

  tx(() => {
    batch.forEach((row, i) => {
      const node = data[`r${i}`];
      if (!isGqlRepo(node)) { missing.push(row.id); return; }

      // GraphQL follows renames, so nameWithOwner is the current truth.
      if (node.nameWithOwner.toLowerCase() !== row.full_name.toLowerCase()) {
        stats.renamed++;
        log.debug(`renamed: ${row.full_name} -> ${node.nameWithOwner}`);
      }

      upsertRepo(
        {
          id: node.databaseId ?? row.id,
          nodeId: node.id,
          owner: node.owner?.login ?? node.nameWithOwner.split('/')[0] ?? row.owner,
          name: node.name,
          fullName: node.nameWithOwner,
          ownerType: node.owner?.__typename ?? null,
          description: node.description,
          primaryLanguage: node.primaryLanguage?.name ?? null,
          licenseSpdx: node.licenseInfo?.spdxId ?? null,
          homepage: node.homepageUrl,
          topics: (node.repositoryTopics?.nodes ?? [])
            .filter((n): n is { topic: { name: string } } => n !== null)
            .map(n => n.topic.name),
          isFork: node.isFork,
          isArchived: node.isArchived,
          isTemplate: node.isTemplate,
          ghCreatedAt: node.createdAt,
          ghPushedAt: node.pushedAt,
          stars: node.stargazerCount,
          forks: node.forkCount,
        },
        'snapshot',
      );

      stats.rowsWritten += writeMetrics(node.databaseId ?? row.id, snapshotDate, node);
      stats.snapshotted++;
    });

    // Deleted, made private, or transferred out of reach.
    markGone(missing);
    stats.gone += missing.length;
  });
}

/**
 * Fetches and stores one batch. A batch whose document GitHub considers too
 * expensive gets halved and retried rather than failing the whole run — the
 * threshold depends on which repos happen to land together, so a fixed batch
 * size alone is not reliable.
 */
async function processBatch(
  gh: GitHubClient,
  batch: readonly RepoRow[],
  snapshotDate: string,
  stats: SnapshotStats,
): Promise<void> {
  if (batch.length === 0) return;

  const query = buildRepoBatchQuery(batch.length);
  const vars = buildRepoBatchVariables(batch.map(r => ({ owner: r.owner, name: r.name })));

  let data: RepoBatchResult;
  try {
    data = await gh.graphql<RepoBatchResult>(query, vars);
  } catch (err) {
    if (!isResourceLimitError(err)) throw err;

    if (batch.length > config.snapshot.minBatchSize) {
      const mid = Math.ceil(batch.length / 2);
      stats.splits++;
      log.debug(`batch of ${batch.length} refused as too expensive; splitting into ${mid} + ${batch.length - mid}`);
      await processBatch(gh, batch.slice(0, mid), snapshotDate, stats);
      await processBatch(gh, batch.slice(mid), snapshotDate, stats);
      return;
    }

    stats.refused += batch.length;
    log.warn(
      `${batch.length} repo(s) refused even at the minimum batch size and were skipped: ` +
      batch.map(r => r.full_name).join(', '),
    );
    return;
  }

  stats.batches++;
  applyBatch(batch, data, snapshotDate, stats);
}

/**
 * Captures today's metrics for every tracked repo that does not have a row for
 * today yet, so a re-run after a crash resumes instead of starting over.
 */
export async function snapshotAll(
  gh: GitHubClient,
  opts: { date?: string; limit?: number } = {},
): Promise<SnapshotStats> {
  const snapshotDate = opts.date ?? utcDay();
  const limit = opts.limit ?? config.maxTrackedRepos;

  const due = reposDueForSnapshot(snapshotDate, limit);
  const stats: SnapshotStats = {
    snapshotDate, batches: 0, snapshotted: 0, rowsWritten: 0,
    renamed: 0, gone: 0, splits: 0, refused: 0,
  };

  if (due.length === 0) {
    log.info(`snapshot ${snapshotDate}: nothing due — every tracked repo already has a row`);
    return stats;
  }

  log.info(`snapshot ${snapshotDate}: ${due.length} repo(s) due, batch size ${config.snapshot.batchSize}`);

  const batches = chunk(due, config.snapshot.batchSize);
  let index = 0;

  for (const batch of batches) {
    await processBatch(gh, batch, snapshotDate, stats);
    index++;
    progress(
      `batch ${index}/${batches.length} · ${stats.snapshotted} captured · ` +
      `${stats.gone} gone · ${stats.splits} split · ${gh.graphqlPoints} gql points`,
    );
  }

  progressDone();
  log.info(
    `snapshot ${snapshotDate} done · ${stats.snapshotted} repos · ${stats.rowsWritten} rows · ` +
    `${stats.renamed} renamed · ${stats.gone} gone · ${gh.rateSummary()}`,
  );
  if (stats.refused > 0) {
    log.warn(`${stats.refused} repo(s) have no row for ${snapshotDate} — coverage is incomplete`);
  }
  return stats;
}
