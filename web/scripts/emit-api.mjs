import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Emits a small read-only JSON API alongside the static site.
 *
 * The Android and desktop clients need data, and standing up a server for it
 * would put the first real running cost into an otherwise free stack. Since the
 * data only changes when the collector runs, static JSON served from the same
 * host is equivalent — and costs nothing.
 *
 * Kept deliberately small: a handful of list endpoints rather than one file per
 * repository, which would mean thousands of files for a client that only ever
 * shows a ranked feed.
 */

const DB_PATH = resolve(process.cwd(), process.env.DB_PATH ?? '../data/starvelocity.db');
const OUT = resolve(process.cwd(), process.argv[2] ?? 'out', 'api');

if (!existsSync(DB_PATH)) {
  console.error(`[emit-api] no database at ${DB_PATH}`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const all = (sql, ...params) => db.prepare(sql).all(...params);
const one = (sql, ...params) => db.prepare(sql).get(...params);

function write(relPath, data) {
  const file = resolve(OUT, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return file;
}

const WINDOWS = { '1d': ['d1', 'vel_1d'], '7d': ['d7', 'vel_7d'], '30d': ['d30', 'vel_30d'] };

/**
 * Filename-safe language slug.
 *
 * Percent-encoding produces names like `c%23.json` for C#, which every client
 * then has to encode identically to find. Spelling the symbols out keeps the
 * path readable and avoids the collision a naive strip would cause (C# and C++
 * would both reduce to "c").
 */
function languageSlug(language) {
  return language
    .toLowerCase()
    .replace(/\+\+/g, 'plusplus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const latest = one(`SELECT MAX(snapshot_date) AS d FROM repo_velocity`)?.d ?? null;

function mapRepo(r) {
  let topics = [];
  try {
    const parsed = JSON.parse(r.topics ?? '[]');
    if (Array.isArray(parsed)) topics = parsed.filter(t => typeof t === 'string');
  } catch {
    topics = [];
  }
  return {
    id: r.id,
    fullName: r.full_name,
    owner: r.owner,
    name: r.name,
    description: r.description,
    language: r.primary_language,
    license: r.license_spdx,
    topics,
    stars: r.stars,
    forks: r.forks,
    pushedAt: r.gh_pushed_at,
    // null means "not yet derivable", never 0 — the clients must be able to
    // tell "gained nothing" apart from "we do not know".
    delta: r.delta ?? null,
    ratePerDay: r.rate ?? null,
    accel: r.accel ?? null,
  };
}

/** Ranked list for a window, falling back to total stars while history builds. */
function ranking(window, { limit = 100, language = null } = {}) {
  const [deltaCol, rateCol] = WINDOWS[window];
  const select = `r.id, r.full_name, r.owner, r.name, r.description, r.primary_language,
                  r.license_spdx, r.topics, r.stars, r.forks, r.gh_pushed_at`;

  if (latest) {
    const rows = all(
      `SELECT ${select}, v.${deltaCol} AS delta, v.${rateCol} AS rate, v.accel
         FROM repo_velocity v
         JOIN repos r ON r.id = v.repo_id
        WHERE v.snapshot_date = ? AND r.gone_at IS NULL AND r.is_fork = 0
          AND v.${deltaCol} IS NOT NULL
          AND (? IS NULL OR r.primary_language = ?)
        ORDER BY v.${deltaCol} DESC
        LIMIT ?`,
      latest, language, language, limit,
    );
    if (rows.length > 0) {
      return { window, basis: 'velocity', snapshotDate: latest, repos: rows.map(mapRepo) };
    }
  }

  const rows = all(
    `SELECT ${select}, NULL AS delta, NULL AS rate, NULL AS accel
       FROM repos r
      WHERE r.gone_at IS NULL AND r.is_fork = 0
        AND (? IS NULL OR r.primary_language = ?)
      ORDER BY r.stars DESC
      LIMIT ?`,
    language, language, limit,
  );
  return { window, basis: 'stars', snapshotDate: latest, repos: rows.map(mapRepo) };
}

const span = one(
  `SELECT COUNT(DISTINCT snapshot_date) AS days, MIN(snapshot_date) AS first_day,
          MAX(snapshot_date) AS last_day
     FROM repo_metrics_daily`,
);
const resolved = one(
  `SELECT SUM(CASE WHEN d1 IS NOT NULL THEN 1 ELSE 0 END) AS d1,
          SUM(CASE WHEN d7 IS NOT NULL THEN 1 ELSE 0 END) AS d7,
          SUM(CASE WHEN d30 IS NOT NULL THEN 1 ELSE 0 END) AS d30
     FROM repo_velocity WHERE snapshot_date = ?`,
  latest,
);

const languages = all(
  `SELECT primary_language AS language, COUNT(*) AS repos, SUM(stars) AS stars
     FROM repos
    WHERE gone_at IS NULL AND primary_language IS NOT NULL AND is_fork = 0
    GROUP BY primary_language
    ORDER BY repos DESC
    LIMIT 40`,
);

const files = [];

files.push(
  write('meta.json', {
    // Bumped when the response shape changes, so an old client can refuse
    // rather than misread a newer payload.
    apiVersion: 1,
    generatedAt: new Date().toISOString(),
    repos: one(`SELECT COUNT(*) AS n FROM repos WHERE gone_at IS NULL`)?.n ?? 0,
    snapshotDays: span?.days ?? 0,
    firstDay: span?.first_day ?? null,
    lastDay: span?.last_day ?? null,
    velocityResolved: {
      '1d': resolved?.d1 ?? 0,
      '7d': resolved?.d7 ?? 0,
      '30d': resolved?.d30 ?? 0,
    },
  }),
);

for (const window of Object.keys(WINDOWS)) {
  files.push(write(`trending-${window}.json`, ranking(window, { limit: 100 })));
}

files.push(
  write('languages.json', {
    generatedAt: new Date().toISOString(),
    languages: languages.map(l => ({
      language: l.language,
      slug: languageSlug(l.language),
      repos: l.repos,
      stars: l.stars,
    })),
  }),
);

for (const l of languages) {
  files.push(write(`lang/${languageSlug(l.language)}.json`, ranking('7d', { limit: 50, language: l.language })));
}

db.close();

console.log(
  `[emit-api] wrote ${files.length} JSON file(s) to ${OUT} ` +
  `(velocity basis: ${latest ? 'available' : 'no snapshots yet'})`,
);
