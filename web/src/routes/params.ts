import { getBuildableRepoSlugs, getLanguages, getTopOwners } from '@/lib/queries';

/**
 * Static params for every dynamic route, shared by both locales so the two
 * language trees can never drift out of sync.
 */

/**
 * How many repo pages to build per locale.
 *
 * 5,000 repos across two locales is 10,000 pages, which makes every build slow
 * while most of those repos have no review yet. The cap is logged rather than
 * applied silently — a truncated build that looks complete is worse than a
 * smaller one you can trust.
 */
const REPO_PAGE_LIMIT = Number(process.env.REPO_PAGE_LIMIT ?? 600);

let capReported = false;

export function repoParams(): { owner: string; name: string }[] {
  const { slugs, total } = getBuildableRepoSlugs(REPO_PAGE_LIMIT);
  if (!capReported) {
    capReported = true;
    if (total > slugs.length) {
      console.log(
        `[build] repo pages: building ${slugs.length} of ${total} eligible repos ` +
        `(REPO_PAGE_LIMIT=${REPO_PAGE_LIMIT}). ${total - slugs.length} not built.`,
      );
    } else {
      console.log(`[build] repo pages: building all ${slugs.length} eligible repos.`);
    }
  }
  return slugs;
}

export function languageParams(): { slug: string }[] {
  return getLanguages(80).map(l => ({ slug: l.language.toLowerCase() }));
}

export function ownerParams(): { owner: string }[] {
  const orgs = getTopOwners('Organization', 60);
  const users = getTopOwners('User', 60);
  return [...orgs, ...users].map(o => ({ owner: o.owner }));
}

export function trendingParams(): { period: string }[] {
  return [{ period: 'daily' }, { period: 'weekly' }, { period: 'monthly' }];
}
