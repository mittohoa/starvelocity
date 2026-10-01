import { queryAll } from './db';
import { INDEXABLE_LIFECYCLE } from './queries';

export { getLanguages, getSiteStats, getTopOwners } from './queries';

/**
 * Every repo eligible to appear in the sitemap — that is, every repo whose page
 * is actually indexable. Unlike the page-building query this is deliberately
 * uncapped: if a page is indexable it belongs in the sitemap, full stop.
 */
export function queryAllPublishedRepos(): { fullName: string }[] {
  return queryAll<{ full_name: string }>(
    `SELECT full_name
       FROM repos
      WHERE gone_at IS NULL AND lifecycle = ?
      ORDER BY stars DESC`,
    INDEXABLE_LIFECYCLE,
  ).map(r => ({ fullName: r.full_name }));
}
