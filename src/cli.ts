#!/usr/bin/env node
import { GitHubClient } from './github/client.ts';
import { db, migrate, closeDb, startRun, finishRun } from './db/index.ts';
import { countRepos } from './db/repos.ts';
import { config, requireToken } from './config.ts';
import { log } from './log.ts';
import { fmtCompact, fmtInt, utcDay } from './util.ts';
import { discoverAll } from './collector/discover.ts';
import { snapshotAll } from './collector/snapshot.ts';
import { computeVelocity } from './collector/velocity.ts';
import { backfillStars } from './collector/backfill.ts';
import { scoreAll } from './collector/score.ts';
import { runCycle } from './collector/run.ts';

interface Args {
  command: string;
  flags: Record<string, string | true>;
}

function parseArgs(argv: readonly string[]): Args {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (const token of rest) {
    if (!token.startsWith('--')) continue;
    const body = token.slice(2);
    const eq = body.indexOf('=');
    if (eq < 0) flags[body] = true;
    else flags[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return { command, flags };
}

function flagNum(flags: Args['flags'], key: string, fallback: number): number {
  const v = flags[key];
  if (typeof v !== 'string') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function flagStr(flags: Args['flags'], key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

const HELP = `
StarVelocity collector — phase 1

  npm run migrate                      create/upgrade the SQLite schema
  npm run discover                     find repos via the Search API
  npm run snapshot                     capture today's metrics for tracked repos
  npm run velocity                     derive 1d/7d/30d star velocity
  npm run backfill -- --limit=100      import starred_at history, if the token allows it
  npm run run                          full cycle: discover -> snapshot -> velocity -> score
  npm run stats                        what the database currently holds
  npm run top -- --window=7d           ranking by velocity

Flags
  --window=1d|7d|30d   velocity window for \`top\`        (default 7d)
  --sort=abs|rel|accel ranking metric for \`top\`         (default abs)
  --lang=Rust          filter \`top\` by primary language
  --limit=N            row limit / work limit
  --date=YYYY-MM-DD    operate on a specific snapshot day
  --force              run discovery even if it ran recently
  --skip-discover      skip the discovery step in \`run\`
  --redo               re-attempt repos already backfilled
`;

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'migrate': {
      migrate();
      break;
    }

    case 'discover': {
      migrate();
      const gh = new GitHubClient(requireToken());
      const id = startRun('discover');
      try {
        const s = await discoverAll(gh);
        finishRun(id, 'ok', {
          reposDiscovered: s.inserted,
          apiCalls: gh.apiCalls,
          notes: `${s.queries} queries, ${s.cappedQueries.length} capped`,
        });
      } catch (err) {
        finishRun(id, 'error', { apiCalls: gh.apiCalls, notes: String(err).slice(0, 500) });
        throw err;
      }
      break;
    }

    case 'snapshot': {
      migrate();
      const gh = new GitHubClient(requireToken());
      const id = startRun('snapshot');
      try {
        const s = await snapshotAll(gh, {
          date: flagStr(flags, 'date'),
          limit: flagNum(flags, 'limit', config.maxTrackedRepos),
        });
        finishRun(id, 'ok', {
          reposSnapshotted: s.snapshotted,
          apiCalls: gh.apiCalls,
          graphqlPoints: gh.graphqlPoints,
          rowsWritten: s.rowsWritten,
          notes: `gone=${s.gone} renamed=${s.renamed}`,
        });
      } catch (err) {
        finishRun(id, 'error', { apiCalls: gh.apiCalls, graphqlPoints: gh.graphqlPoints, notes: String(err).slice(0, 500) });
        throw err;
      }
      break;
    }

    case 'velocity': {
      migrate();
      const id = startRun('velocity');
      const s = computeVelocity(flagStr(flags, 'date') ?? utcDay());
      finishRun(id, 'ok', { rowsWritten: s.rowsWritten, notes: `d7 resolved for ${s.withD7}` });
      break;
    }

    case 'backfill': {
      migrate();
      const gh = new GitHubClient(requireToken());
      const id = startRun('backfill');
      try {
        const s = await backfillStars(gh, {
          limit: flagNum(flags, 'limit', 100),
          redo: flags['redo'] === true,
        });
        finishRun(id, 'ok', {
          apiCalls: gh.apiCalls,
          graphqlPoints: gh.graphqlPoints,
          rowsWritten: s.daysWritten,
          notes: `access=${s.access} ok=${s.ok} errors=${s.errors}`,
        });
      } catch (err) {
        finishRun(id, 'error', { apiCalls: gh.apiCalls, notes: String(err).slice(0, 500) });
        throw err;
      }
      break;
    }

    case 'score': {
      migrate();
      const id = startRun('score');
      const s = scoreAll();
      finishRun(id, 'ok', {
        notes: `seo_ready=${s.seoReady} needs_review=${s.needsReview} draft=${s.draft} rejected=${s.rejected}`,
      });
      break;
    }

    case 'run': {
      migrate();
      await runCycle({
        forceDiscover: flags['force'] === true,
        skipDiscover: flags['skip-discover'] === true,
        date: flagStr(flags, 'date'),
      });
      break;
    }

    case 'stats': {
      migrate();
      printStats();
      break;
    }

    case 'top': {
      migrate();
      printTop(flags);
      break;
    }

    default:
      console.log(HELP);
      if (command !== 'help') process.exitCode = 1;
  }
}

function printStats() {
  const { total, alive } = countRepos();
  const metrics = db().prepare(
    `SELECT COUNT(*) AS rows, COUNT(DISTINCT snapshot_date) AS days,
            MIN(snapshot_date) AS first_day, MAX(snapshot_date) AS last_day
       FROM repo_metrics_daily`,
  ).get() as { rows: number; days: number; first_day: string | null; last_day: string | null };

  const hist = db().prepare(
    `SELECT COUNT(*) AS rows, COUNT(DISTINCT repo_id) AS repos,
            MIN(day) AS first_day, MAX(day) AS last_day
       FROM star_history`,
  ).get() as { rows: number; repos: number; first_day: string | null; last_day: string | null };

  const vel = db().prepare(
    `SELECT COUNT(*) AS rows,
            SUM(CASE WHEN d7  IS NOT NULL THEN 1 ELSE 0 END) AS with_d7,
            SUM(CASE WHEN d30 IS NOT NULL THEN 1 ELSE 0 END) AS with_d30
       FROM repo_velocity WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM repo_velocity)`,
  ).get() as { rows: number; with_d7: number | null; with_d30: number | null };

  const lifecycle = db().prepare(
    `SELECT lifecycle, COUNT(*) AS n FROM repos WHERE gone_at IS NULL GROUP BY lifecycle ORDER BY n DESC`,
  ).all() as unknown as { lifecycle: string; n: number }[];

  const langs = db().prepare(
    `SELECT COALESCE(primary_language, '(none)') AS lang, COUNT(*) AS n
       FROM repos WHERE gone_at IS NULL GROUP BY lang ORDER BY n DESC LIMIT 8`,
  ).all() as unknown as { lang: string; n: number }[];

  const runs = db().prepare(
    `SELECT kind, started_at, status, repos_snapshotted, api_calls, graphql_points
       FROM collector_runs ORDER BY id DESC LIMIT 6`,
  ).all() as unknown as {
    kind: string; started_at: string; status: string;
    repos_snapshotted: number; api_calls: number; graphql_points: number;
  }[];

  console.log(`\nDatabase  ${config.dbPath}`);
  console.log(`Repos     ${fmtInt(alive)} alive / ${fmtInt(total)} total  (cap ${fmtInt(config.maxTrackedRepos)})`);
  console.log(
    `Snapshots ${fmtInt(metrics.rows)} rows across ${metrics.days} day(s)` +
    (metrics.first_day ? `  ${metrics.first_day} -> ${metrics.last_day}` : '  (none yet)'),
  );
  console.log(
    `Backfill  ${fmtInt(hist.rows)} history day(s) for ${fmtInt(hist.repos)} repo(s)` +
    (hist.first_day ? `  ${hist.first_day} -> ${hist.last_day}` : '  (none yet)'),
  );
  console.log(
    `Velocity  latest day: ${fmtInt(vel.rows)} rows · ` +
    `7d window resolved for ${fmtInt(vel.with_d7 ?? 0)} · 30d for ${fmtInt(vel.with_d30 ?? 0)}`,
  );

  if (lifecycle.length) {
    console.log('\nLifecycle');
    for (const l of lifecycle) console.log(`  ${l.lifecycle.padEnd(14)} ${fmtInt(l.n)}`);
  }
  if (langs.length) {
    console.log('\nTop languages');
    for (const l of langs) console.log(`  ${l.lang.padEnd(14)} ${fmtInt(l.n)}`);
  }
  if (runs.length) {
    console.log('\nRecent runs');
    for (const r of runs) {
      console.log(
        `  ${r.started_at.slice(0, 16).replace('T', ' ')}  ${r.kind.padEnd(9)} ${r.status.padEnd(7)}` +
        `  snap ${String(r.repos_snapshotted).padStart(5)}  rest ${String(r.api_calls).padStart(4)}` +
        `  gql ${r.graphql_points}`,
      );
    }
  }

  if ((metrics.days ?? 0) < 2) {
    console.log(
      '\nNo velocity is possible from a single day of snapshots. Keep the scheduled run going:\n' +
      '1d figures appear after the second day, 7d after a week, 30d after a month.',
    );
  }
  console.log('');
}

function printTop(flags: Args['flags']) {
  const window = flagStr(flags, 'window') ?? '7d';
  const sort = flagStr(flags, 'sort') ?? 'abs';
  const lang = flagStr(flags, 'lang');
  const limit = flagNum(flags, 'limit', 20);

  const windowCol: Record<string, { delta: string; vel: string }> = {
    '1d': { delta: 'd1', vel: 'vel_1d' },
    '7d': { delta: 'd7', vel: 'vel_7d' },
    '30d': { delta: 'd30', vel: 'vel_30d' },
  };
  const cols = windowCol[window];
  if (!cols) {
    console.error(`unknown --window=${window}; use 1d, 7d or 30d`);
    process.exitCode = 1;
    return;
  }

  const orderBy =
    sort === 'rel' ? 'v.rel_7d' :
    sort === 'accel' ? 'v.accel' :
    `v.${cols.delta}`;

  const latest = db().prepare(`SELECT MAX(snapshot_date) AS d FROM repo_velocity`).get() as { d: string | null };
  if (!latest.d) {
    console.log('\nNo velocity rows yet. Run `npm run run` first.\n');
    return;
  }

  const rows = db().prepare(
    `SELECT r.full_name, r.primary_language, r.stars,
            v.${cols.delta} AS delta, v.${cols.vel} AS vel, v.accel, v.rel_7d
       FROM repo_velocity v
       JOIN repos r ON r.id = v.repo_id
      WHERE v.snapshot_date = ?
        AND r.gone_at IS NULL
        AND v.${cols.delta} IS NOT NULL
        AND (? IS NULL OR r.primary_language = ?)
      ORDER BY ${orderBy} DESC
      LIMIT ?`,
  ).all(latest.d, lang ?? null, lang ?? null, limit) as unknown as {
    full_name: string; primary_language: string | null; stars: number;
    delta: number | null; vel: number | null; accel: number | null; rel_7d: number | null;
  }[];

  console.log(`\nTop by ${window} ${sort === 'rel' ? 'relative growth' : sort === 'accel' ? 'acceleration' : 'star gain'}` +
    `  ·  snapshot ${latest.d}${lang ? `  ·  ${lang}` : ''}\n`);

  if (rows.length === 0) {
    console.log(`  nothing has a resolved ${window} window yet — needs more history\n`);
    return;
  }

  console.log(`  #  ${'repository'.padEnd(46)} ${'lang'.padEnd(12)} ${'stars'.padStart(7)} ${`+${window}`.padStart(8)} ${'/day'.padStart(7)}`);
  console.log(`  ${'-'.repeat(92)}`);
  rows.forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)} ${r.full_name.slice(0, 46).padEnd(46)} ` +
      `${(r.primary_language ?? '-').slice(0, 12).padEnd(12)} ` +
      `${fmtCompact(r.stars).padStart(7)} ` +
      `${(r.delta === null ? '-' : fmtCompact(r.delta)).padStart(8)} ` +
      `${(r.vel === null ? '-' : r.vel.toFixed(1)).padStart(7)}`,
    );
  });
  console.log('');
}

try {
  await main();
} catch (err) {
  log.error(err instanceof Error ? err.message : String(err));
  if (process.env.LOG_LEVEL === 'debug' && err instanceof Error) console.error(err.stack);
  process.exitCode = 1;
} finally {
  closeDb();
}
