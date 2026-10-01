import type { MetadataRoute } from 'next';
import { LOCALES, absoluteUrl, type Locale } from '@/lib/i18n';
import { getLanguages, getSiteStats, getTopOwners, queryAllPublishedRepos } from '@/lib/sitemapData';
// `output: export` has no server to build this on request, so it must be
// generated once at build time.
export const dynamic = 'force-static';

/**
 * The sitemap must agree with the robots meta tag on every page. A page that
 * says `noindex` but appears in the sitemap is a contradiction crawlers punish,
 * so repo pages only appear here once they have an original review — which is
 * exactly the condition that flips them to indexable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const stats = getSiteStats();
  const lastModified = stats.lastDay ? new Date(`${stats.lastDay}T00:00:00Z`) : new Date();

  const paths: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' },
    { path: '/trending/daily', priority: 0.9, changeFrequency: 'daily' },
    { path: '/trending/weekly', priority: 0.9, changeFrequency: 'daily' },
    { path: '/trending/monthly', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/languages', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/rankings', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/methodology', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  ];

  for (const lang of getLanguages(80)) {
    paths.push({
      path: `/languages/${encodeURIComponent(lang.language.toLowerCase())}`,
      priority: 0.6,
      changeFrequency: 'daily',
    });
  }

  for (const owner of [...getTopOwners('Organization', 60), ...getTopOwners('User', 60)]) {
    paths.push({ path: `/users/${owner.owner}`, priority: 0.5, changeFrequency: 'weekly' });
  }

  const published = queryAllPublishedRepos();
  for (const repo of published) {
    paths.push({ path: `/repo/${repo.fullName}`, priority: 0.7, changeFrequency: 'weekly' });
  }

  console.log(
    `[build] sitemap: ${paths.length} path(s) x ${LOCALES.length} locales. ` +
    `Repo pages included: ${published.length} (only repos with an original review are indexable).`,
  );

  return paths.flatMap(entry =>
    LOCALES.map((locale: Locale) => ({
      url: absoluteUrl(locale, entry.path),
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: {
          en: absoluteUrl('en', entry.path),
          vi: absoluteUrl('vi', entry.path),
        },
      },
    })),
  );
}
