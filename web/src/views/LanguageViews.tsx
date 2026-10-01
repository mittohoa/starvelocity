import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { RepoList } from '@/components/RepoList';
import { JsonLd, Notice, SectionHead } from '@/components/bits';
import { localePath, t, type Locale } from '@/lib/i18n';
import { fmtCompact, fmtInt } from '@/lib/format';
import { getLanguages, getRanking, getSiteStats } from '@/lib/queries';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
import { daysStillNeeded } from './shared';

export function LanguagesView({ locale }: { locale: Locale }) {
  const d = t(locale);
  const stats = getSiteStats();
  const languages = getLanguages(60);

  return (
    <Shell locale={locale} path="/languages" active="languages" lastCollected={stats.lastDay}>
      <JsonLd json={breadcrumbJsonLd(locale, [{ name: d.languages.title, path: '/languages' }])} />

      <p className="eyebrow">{d.nav.languages}</p>
      <h1>{d.languages.title}</h1>
      <p className="lead" style={{ marginTop: 12, marginBottom: 28 }}>
        {d.languages.subtitle}
      </p>

      <div className="pill-grid">
        {languages.map(lang => (
          <a
            className="pill"
            key={lang.language}
            href={localePath(locale, `/languages/${encodeURIComponent(lang.language.toLowerCase())}`)}
          >
            <span>{lang.language}</span>
            <span className="pill__count">
              {fmtInt(lang.repos, locale)} · ★ {fmtCompact(lang.stars)}
            </span>
          </a>
        ))}
      </div>
    </Shell>
  );
}

/**
 * Language slugs are lowercased in URLs, but the database stores GitHub's own
 * casing ("TypeScript", "C++"). Resolve the slug back to the real name so the
 * query matches and the page shows the language the way GitHub spells it.
 */
export function resolveLanguage(slug: string): string | null {
  const wanted = decodeURIComponent(slug).toLowerCase();
  const match = getLanguages(500).find(l => l.language.toLowerCase() === wanted);
  return match?.language ?? null;
}

export function LanguageDetailView({ locale, slug }: { locale: Locale; slug: string }) {
  const d = t(locale);
  const language = resolveLanguage(slug);
  if (!language) notFound();

  const stats = getSiteStats();
  const ranking = getRanking('7d', { limit: 50, language });
  const stillNeeded = daysStillNeeded('7d', stats.snapshotDays);
  const path = `/languages/${encodeURIComponent(language.toLowerCase())}`;

  return (
    <Shell locale={locale} path={path} active="languages" lastCollected={stats.lastDay}>
      <JsonLd
        json={breadcrumbJsonLd(locale, [
          { name: d.languages.title, path: '/languages' },
          { name: language, path },
        ])}
      />
      {ranking.basis === 'velocity' ? (
        <JsonLd json={itemListJsonLd(locale, d.languages.inLanguage(language), ranking.repos)} />
      ) : null}

      <p className="eyebrow">
        <a href={localePath(locale, '/languages')}>{d.languages.title}</a>
      </p>
      <h1>{d.languages.inLanguage(language)}</h1>
      <p className="lead" style={{ marginTop: 12, marginBottom: 24 }}>
        {d.trending.subtitle.weekly}
      </p>

      {ranking.basis === 'stars' ? (
        <Notice title={d.velocity.pendingTitle}>
          {d.velocity.pendingBody({ days: stats.snapshotDays, needed: stillNeeded, window: '7d' })}
        </Notice>
      ) : null}

      <RepoList locale={locale} repos={ranking.repos} window="7d" basis={ranking.basis} />

      <div className="section">
        <SectionHead title={d.home.sectionLanguages} href={localePath(locale, '/languages')} linkLabel={d.home.viewAll} />
        <div className="pill-grid">
          {getLanguages(12)
            .filter(l => l.language !== language)
            .map(l => (
              <a
                className="pill"
                key={l.language}
                href={localePath(locale, `/languages/${encodeURIComponent(l.language.toLowerCase())}`)}
              >
                <span>{l.language}</span>
                <span className="pill__count">{fmtInt(l.repos, locale)}</span>
              </a>
            ))}
        </div>
      </div>
    </Shell>
  );
}
