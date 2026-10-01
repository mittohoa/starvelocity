import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env loader — avoids a dependency for a two-variable file. */
function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // real env wins
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadEnvFile(resolve(ROOT, '.env'));

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  githubToken: process.env.GITHUB_TOKEN ?? '',
  dbPath: resolve(ROOT, process.env.DB_PATH ?? './data/starvelocity.db'),

  /**
   * Universe cap. Deliberately conservative so one snapshot pass stays inside
   * the Cloudflare D1 free tier (100k row writes / day) once this moves to the
   * cloud. Raise it only after checking the quota math in README.
   */
  maxTrackedRepos: num('MAX_TRACKED_REPOS', 5000),

  discovery: {
    minStars: num('DISCOVER_MIN_STARS', 50),
    newWindowDays: num('DISCOVER_NEW_WINDOW_DAYS', 180),
    /** Languages we slice discovery queries by, to beat the 1000-result cap. */
    languages: (process.env.DISCOVER_LANGUAGES ??
      'TypeScript,Python,Rust,Go,JavaScript,Java,C++,C#,Kotlin,Swift,Zig,Lua,Shell'
    ).split(',').map(s => s.trim()).filter(Boolean),
  },

  snapshot: {
    /**
     * Repos per GraphQL request. A batch costs 1 rate-limit point regardless of
     * size, but GitHub also enforces a per-query *resource* limit that the open
     * pull-request count blows through at 100 aliases. 50 is measured-safe; the
     * snapshot step halves a batch automatically if a request is still refused.
     */
    batchSize: num('SNAPSHOT_BATCH_SIZE', 50),
    /** Stop halving here and report the repo as unsnapshottable. */
    minBatchSize: num('SNAPSHOT_MIN_BATCH_SIZE', 5),
  },

  backfill: {
    /**
     * Pages of 100 newest stargazers to pull per repo. A fast-moving repo can
     * gain thousands of stars a day, so an uncapped walk back would burn the
     * whole budget on a single project.
     */
    maxPagesPerRepo: num('BACKFILL_MAX_PAGES', 20),
  },
};

export function requireToken(): string {
  if (!config.githubToken) {
    throw new Error(
      'GITHUB_TOKEN is not set. Copy .env.example to .env and put a token in it.\n' +
      'A token with NO scopes works — public repo metadata needs no permissions.'
    );
  }
  return config.githubToken;
}
