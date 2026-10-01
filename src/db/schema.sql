-- StarVelocity schema.
-- Plain SQLite so the same file works against node:sqlite locally and
-- Cloudflare D1 in the cloud. Avoid SQLite features D1 does not support.

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------- repos
CREATE TABLE IF NOT EXISTS repos (
  id               INTEGER PRIMARY KEY,            -- GitHub databaseId
  node_id          TEXT UNIQUE,
  owner            TEXT NOT NULL,
  name             TEXT NOT NULL,
  full_name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  owner_type       TEXT,                           -- User | Organization
  description      TEXT,
  primary_language TEXT,
  license_spdx     TEXT,
  homepage         TEXT,
  topics           TEXT NOT NULL DEFAULT '[]',     -- JSON array of strings
  is_fork          INTEGER NOT NULL DEFAULT 0,
  is_archived      INTEGER NOT NULL DEFAULT 0,
  is_template      INTEGER NOT NULL DEFAULT 0,
  gh_created_at    TEXT,
  gh_pushed_at     TEXT,
  stars            INTEGER NOT NULL DEFAULT 0,     -- latest known, denormalised
  forks            INTEGER NOT NULL DEFAULT 0,
  discovered_via   TEXT,                           -- which query found it
  first_seen_at    TEXT NOT NULL,
  last_synced_at   TEXT,
  gone_at          TEXT,                           -- deleted / privated / renamed away
  quality_score    REAL,
  lifecycle        TEXT NOT NULL DEFAULT 'imported'
    CHECK (lifecycle IN ('imported','draft','needs_review','seo_ready','published','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_repos_stars       ON repos (stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_lang        ON repos (primary_language);
CREATE INDEX IF NOT EXISTS idx_repos_lifecycle   ON repos (lifecycle);
CREATE INDEX IF NOT EXISTS idx_repos_last_synced ON repos (last_synced_at);
CREATE INDEX IF NOT EXISTS idx_repos_alive       ON repos (gone_at) WHERE gone_at IS NULL;

-- ------------------------------------------------------- daily snapshots
-- One row per repo per UTC day. This table is the whole point of phase 1:
-- velocity cannot be derived without a time series, so start collecting early.
CREATE TABLE IF NOT EXISTS repo_metrics_daily (
  repo_id       INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  snapshot_date TEXT    NOT NULL,                  -- YYYY-MM-DD (UTC)
  captured_at   TEXT    NOT NULL,                  -- full ISO timestamp
  stars         INTEGER NOT NULL,
  forks         INTEGER NOT NULL,
  watchers      INTEGER,
  open_issues   INTEGER,
  open_prs      INTEGER,
  PRIMARY KEY (repo_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON repo_metrics_daily (snapshot_date);

-- ------------------------------------------------------ derived velocity
CREATE TABLE IF NOT EXISTS repo_velocity (
  repo_id       INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  snapshot_date TEXT    NOT NULL,
  stars         INTEGER NOT NULL,
  d1            REAL,   -- stars gained over the 1-day window
  d7            REAL,   -- ... 7-day window, normalised if the gap is uneven
  d30           REAL,
  vel_1d        REAL,   -- stars per day
  vel_7d        REAL,
  vel_30d       REAL,
  accel         REAL,   -- vel_7d - vel_30d: is it speeding up or cooling off?
  rel_7d        REAL,   -- d7 / stars_7d_ago: relative growth, favours small repos
  PRIMARY KEY (repo_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_velocity_date_v7 ON repo_velocity (snapshot_date, vel_7d DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_date_v1 ON repo_velocity (snapshot_date, vel_1d DESC);

-- -------------------------------------------- backfilled star timestamps
-- Built from REST /stargazers with the star+json media type, which exposes
-- starred_at. Gives real history on day one instead of waiting two weeks.
CREATE TABLE IF NOT EXISTS star_history (
  repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  day        TEXT    NOT NULL,                     -- YYYY-MM-DD (UTC)
  stars_new  INTEGER NOT NULL,                     -- stars added that day
  stars_cum  INTEGER,                              -- cumulative, when derivable
  source     TEXT    NOT NULL DEFAULT 'stargazers_api',
  PRIMARY KEY (repo_id, day)
);

CREATE TABLE IF NOT EXISTS star_backfill_state (
  repo_id        INTEGER PRIMARY KEY REFERENCES repos(id) ON DELETE CASCADE,
  attempted_at   TEXT NOT NULL,
  status         TEXT NOT NULL,   -- ok | partial | out_of_reach | error
  pages_fetched  INTEGER NOT NULL DEFAULT 0,
  oldest_day     TEXT,
  newest_day     TEXT,
  note           TEXT
);

-- ------------------------------------------------------------ run ledger
CREATE TABLE IF NOT EXISTS collector_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  kind              TEXT NOT NULL,                 -- discover | snapshot | velocity | backfill | run
  started_at        TEXT NOT NULL,
  finished_at       TEXT,
  status            TEXT NOT NULL DEFAULT 'running',
  repos_discovered  INTEGER NOT NULL DEFAULT 0,
  repos_snapshotted INTEGER NOT NULL DEFAULT 0,
  api_calls         INTEGER NOT NULL DEFAULT 0,
  graphql_points    INTEGER NOT NULL DEFAULT 0,
  rows_written      INTEGER NOT NULL DEFAULT 0,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_kind ON collector_runs (kind, started_at DESC);

-- --------------------------------------------------- discovery bookkeeping
CREATE TABLE IF NOT EXISTS discovery_cursors (
  query_key    TEXT PRIMARY KEY,
  last_run_at  TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  capped       INTEGER NOT NULL DEFAULT 0          -- hit the 1000-result ceiling
);
