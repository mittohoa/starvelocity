import { Shell } from '@/components/Shell';
import { RepoList } from '@/components/RepoList';
import { JsonLd, Notice, SectionHead } from '@/components/bits';
import { localePath, t, type Locale } from '@/lib/i18n';
import { fmtCompact, fmtDate, fmtInt } from '@/lib/format';
import { getLanguages, getRanking, getSiteStats } from '@/lib/queries';
import { websiteJsonLd } from '@/lib/seo';
import { daysStillNeeded } from './shared';

export function HomeView({ locale }: { locale: Locale }) {
  const d = t(locale);
  const stats = getSiteStats();
  const ranking = getRanking('7d', { limit: 9 });
  const languages = getLanguages(12);
  const stillNeeded = daysStillNeeded('7d', stats.snapshotDays);

  // The hero panel is a short preview of the same ranking, so it never
  // disagrees with the section below it.
  const preview = ranking.repos.slice(0, 5);

  return (
    <Shell
      locale={locale}
      path="/"
      lastCollected={stats.lastDay}
      aiContext={[
        `${d.home.taglineLead} ${d.home.taglineAccent}`,
        d.home.intro,
        `Tracking ${stats.repos} repositories with ${stats.snapshotDays} day(s) of history.`,
        '',
        ...preview.map((r, i) => `${i + 1}. ${r.fullName} (${r.stars} stars)`),
      ].join('\n')}
    >
      <JsonLd json={websiteJsonLd(locale, d.home.intro)} />

      <section className="hero">
        <div>
          <p className="pill-badge">
            {fmtInt(stats.repos, locale)} {d.home.statRepos} ·{' '}
            {fmtInt(stats.snapshotDays, locale)} {d.home.statDays(stats.snapshotDays)}
          </p>

          <h1>
            {d.home.taglineLead}
            <span className="accent">{d.home.taglineAccent}</span>
          </h1>

          <p className="lead" style={{ marginTop: 20 }}>
            {d.home.intro}
          </p>

          <div className="cta-row">
            <a className="button button--primary" href={localePath(locale, '/trending/weekly')}>
              {d.home.ctaTrending}
            </a>
            <a className="button" href={localePath(locale, '/methodology')}>
              {d.home.ctaMethodology}
            </a>
          </div>

          <div className="stat-row">
            {[
              { value: fmtInt(stats.repos, locale), label: d.home.statRepos },
              { value: fmtInt(stats.snapshotDays, locale), label: d.home.statDays(stats.snapshotDays) },
              { value: fmtInt(stats.velocityWindows['7d'], locale), label: '7d velocity' },
              { value: fmtInt(stats.published, locale), label: d.home.statReviewed },
            ].map(item => (
              <div key={item.label}>
                <div className="stat__value">{item.value}</div>
                <div className="stat__label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="panel">
          <div className="panel__head">
            <span className="panel__title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 .8l2.2 4.5 5 .7-3.6 3.5.9 4.9L8 12.1 3.5 14.4l.9-4.9L.8 6l5-.7L8 .8z" />
              </svg>
              {d.home.risingStars}
            </span>
            <span className="badge">{ranking.basis === 'velocity' ? '7d' : '★'}</span>
          </div>

          {preview.map((repo, i) => (
            <a
              className="mini-row"
              key={repo.id}
              href={localePath(locale, `/repo/${repo.fullName}`)}
            >
              <span className="mini-row__rank">{i + 1}</span>
              <span className="mini-row__name">
                <span>{repo.owner}/</span>
                <b>{repo.name}</b>
              </span>
              <span className="mini-row__figure">
                {ranking.basis === 'velocity' && repo.delta !== null
                  ? `+${fmtCompact(repo.delta)}`
                  : `★ ${fmtCompact(repo.stars)}`}
              </span>
            </a>
          ))}

          <div className="panel__foot">
            <span>
              {stats.lastDay ? `${d.home.capturedOn} ${fmtDate(stats.lastDay, locale)}` : ''}
            </span>
            <a href={localePath(locale, '/trending/weekly')}>{d.home.viewAll} →</a>
          </div>
        </aside>
      </section>

      <div className="section">
        <SectionHead
          title={d.home.sectionMovers}
          href={localePath(locale, '/trending/weekly')}
          linkLabel={d.home.viewAll}
        />

        {/* Being explicit beats quietly showing a stars list dressed as velocity. */}
        {ranking.basis === 'stars' ? (
          <Notice title={d.velocity.pendingTitle}>
            {d.velocity.pendingBody({ days: stats.snapshotDays, needed: stillNeeded, window: '7d' })}
          </Notice>
        ) : null}

        <RepoList locale={locale} repos={ranking.repos} window="7d" basis={ranking.basis} />
      </div>

      <div className="section">
        <SectionHead
          title={d.home.sectionLanguages}
          href={localePath(locale, '/languages')}
          linkLabel={d.home.viewAll}
        />
        <div className="pill-grid">
          {languages.map(lang => (
            <a
              className="pill"
              key={lang.language}
              href={localePath(locale, `/languages/${encodeURIComponent(lang.language.toLowerCase())}`)}
            >
              <span>{lang.language}</span>
              <span className="pill__count">{fmtInt(lang.repos, locale)}</span>
            </a>
          ))}
        </div>
      </div>
    </Shell>
  );
}
