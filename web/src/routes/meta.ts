import type { Metadata } from 'next';
import { SITE, t, type Locale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { fmtCompact } from '@/lib/format';
import { getRepo, getSiteStats, isIndexable, type TrendingPeriod } from '@/lib/queries';
import { resolveLanguage } from '@/views/LanguageViews';

/**
 * Metadata per page type.
 *
 * The `indexable` flag is the important part. Listing pages carry real, derived
 * content and are indexable; a repo page is only indexable once it has an
 * original review, which keeps thousands of thin pages out of the index.
 */

export function homeMeta(locale: Locale): Metadata {
  const d = t(locale);
  const stats = getSiteStats();
  return pageMetadata({
    locale,
    path: '/',
    title: `${SITE.name} — ${d.home.tagline}`,
    description: `${d.home.intro} ${stats.repos} repos.`.slice(0, 300),
    indexable: true,
    keywords: ['github trending', 'star velocity', 'open source discovery'],
  });
}

export function trendingMeta(locale: Locale, period: TrendingPeriod): Metadata {
  const d = t(locale);
  return pageMetadata({
    locale,
    path: `/trending/${period}`,
    title: `${d.trending.title[period]} — ${SITE.name}`,
    description: d.trending.subtitle[period],
    indexable: true,
  });
}

export function repoMeta(locale: Locale, owner: string, name: string): Metadata {
  const repo = getRepo(owner, name);
  if (!repo) return { title: 'Not found', robots: { index: false, follow: false } };

  const d = t(locale);
  const facts = [
    `★ ${fmtCompact(repo.stars)}`,
    repo.language ?? null,
    repo.delta !== null ? `${repo.delta > 0 ? '+' : ''}${fmtCompact(repo.delta)} ★/7d` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return pageMetadata({
    locale,
    path: `/repo/${repo.fullName}`,
    title: `${repo.fullName} — ${facts}`,
    description: repo.description ?? `${repo.fullName}: ${facts}. ${d.repo.chartTitle}.`,
    indexable: isIndexable(repo),
    keywords: repo.topics.slice(0, 6),
  });
}

export function languagesMeta(locale: Locale): Metadata {
  const d = t(locale);
  return pageMetadata({
    locale,
    path: '/languages',
    title: `${d.languages.title} — ${SITE.name}`,
    description: d.languages.subtitle,
    indexable: true,
  });
}

export function languageDetailMeta(locale: Locale, slug: string): Metadata {
  const d = t(locale);
  const language = resolveLanguage(slug);
  if (!language) return { title: 'Not found', robots: { index: false, follow: false } };
  return pageMetadata({
    locale,
    path: `/languages/${encodeURIComponent(language.toLowerCase())}`,
    title: `${d.languages.inLanguage(language)} — ${SITE.name}`,
    description: `${d.languages.inLanguage(language)}. ${d.trending.subtitle.weekly}`,
    indexable: true,
    keywords: [language, 'trending'],
  });
}

export function rankingsMeta(locale: Locale): Metadata {
  const d = t(locale);
  return pageMetadata({
    locale,
    path: '/rankings',
    title: `${d.nav.rankings} — ${SITE.name}`,
    description:
      locale === 'vi'
        ? 'Tổng hợp theo chủ sở hữu trong tập repo đang theo dõi, xếp theo tổng star.'
        : 'Aggregated by owner across the tracked set, ordered by total stars.',
    indexable: true,
  });
}

export function ownerMeta(locale: Locale, owner: string): Metadata {
  const d = t(locale);
  return pageMetadata({
    locale,
    path: `/users/${owner}`,
    title: `${d.owners.reposBy(owner)} — ${SITE.name}`,
    description: d.owners.reposBy(owner),
    indexable: true,
  });
}

export function aboutMeta(locale: Locale): Metadata {
  const d = t(locale);
  return pageMetadata({
    locale,
    path: '/about',
    title: `${d.about.title} — ${SITE.name}`,
    description: d.about.lead,
    indexable: true,
  });
}

export function methodologyMeta(locale: Locale): Metadata {
  const d = t(locale);
  return pageMetadata({
    locale,
    path: '/methodology',
    title: `${d.methodology.title} — ${SITE.name}`,
    description: d.methodology.lead,
    indexable: true,
  });
}
