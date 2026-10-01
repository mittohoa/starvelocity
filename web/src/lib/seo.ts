import type { Metadata } from 'next';
import { SITE, absoluteUrl, localePath, type Locale } from './i18n';
import type { RepoSummary } from './queries';

/**
 * Metadata plumbing in one place.
 *
 * The important rule here is the indexing gate: a page without an original
 * review gets `noindex`, and it is also kept out of the sitemap. Generating
 * thousands of thin pages and letting search engines index them is what gets a
 * site classed as spam, so the two mechanisms have to agree.
 */

interface PageMetaInput {
  locale: Locale;
  /** Locale-independent path, e.g. '/trending/weekly'. */
  path: string;
  title: string;
  description: string;
  indexable: boolean;
  /** Extra keywords; kept short because long keyword lists are ignored anyway. */
  keywords?: string[];
}

export function pageMetadata(input: PageMetaInput): Metadata {
  const { locale, path, title, description, indexable } = input;
  const canonical = absoluteUrl(locale, path);

  return {
    title,
    description,
    keywords: input.keywords,
    alternates: {
      canonical,
      languages: {
        en: absoluteUrl('en', path),
        vi: absoluteUrl('vi', path),
        'x-default': absoluteUrl('en', path),
      },
    },
    robots: indexable
      ? { index: true, follow: true }
      // follow:true still lets crawlers walk to the pages that *are* indexable.
      : { index: false, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      url: canonical,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function jsonLd(data: Record<string, unknown>): string {
  // Angle brackets are the only sequence that can break out of a script element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function websiteJsonLd(locale: Locale, description: string): string {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: absoluteUrl(locale, '/'),
    description,
    inLanguage: locale === 'vi' ? 'vi-VN' : 'en-US',
  });
}

export function breadcrumbJsonLd(
  locale: Locale,
  trail: { name: string; path: string }[],
): string {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(locale, item.path),
    })),
  });
}

/**
 * A repo page describes software, so SoftwareSourceCode is the honest type.
 *
 * Deliberately omitted: aggregateRating. Stars are an interaction count, not a
 * 1-to-5 rating, and dressing them up as one would be a fabricated review
 * signal — exactly the thing the methodology page promises not to do.
 */
export function repoJsonLd(locale: Locale, repo: RepoSummary): string {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: repo.fullName,
    description: repo.description ?? undefined,
    codeRepository: `https://github.com/${repo.fullName}`,
    programmingLanguage: repo.language ?? undefined,
    license: repo.license && repo.license !== 'NOASSERTION' ? repo.license : undefined,
    dateCreated: repo.createdAt ?? undefined,
    dateModified: repo.pushedAt ?? undefined,
    url: absoluteUrl(locale, `/repo/${repo.fullName}`),
    author: { '@type': repo.ownerType === 'Organization' ? 'Organization' : 'Person', name: repo.owner },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: repo.stars,
      },
    ],
  });
}

export function itemListJsonLd(
  locale: Locale,
  name: string,
  repos: RepoSummary[],
): string {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: repos.length,
    itemListElement: repos.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.fullName,
      url: absoluteUrl(locale, `/repo/${r.fullName}`),
    })),
  });
}

export function repoPath(repo: { fullName: string }): string {
  return `/repo/${repo.fullName}`;
}

export { localePath };
