import { db } from './index.ts';

export interface RepoInput {
  id: number;
  nodeId: string | null;
  owner: string;
  name: string;
  fullName: string;
  ownerType: string | null;
  description: string | null;
  primaryLanguage: string | null;
  licenseSpdx: string | null;
  homepage: string | null;
  topics: string[];
  isFork: boolean;
  isArchived: boolean;
  isTemplate: boolean;
  ghCreatedAt: string | null;
  ghPushedAt: string | null;
  stars: number;
  forks: number;
}

export interface RepoRow {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  stars: number;
  primary_language: string | null;
  last_synced_at: string | null;
}

/**
 * A repo can be renamed into a full_name another row already holds. The UNIQUE
 * index would reject the upsert, so park the stale row out of the way first —
 * keeping its history rather than deleting it.
 */
function freeUpFullName(id: number, fullName: string) {
  db().prepare(
    `UPDATE repos
        SET full_name = full_name || '#stale' || id,
            gone_at   = COALESCE(gone_at, ?)
      WHERE full_name = ? AND id <> ?`,
  ).run(new Date().toISOString(), fullName, id);
}

export function upsertRepo(r: RepoInput, discoveredVia: string): 'inserted' | 'updated' {
  const now = new Date().toISOString();
  freeUpFullName(r.id, r.fullName);

  const existed = db().prepare(`SELECT 1 FROM repos WHERE id = ?`).get(r.id) !== undefined;

  db().prepare(
    `INSERT INTO repos (
       id, node_id, owner, name, full_name, owner_type, description,
       primary_language, license_spdx, homepage, topics,
       is_fork, is_archived, is_template, gh_created_at, gh_pushed_at,
       stars, forks, discovered_via, first_seen_at, last_synced_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (id) DO UPDATE SET
       node_id          = excluded.node_id,
       owner            = excluded.owner,
       name             = excluded.name,
       full_name        = excluded.full_name,
       owner_type       = COALESCE(excluded.owner_type, repos.owner_type),
       description      = excluded.description,
       primary_language = excluded.primary_language,
       license_spdx     = excluded.license_spdx,
       homepage         = excluded.homepage,
       topics           = excluded.topics,
       is_fork          = excluded.is_fork,
       is_archived      = excluded.is_archived,
       is_template      = excluded.is_template,
       gh_created_at    = COALESCE(excluded.gh_created_at, repos.gh_created_at),
       gh_pushed_at     = excluded.gh_pushed_at,
       stars            = excluded.stars,
       forks            = excluded.forks,
       last_synced_at   = excluded.last_synced_at,
       gone_at          = NULL`,
  ).run(
    r.id, r.nodeId, r.owner, r.name, r.fullName, r.ownerType, r.description,
    r.primaryLanguage, r.licenseSpdx, r.homepage, JSON.stringify(r.topics),
    r.isFork ? 1 : 0, r.isArchived ? 1 : 0, r.isTemplate ? 1 : 0,
    r.ghCreatedAt, r.ghPushedAt, r.stars, r.forks, discoveredVia, now, now,
  );

  return existed ? 'updated' : 'inserted';
}

export function countRepos(): { total: number; alive: number } {
  const row = db().prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN gone_at IS NULL THEN 1 ELSE 0 END) AS alive
       FROM repos`,
  ).get() as { total: number; alive: number | null };
  return { total: row.total, alive: row.alive ?? 0 };
}

/**
 * Repos due for a metric snapshot today, most-starred first so that a run cut
 * short by a rate limit still covered the repos people care about most.
 */
export function reposDueForSnapshot(snapshotDate: string, limit: number): RepoRow[] {
  return db().prepare(
    `SELECT r.id, r.owner, r.name, r.full_name, r.stars, r.primary_language, r.last_synced_at
       FROM repos r
      WHERE r.gone_at IS NULL
        AND NOT EXISTS (
              SELECT 1 FROM repo_metrics_daily m
               WHERE m.repo_id = r.id AND m.snapshot_date = ?
            )
      ORDER BY r.stars DESC
      LIMIT ?`,
  ).all(snapshotDate, limit) as unknown as RepoRow[];
}

export function markGone(ids: readonly number[]) {
  if (ids.length === 0) return;
  const stmt = db().prepare(`UPDATE repos SET gone_at = ? WHERE id = ? AND gone_at IS NULL`);
  const now = new Date().toISOString();
  for (const id of ids) stmt.run(now, id);
}

/** Trims the universe back to the cap, dropping the least-starred repos. */
export function pruneToCap(cap: number): number {
  const { alive } = countRepos();
  if (alive <= cap) return 0;
  const r = db().prepare(
    `DELETE FROM repos
      WHERE id IN (
        SELECT id FROM repos WHERE gone_at IS NULL ORDER BY stars ASC LIMIT ?
      )`,
  ).run(alive - cap);
  return Number(r.changes);
}
