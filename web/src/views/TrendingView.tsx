import { Shell } from '@/components/Shell';
import { RepoList } from '@/components/RepoList';
import { JsonLd, Notice, Tabs } from '@/components/bits';
import { localePath, t, type Locale } from '@/lib/i18n';
import { fmtDate, fmtInt } from '@/lib/format';
import { PERIOD_TO_WINDOW, getRanking, getSiteStats, type TrendingPeriod } from '@/lib/queries';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
import { daysStillNeeded } from './shared';

const PERIODS: TrendingPeriod[] = ['daily', 'weekly', 'monthly'];

export function TrendingView({ locale, period }: { locale: Locale; period: TrendingPeriod }) {
  const d = t(locale);
  const window = PERIOD_TO_WINDOW[period];
  const stats = getSiteStats();
  const ranking = getRanking(window, { limit: 50 });
  const stillNeeded = daysStillNeeded(window, stats.snapshotDays);
  const path = `/trending/${period}`;

  return (
    <Shell
      locale={locale}
      path={path}
      active="trending"
      lastCollected={stats.lastDay}
      aiContext={[
        `${d.trending.title[period]} — ${d.trending.subtitle[period]}`,
        ranking.basis === 'velocity'
          ? `Ranked by star gain over ${window}.`
          : 'Ranked by total stars; velocity for this window is not available yet.',
        '',
        ...ranking.repos.slice(0, 10).map((r, i) => {
          const figure =
            ranking.basis === 'velocity' && r.delta !== null
              ? `+${Math.round(r.delta)} stars/${window}`
              : `${r.stars} stars`;
          return `${i + 1}. ${r.fullName} (${figure}${r.language ? `, ${r.language}` : ''})`;
        }),
      ].join('\n')}
    >
      <JsonLd
        json={breadcrumbJsonLd(locale, [
          { name: d.nav.trending, path: '/trending/weekly' },
          { name: d.trending.title[period], path },
        ])}
      />
      {ranking.basis === 'velocity' ? (
        <JsonLd json={itemListJsonLd(locale, d.trending.title[period], ranking.repos)} />
      ) : null}

      <p className="eyebrow">{d.nav.trending}</p>
      <h1>{d.trending.title[period]}</h1>
      <p className="lead" style={{ marginTop: 12, marginBottom: 24 }}>
        {d.trending.subtitle[period]}
      </p>

      <div className="toolbar">
        <Tabs
          items={PERIODS.map(p => ({
            label: d.trending.periodLabel[p],
            href: localePath(locale, `/trending/${p}`),
            current: p === period,
          }))}
        />
        <span className="toolbar__meta">
          {fmtInt(stats.repos, locale)} {d.home.statRepos}
          {stats.lastDay ? ` · ${d.home.capturedOn} ${fmtDate(stats.lastDay, locale)}` : ''}
        </span>
      </div>

      {ranking.basis === 'stars' ? (
        <Notice title={d.velocity.pendingTitle}>
          {d.velocity.pendingBody({ days: stats.snapshotDays, needed: stillNeeded, window })}
        </Notice>
      ) : null}

      <RepoList locale={locale} repos={ranking.repos} window={window} basis={ranking.basis} />
    </Shell>
  );
}
