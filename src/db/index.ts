import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config, ROOT } from '../config.ts';
import { log } from '../log.ts';

let handle: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (handle) return handle;
  mkdirSync(dirname(config.dbPath), { recursive: true });
  handle = new DatabaseSync(config.dbPath);
  // WAL keeps the reader (CLI queries) from blocking the writer (collector).
  handle.exec('PRAGMA journal_mode = WAL');
  handle.exec('PRAGMA foreign_keys = ON');
  handle.exec('PRAGMA busy_timeout = 5000');
  return handle;
}

export function closeDb() {
  handle?.close();
  handle = null;
}

export function migrate(): void {
  const sql = readFileSync(resolve(ROOT, 'src/db/schema.sql'), 'utf8');
  const d = db();
  d.exec(sql);
  d.prepare(
    `INSERT INTO schema_meta (key, value) VALUES ('version', '1')
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`
  ).run();
  log.info(`schema ready at ${config.dbPath}`);
}

/** Runs fn inside a transaction, rolling back on throw. */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (err) {
    try { d.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw err;
  }
}

// ------------------------------------------------------------- run ledger

/** A run killed mid-flight (timeout, Ctrl-C, power loss) leaves its ledger row
 * stuck on 'running'. Left alone those rows accumulate and make the ledger
 * unreadable, so each new run closes out any that can no longer be alive. */
const STALE_RUN_HOURS = 6;

function closeStaleRuns(): number {
  const cutoff = new Date(Date.now() - STALE_RUN_HOURS * 3_600_000).toISOString();
  const r = db().prepare(
    `UPDATE collector_runs
        SET status = 'abandoned',
            finished_at = ?,
            notes = COALESCE(notes, '') || 'interrupted; no completion recorded'
      WHERE status = 'running' AND started_at < ?`,
  ).run(new Date().toISOString(), cutoff);
  return Number(r.changes);
}

export function startRun(kind: string): number {
  closeStaleRuns();
  const r = db()
    .prepare(`INSERT INTO collector_runs (kind, started_at) VALUES (?, ?)`)
    .run(kind, new Date().toISOString());
  return Number(r.lastInsertRowid);
}

export interface RunTotals {
  reposDiscovered?: number;
  reposSnapshotted?: number;
  apiCalls?: number;
  graphqlPoints?: number;
  rowsWritten?: number;
  notes?: string;
}

export function finishRun(id: number, status: 'ok' | 'error', totals: RunTotals = {}) {
  db().prepare(
    `UPDATE collector_runs SET
       finished_at = ?, status = ?,
       repos_discovered = ?, repos_snapshotted = ?,
       api_calls = ?, graphql_points = ?, rows_written = ?,
       notes = ?
     WHERE id = ?`
  ).run(
    new Date().toISOString(), status,
    totals.reposDiscovered ?? 0, totals.reposSnapshotted ?? 0,
    totals.apiCalls ?? 0, totals.graphqlPoints ?? 0, totals.rowsWritten ?? 0,
    totals.notes ?? null, id
  );
}
