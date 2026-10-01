import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Read-only handle on the collector's database.
 *
 * Every page is rendered at build time, so this is only ever touched by the
 * build process — never by a request. That is the whole reason the site can be
 * a pile of static files with no database behind it.
 */

const DB_PATH = resolve(process.cwd(), process.env.DB_PATH ?? '../data/starvelocity.db');

let handle: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (handle) return handle;
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `Collector database not found at ${DB_PATH}.\n` +
      'Run the collector first (npm run migrate && npm run run in the project root), ' +
      'or point DB_PATH at an existing database.',
    );
  }
  handle = new DatabaseSync(DB_PATH, { readOnly: true });
  return handle;
}

export function queryAll<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params) as unknown as T[];
}

export function queryOne<T>(sql: string, ...params: (string | number | null)[]): T | null {
  const row = db().prepare(sql).get(...params);
  return (row as T | undefined) ?? null;
}
