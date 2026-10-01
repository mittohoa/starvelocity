import { db, tx } from '../db/index.ts';
import { log } from '../log.ts';

/**
 * Quality gate. Scores only verifiable GitHub metadata — never page text — so
 * a page can never be inflated by padding it with words. Reaching `seo_ready`
 * means the metadata is good enough to build a page on; going `published` still
 * requires an original human-written review, which this never grants.
 */

interface ScoreRow {
  id: number;
  description: string | null;
  stars: number;
  forks: number;
  topics: string;
  license_spdx: string | null;
  is_fork: number;
  is_archived: number;
  gh_pushed_at: string | null;
  lifecycle: string;
}

export interface ScoreStats {
  scored: number;
  draft: number;
  needsReview: number;
  seoReady: number;
  rejected: number;
  untouched: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function scoreRepo(r: ScoreRow): number {
  let score = 0;

  // Substance of the description: a one-word blurb is not a description.
  const desc = (r.description ?? '').trim();
  if (desc.length === 0) score -= 15;
  else score += clamp(desc.length / 8, 0, 20);

  // Popularity, log-scaled so 100k stars does not swamp everything else.
  score += clamp(Math.log10(Math.max(r.stars, 1)) * 7, 0, 30);

  // Forks relative to stars: people actually using it, not just bookmarking it.
  if (r.stars > 0) score += clamp((r.forks / r.stars) * 120, 0, 15);

  // Topics are a deliberate curation signal from the maintainer.
  let topicCount = 0;
  try { topicCount = (JSON.parse(r.topics) as unknown[]).length; } catch { topicCount = 0; }
  score += clamp(topicCount * 2, 0, 10);

  // Recent activity.
  if (r.gh_pushed_at) {
    const days = (Date.now() - Date.parse(r.gh_pushed_at)) / 86_400_000;
    if (days <= 30) score += 15;
    else if (days <= 90) score += 10;
    else if (days <= 365) score += 4;
    else score -= 8;
  }

  if (r.license_spdx && r.license_spdx !== 'NOASSERTION') score += 5;

  if (r.is_archived) score -= 20;
  if (r.is_fork) score -= 30;

  return Math.round(score * 10) / 10;
}

function lifecycleFor(score: number): 'draft' | 'needs_review' | 'seo_ready' | 'rejected' {
  if (score < 10) return 'rejected';
  if (score < 35) return 'draft';
  if (score < 60) return 'needs_review';
  return 'seo_ready';
}

export function scoreAll(): ScoreStats {
  const rows = db().prepare(
    `SELECT id, description, stars, forks, topics, license_spdx,
            is_fork, is_archived, gh_pushed_at, lifecycle
       FROM repos
      WHERE gone_at IS NULL`,
  ).all() as unknown as ScoreRow[];

  const stats: ScoreStats = { scored: 0, draft: 0, needsReview: 0, seoReady: 0, rejected: 0, untouched: 0 };

  const update = db().prepare(`UPDATE repos SET quality_score = ?, lifecycle = ? WHERE id = ?`);
  const scoreOnly = db().prepare(`UPDATE repos SET quality_score = ? WHERE id = ?`);

  tx(() => {
    for (const r of rows) {
      const score = scoreRepo(r);
      stats.scored++;

      // A human decision outranks the scorer: never demote a published page or
      // resurrect one someone rejected on purpose.
      if (r.lifecycle === 'published') {
        scoreOnly.run(score, r.id);
        stats.untouched++;
        continue;
      }

      const next = lifecycleFor(score);
      update.run(score, next, r.id);
      if (next === 'draft') stats.draft++;
      else if (next === 'needs_review') stats.needsReview++;
      else if (next === 'seo_ready') stats.seoReady++;
      else stats.rejected++;
    }
  });

  log.info(
    `scored ${stats.scored} repos · seo_ready ${stats.seoReady} · needs_review ${stats.needsReview} · ` +
    `draft ${stats.draft} · rejected ${stats.rejected} · published(kept) ${stats.untouched}`,
  );
  return stats;
}
