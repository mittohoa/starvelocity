# StarVelocity

Tracks GitHub repositories and measures **how fast they are actually gaining
stars**, not how many stars they have in total.

That distinction is the whole point. Ranking by total stars puts the same
decade-old repositories on top forever. Ranking by Δstars/day surfaces what is
climbing right now — which is what a discovery product is for.

Velocity cannot be computed from a single observation. It needs a time series,
and the series only exists if something has been recording it. **That is why the
collector comes first**, before any web, Android or Windows UI is written.

---

## Requirements

Node.js **22.18 or newer**. Nothing else.

- TypeScript runs directly — Node strips the types, so there is no build step.
- SQLite comes from the built-in `node:sqlite` module, so there is no native
  module to compile and nothing to install on Windows.

`npm install` is only needed if you want `npm run typecheck` (it pulls
`typescript` and `@types/node` as dev dependencies). The collector itself runs
with zero dependencies installed.

## Quickstart

```bash
cp .env.example .env         # then put a GitHub token in it
npm run migrate              # create the SQLite schema
npm run run                  # discover -> snapshot -> velocity -> score
npm run stats                # see what landed
```

The token needs **no scopes at all** — every request reads public data. A
classic PAT created with nothing checked works and gets the full 5,000 req/hour
budget.

Then schedule it (see [Running it for free](#running-it-for-free)) and leave it
alone. Velocity fills in as history accumulates:

| After          | What becomes available |
| -------------- | ---------------------- |
| first run      | star/fork totals, quality scores, rankings by total stars |
| second day     | `1d` velocity |
| one week       | `7d` velocity, relative growth, acceleration |
| one month      | `30d` velocity — acceleration becomes meaningful |

## Commands

```
npm run migrate                       create or upgrade the schema
npm run discover                      find repos via the Search API
npm run snapshot                      capture today's metrics
npm run velocity                      derive 1d/7d/30d velocity
npm run score                         recompute quality scores and lifecycle
npm run backfill -- --limit=100       import starred_at history, if the token allows it
npm run run                           full cycle (this is what the scheduler calls)
npm run stats                         what the database holds
npm run top -- --window=7d            ranking by velocity
```

Useful flags:

```
--window=1d|7d|30d     velocity window for `top`          (default 7d)
--sort=abs|rel|accel   absolute gain, relative growth, or acceleration
--lang=Rust            filter `top` by primary language
--limit=N              row limit / work limit
--date=YYYY-MM-DD      operate on a specific snapshot day
--force                run discovery even if it ran recently
--skip-discover        skip discovery (useful on a tight search budget)
```

## How it works

```
discover ──► repos                    Search API, sliced to beat the 1000-result cap
   │
snapshot ──► repo_metrics_daily       one row per repo per UTC day (GraphQL, batched)
   │
velocity ──► repo_velocity            deltas against 1/7/30 days ago
   │
score    ──► repos.quality_score      metadata-only gate, sets lifecycle
```

### Discovery

Search only ever returns the first 1,000 matches per query, so discovery slices
the star axis into buckets (`stars:>=100000`, `stars:60000..99999`, …) and the
time axis by creation date, then slices again by language where a bucket is
still too dense.

The budget is split across three passes rather than first-come-first-served:

| Pass     | Share | Finds |
| -------- | ----- | ----- |
| `new`    | 45%   | created in the last 180 days with ≥50 stars |
| `top`    | 35%   | highest-starred repos overall — the stable backbone |
| `active` | 20%   | pushed in the last week with ≥500 stars — projects coming back to life |

Without the split, the `top` pass would consume every free slot and the rising
repos the product exists to surface would never get imported. Unspent allocation
is swept back into `top`, which always has more to give.

When a query hits the 1,000-result ceiling the run **logs it as partial
coverage**. A silent truncation reads as "we covered everything", which is worse
than a smaller number you can trust.

### Snapshot

One batched GraphQL document fetches 50 repositories. Measured: **1 rate-limit
point per batch regardless of size**, so a 5,000-repo pass costs about 100 of the
5,000 points available per hour.

Batch size is 50 rather than 100 for a measured reason. GitHub enforces a
per-query *resource* limit separately from the points budget, and
`pullRequests(states: OPEN) { totalCount }` is expensive enough that 100 aliases
gets the whole document rejected with `Resource limits for this query exceeded`
while 50 succeeds. Because the threshold depends on which repos happen to land
in the same batch, the snapshot step also **halves a batch and retries** when a
request is refused, down to a floor of 5. Anything still refused there is
reported, not silently dropped.

Snapshots are keyed by `(repo_id, snapshot_date)`, so:

- a crashed run resumes instead of starting over;
- running twice a day is safe — the later reading replaces the earlier one;
- a cron that fires late still lands on the correct UTC day.

### Velocity

For each window *n* ∈ {1, 7, 30} the collector finds the most recent
observation at or before `today − n` days, within a tolerance (2/5/14 days
respectively), and normalises by the real gap:

```
vel_nd = (stars_now − stars_then) / actual_gap_days
d_nd   = vel_nd × n
```

Normalising matters because a missed run leaves an uneven gap, and comparing a
raw 6-day delta against a raw 8-day delta would rank repos by scheduler luck.

Derived columns:

- `accel` = `vel_7d − vel_30d` — speeding up or cooling off
- `rel_7d` = `d7 / stars_7d_ago` — relative growth, which favours small repos
  breaking out over large repos ticking along

**When there is no earlier observation the window stays `NULL`, never `0`.**
Zero means "gained nothing"; null means "we do not know". Conflating them would
produce exactly the kind of invented figure this project is supposed to avoid.

### Quality gate

`score` rates each repo on verifiable GitHub metadata only — description
substance, log-scaled stars, fork-to-star ratio, topic count, push recency,
license — and maps the result onto a lifecycle:

| Score   | Lifecycle      | Meaning |
| ------- | -------------- | ------- |
| < 10    | `rejected`     | not worth a page |
| < 35    | `draft`        | tracked, not publishable |
| < 60    | `needs_review` | borderline |
| ≥ 60    | `seo_ready`    | metadata good enough to build a page on |
| —       | `published`    | set by hand, only with an original review |

The scorer is deliberately blind to page text, so a page can never be promoted
by padding it with words. It never grants `published` on its own, and it never
demotes a repo a human already published or rejected.

## Measured constraints

Findings from probing the live API, recorded here so they do not have to be
rediscovered:

**1. GraphQL resource limit is independent of the points budget.** A batch of
100 repositories including the open-PR count is rejected outright even though
its cost is 1 point. Handled by a smaller default batch plus adaptive halving.

**2. Star timestamp history is not available.** REST `/stargazers` answers
`404` with a token and `401` without one, and the GraphQL `stargazers`
connection reports `totalCount: 0` with no edges for a repo whose
`stargazerCount` is 510,090. Other user connections on the same repo
(`watchers`, `mentionableUsers`) work normally, so the restriction is specific
to stargazers. REST `/subscribers` is blocked the same way.

Consequence: **there is no shortcut to history — velocity has to accumulate from
the daily snapshots.** Start the scheduler today; a week of waiting cannot be
bought back later.

`npm run backfill` probes this capability with one cheap query and reports it as
unavailable rather than marking thousands of repos as failed. If a different
token or network path ever exposes the connection, the GraphQL pagination
already written runs unchanged — and unlike the REST route it has no 40,000-
stargazer ceiling.

## Running it for free

Everything below stays inside free plans. Verify current quotas before relying
on them; providers change them.

### Recommended: GitHub Actions

`.github/workflows/collect.yml` runs the cycle twice a day.

- **On a public repository, Actions minutes are unmetered.** A private repo on
  the free plan gets 2,000 minutes/month, and this job uses roughly 15–20
  minutes per run — about 1,200/month at twice daily, which fits but leaves
  little room.
- The database is stored as a **release asset**, not committed to git. A growing
  binary committed daily would balloon the repository; a release asset is
  replaced in place and costs nothing.
- GitHub **disables scheduled workflows after 60 days of repository
  inactivity**. The workflow's keepalive step commits a dated marker to prevent
  that.
- Cron firing is best-effort and can be delayed. Harmless here, because rows are
  keyed by UTC day.

Set a `COLLECTOR_TOKEN` secret (a scopeless classic PAT) to get the full
5,000 req/hour budget. Without it the workflow falls back to the built-in
`GITHUB_TOKEN`, which is capped at 1,000 requests/hour per repository — still
enough for one cycle, but with less headroom.

### Alternative: this machine

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1
```

Registers a Windows scheduled task that runs the cycle twice daily and appends
to `logs\collect.log`. It refuses to register if Node is too old or `.env` has
no token, rather than creating a task that silently fails. Remove it with
`-Unregister`.

Use one scheduler or the other against a given database, not both.

### Quota headroom

All figures below were **measured on a real 5,000-repo cycle**, not estimated.

| Resource | Used per cycle | Free allowance | Headroom |
| -------- | -------------- | -------------- | -------- |
| GraphQL points | ~100 (1 per 50-repo batch) | 5,000 / hour | 50× |
| Search requests | 69 for a full discovery | 30 / minute, throttled to 2.1s apart | fits |
| REST requests | negligible | 5,000 / hour | — |
| Wall clock | 4 min discover + 11 min snapshot | Actions unmetered on a public repo | — |
| Row writes | 15,000 (5k metrics + 5k velocity + 5k repo updates) | 100,000 / day on Cloudflare D1 | 6.6× |

Database size, measured by replaying 14 synthetic days over the real 5,000-repo
set:

| | |
| - | - |
| 5,000 repos, 1 day of history | 4.72 MB |
| growth per day | **1.13 MB** |
| projected after 1 year | 419 MB |
| gzipped (what the release asset stores) | ~4.6× smaller, so ~90 MB/year |

That fits D1's 5 GB and GitHub's 2 GB-per-asset limit for years. If it ever gets
uncomfortable, roll daily rows older than ~90 days up into weekly averages —
nobody needs day-level resolution from eighteen months ago.

The `MAX_TRACKED_REPOS` cap (default 5,000) is what keeps every number above
inside the free tiers. Row writes, minutes and storage all scale roughly
linearly with it, so recheck this table before raising it.

### Phase 2 onward, still free

| Piece | Free option | Note |
| ----- | ----------- | ---- |
| Database | **Cloudflare D1** | it *is* SQLite, so `src/db/schema.sql` ports as-is; 5 GB, 100k row writes/day |
| API | **Cloudflare Workers** | 100k requests/day |
| Web | **Cloudflare Pages** or **Vercel Hobby** | Pages: unlimited requests, 500 builds/month |
| Android distribution | **GitHub Releases** or **F-Droid** | Google Play costs $25 one-time |
| Push notifications | **Firebase Cloud Messaging** | free, unmetered |
| Windows distribution | **GitHub Releases**, **Scoop**, **winget** | unsigned builds trigger a SmartScreen warning; code-signing certificates cost money |

Choosing `node:sqlite` was deliberate: the same schema and the same SQL run
locally and on D1, so moving to the cloud is a connection change rather than a
rewrite.

## Schema

| Table | Holds |
| ----- | ----- |
| `repos` | current metadata, latest star/fork counts, quality score, lifecycle |
| `repo_metrics_daily` | **the time series** — one row per repo per UTC day |
| `repo_velocity` | derived deltas and per-day rates per window |
| `star_history` | backfilled daily star counts, when obtainable |
| `star_backfill_state` | per-repo backfill outcome, including why it failed |
| `collector_runs` | run ledger: timings, API spend, row counts, errors |
| `discovery_cursors` | per-query bookkeeping, including which queries were capped |

Renames are followed automatically (GraphQL reports the current
`nameWithOwner`), and a repo that disappears gets `gone_at` set rather than
being deleted, so its history survives.

---

# The web (phase 2)

Lives in [`web/`](web/). A Next.js 16 site built as a **fully static export**.

## Why static

The collector runs twice a day. Between runs nothing changes, so there is
nothing to compute per request — which means no database to host, no server to
run, and no runtime bill. The site is a pure function of the collector database,
rebuilt whenever that database changes.

That decision is what makes the whole stack free rather than merely cheap:
Cloudflare D1, Workers and any Postgres host drop out of the architecture
entirely.

## Running it

```bash
cd web
npm install
npm run build     # reads ../data/starvelocity.db, writes out/
npm start         # serve the built site locally
npm run dev       # iterate with hot reload
```

Environment:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `DB_PATH` | `../data/starvelocity.db` | collector database to build from |
| `SITE_URL` | `https://starvelocity.example` | **origin only** — used for canonical and hreflang URLs |
| `BASE_PATH` | *(empty)* | set to `/<repo>` for a GitHub Pages project site |
| `REPO_PAGE_LIMIT` | `600` | repo pages to build per locale |

## What it builds

| Route | Both locales |
| ----- | ------------ |
| `/` | home: stats, biggest movers, language grid |
| `/trending/{daily,weekly,monthly}` | ranked by star gain over 1d / 7d / 30d |
| `/repo/{owner}/{name}` | detail, star-history chart, metadata, related repos |
| `/languages` and `/languages/{slug}` | per-language rankings |
| `/rankings` and `/users/{owner}` | owner aggregates |
| `/methodology` | how the numbers are produced, rendered from live data |

English sits at the root and Vietnamese under `/vi`, because the default locale
should not carry a prefix — the root URL is the one that accumulates authority.
Each locale gets its own root layout via a route group, so `<html lang>` is
genuinely correct rather than hard-coded to English.

## Honesty in the UI

Velocity does not exist until the collector has history. Rather than printing
zeros, every ranking reports which basis it actually used:

- a resolved window renders real figures (`+49 ★/7d`, `7.00/day`, `↑ speeding up`);
- an unresolved one falls back to total stars, labels each row **"not yet
  known"**, and shows a banner stating how many more days of recording the
  window needs.

Zero would claim a repo gained nothing. Unknown is not zero — and a stars
ranking presented as a velocity ranking would be exactly the dishonesty the
methodology page promises to avoid.

## The indexing gate

Two mechanisms have to agree, or crawlers punish the contradiction:

- a repo page without an original review renders `noindex, follow`;
- the same page is excluded from `sitemap.xml`.

Listing pages carry real derived content and are indexable. Repo pages become
indexable only when someone has written about them, which is why the sitemap
currently reports `Repo pages included: 0` — nothing has a review yet. That is
the gate working, not a bug.

## Design system

The visual language was rebuilt to reference topgit.dev's layout and typography,
which is a deliberate choice rather than an accident of taste:

- **Inter** for body text and **JetBrains Mono** for repository names and every
  figure, both self-hosted via `next/font` — the published page makes no request
  to Google and has no runtime external dependency. Headings use a system
  grotesque stack (`Helvetica Neue`/`Arial`), which costs zero bytes.
- A warm-neutral palette: background, surfaces and borders all carry a faint
  magenta cast tying them to the accent. Pure grey beside a magenta accent reads
  as two unrelated systems.
- A two-column hero (headline + live "Rising stars" panel), a three-column card
  grid with podium-coloured rank badges, and monospaced tabular figures so
  numbers never jitter between rows.

Vietnamese and English both get the full treatment, including locale-correct
number and date formatting (`5.000` / `25 thg 9, 2026`).

## Dark mode

Three states, not two: light, dark, and follow-the-system.

- The light palette is defined once on `:root`; dark is declared twice — under
  `prefers-color-scheme` guarded by `:not([data-theme='light'])`, and again
  under `[data-theme='dark']` — so an explicit choice wins in both directions.
- A tiny inline script applies the stored choice **before first paint**, so a
  viewer who chose dark never gets a white flash on navigation.
- "System" is represented by the *absence* of the attribute, which is what lets
  the media query take back over.

## Quick menu

Fixed bottom-right, and the only interactive JavaScript on the site:

| Button | Does |
| ------ | ---- |
| ✦ | Opens **ChatGPT / Claude / Perplexity / Google AI** with this page's content already written into the prompt |
| EN / VI | Jumps to the same page in the other language |
| ☀/🌙/🖥 | Cycles light → dark → system |
| ↑ | Back to top, appearing only once there is something to scroll back from |

The AI prompt is built per page: a repository page hands over its name,
description, stars, forks, licence, topics and 7-day velocity — including
"velocity is not yet available" when that is the truth. Nothing is sent
anywhere until the reader picks an assistant.

## Static JSON API

`scripts/emit-api.mjs` writes a small read-only API into `out/api/` during the
build, so the Android and desktop clients have something to read without
standing up a server — which would have put the first real running cost into an
otherwise free stack.

| Endpoint | Contents |
| -------- | -------- |
| `meta.json` | repo count, days of history, which windows are resolved |
| `trending-{1d,7d,30d}.json` | top 100, with `basis` naming what it is ranked by |
| `languages.json` | every tracked language with its slug |
| `lang/{slug}.json` | top 50 for one language |

45 files, 633 KB total. `delta` is `null` — never `0` — when a window is not yet
derivable, so clients can tell "gained nothing" from "we do not know". Language
slugs spell symbols out (`cplusplus`, `csharp`) rather than percent-encoding
them, which keeps paths readable and avoids C# and C++ colliding on `c`.


## Measured build

| | |
| - | - |
| pages built (600 repos x 2 locales + listings) | 1,591 |
| build time | 93 s |
| output size | **63 MB** |

One finding worth recording: Next emits four React Server Component prefetch
payloads per page (`index.txt`, `__PAGE__.txt`, `__next._full.txt`,
`__next._tree.txt`) so its client router can navigate without a full page load.
This site navigates with plain `<a href>` anchors and imports `next/link`
nowhere, so those files are never requested — and they came to **91.7 MB across
6,357 files**, more than the HTML itself. `scripts/prune-rsc.mjs` removes them
after every build, taking the output from 168 MB to 63 MB. If the site ever
adopts `next/link`, drop that script from the build.

## Deploying it free

`.github/workflows/web.yml` rebuilds and publishes to **GitHub Pages** whenever
the `collect` workflow succeeds. On a public repository that is free and
unmetered; Pages allows 1 GB of storage and 100 GB of bandwidth a month, against
63 MB of output.

Repository variables:

- `SITE_URL` — the origin, e.g. `https://yourname.github.io`
- `BASE_PATH` — `/starvelocity` for a project site; leave unset for a user page,
  an org page, or a custom domain

Cloudflare Pages works identically if you prefer it — the build output is just
static files.


---

# Android (phase 3)

Lives in [`android/`](android/). Kotlin + Jetpack Compose, reading the static
JSON API — so the app has no backend of its own.

## Stack

| | |
| - | - |
| Gradle | 9.8.0 |
| Android Gradle Plugin | 9.4.1 |
| Kotlin | 2.2.10 |
| Compose BOM | 2026.09.00 |
| compileSdk | 37 |
| min / target SDK | 26 / 36 |

These are the versions the build actually succeeds on, not a guess. Three of
them are load-bearing in ways that are easy to get wrong:

- **No `org.jetbrains.kotlin.android` plugin.** AGP 9.0 compiles Kotlin itself
  and *rejects* the plugin outright: `The 'org.jetbrains.kotlin.android' plugin
  is no longer required for Kotlin support since AGP 9.0`.
- **Kotlin pinned to 2.2.10**, the version AGP 9 bundles. Asking for a newer KGP
  requires a `buildscript` classpath override, which buys nothing here.
- **compileSdk 37**, because Compose BOM 2026.09 refuses to be compiled against
  anything lower (`platforms;android-37.0` has to be installed).

`local.properties` uses forward slashes on purpose — it is a Java properties
file, where `C:\Users\...` silently decodes to a broken path.

Networking is plain `HttpURLConnection` plus `kotlinx.serialization`: there are
five GET requests in the whole app, and a client library would not earn its
place.

## What it does

- **Feed** with 1d / 7d / 30d tabs and a language filter row.
- **Offline-first.** Responses are cached to disk and served when the network
  fails; the banner says how old the copy is. Data changes twice a day, so a
  cached answer is almost always current — and a commuter underground sees
  yesterday's ranking instead of an error.
- **Honest about basis**, exactly like the web: when velocity is not derivable
  the list falls back to total stars, each row reads "not yet known", and a
  banner explains why.
- **Repository detail** in a bottom sheet, with a link out to GitHub.
- **Daily digest** via WorkManager: refreshes the cache in the background and
  posts one notification naming what actually climbed. It **stays silent while
  velocity is unavailable** — "here are the biggest repositories" is not news,
  it is yesterday's list, and that is how an app earns a permanent mute.
- **Theme** follows the system by default, with a light/dark override.
- **English and Vietnamese** through `values/` and `values-vi/`.

## Design and motion

The app shares the web's palette and monospaced-figure treatment, but not its
furniture. Phone-sized cards with borders, dividers and chip rows read as
clutter, so the list is deliberately flat:

- **One loud element per card** — the star gain. Everything else is muted type.
- **Rank as plain numerals** (`01`, `02`), with podium colour for the top three
  instead of a chip around every number.
- **Metadata as a single line** (`★ 549k · ⑂ 52k · ● Markdown`) rather than four
  pills.
- **The velocity bar**: a 3dp rule under each card, its width the repository's
  share of the fastest climber's gain. It shows the shape of the distribution,
  not just the order — and it is **absent entirely when velocity is unknown**,
  because a bar of zero length would claim the repository gained nothing.

Motion follows one rule: **springs for what the user caused, short tweens for
what the app caused.**

| Element | Motion |
| ------- | ------ |
| Window tabs | indicator springs between segments — a slide shows *which way* the selection moved, which a cross-fade cannot |
| List entry | fade + 14dp lift, staggered 35 ms per item, capped at 8 so scrolling never feels delayed |
| Window / language change | 220 ms cross-fade between lists |
| Card press | scales to 97.5% on a stiff spring |
| Velocity bar | grows over 650 ms |
| Status banner | expands and collapses rather than appearing |

## The mark

A four-point spark pulling away to the upper right, trailed by two motion
strokes. The product measures how fast a repository gains stars, so the mark is
a star *in motion* rather than a star at rest.

It is drawn inside the 66dp adaptive-icon safe zone so no mask clips it, and the
in-app `BrandMark` renders the same vector as the launcher icon — they cannot
drift apart. The notification variant is the same shape reduced to solid fills:
Android discards everything but the alpha channel there, so strokes and
opacities would vanish.


## Building

```bash
cd android
./gradlew assembleDebug -Pstarvelocity.apiBase=https://<your-site>/api/
```

`apiBase` defaults to the placeholder host, so point it at your deployment or
the app will have nothing to read.

Against a local copy of the site, serve `web/out` and bridge the port rather
than relying on the emulator's NAT address:

```bash
adb reverse tcp:4324 tcp:4324
./gradlew assembleDebug -Pstarvelocity.apiBase=http://localhost:4324/api/
```

Debug builds carry a network-security config permitting cleartext to
`localhost` and `10.0.2.2` only; release builds keep the platform default, so
plain HTTP stays blocked where it matters.

## Verified on device

Built and run on an emulator (`Pixel_6_Pro`, API 37):

| | |
| - | - |
| APK | 13.1 MB debug |
| Launch | no crash, first frame 8.3 s cold |
| Data | real repositories and star counts over the JSON API |
| Locale | switched to Vietnamese from the system setting |
| Theme | followed the system into dark |
| Background work | `Starting work for DigestWorker` confirmed in logcat |

The honesty rule survives the whole chain: the collector stores `NULL`, the API
emits `delta: null`, and the app renders "chua xac dinh" per row with a banner
explaining that the list is ordered by total stars instead.

## Not built yet

Stated rather than quietly omitted:

- Home-screen widget.
- GitHub OAuth personalisation (read your starred repos, infer your stack).
- Star-history chart on the detail sheet — it needs the per-repo history
  endpoint, which the API does not publish yet.


## Roadmap

- **Phase 1 — this repo.** Collector, schema, daily snapshots, velocity. ✅
- **Phase 2 — web.** Next.js static export in `web/`: trending pages, repo
  detail with a star-history chart, page-per-entity, bilingual, the lifecycle
  gate deciding what gets indexed. ✅
- **Phase 3 — Android.** Kotlin + Compose in `android/`: feed, offline cache,
  daily digest notification, bilingual, themed. Widget and OAuth still open.
- **Phase 4 — Windows.** Tauri v2 reusing the web frontend: side-by-side repo
  comparison, CSV/Markdown export, dependency-aware suggestions, tray alerts.
- **Phase 5 — personalisation.** GitHub OAuth: read the repos you starred,
  infer your stack, rank against it.
