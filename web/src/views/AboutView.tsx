import { Shell } from '@/components/Shell';
import { JsonLd, SectionHead } from '@/components/bits';
import { localePath, t, SITE, type Locale } from '@/lib/i18n';
import { fmtDate, fmtInt } from '@/lib/format';
import { getSiteStats } from '@/lib/queries';
import { breadcrumbJsonLd } from '@/lib/seo';

export function AboutView({ locale }: { locale: Locale }) {
  const d = t(locale);
  const stats = getSiteStats();

  return (
    <Shell
      locale={locale}
      path="/about"
      active="about"
      lastCollected={stats.lastDay}
      aiContext={`${d.about.title}. ${d.about.lead}`}
    >
      <JsonLd json={breadcrumbJsonLd(locale, [{ name: d.nav.about, path: '/about' }])} />

      <p className="eyebrow">{d.nav.about}</p>
      <h1>{d.about.title}</h1>
      <p className="lead" style={{ marginTop: 16 }}>
        {d.about.lead}
      </p>

      <div className="stat-row">
        <div>
          <div className="stat__value">{fmtInt(stats.repos, locale)}</div>
          <div className="stat__label">{d.home.statRepos}</div>
        </div>
        <div>
          <div className="stat__value">{fmtInt(stats.snapshotDays, locale)}</div>
          <div className="stat__label">{d.home.statDays(stats.snapshotDays)}</div>
        </div>
        <div>
          <div className="stat__value">
            {stats.firstDay ? fmtDate(stats.firstDay, locale) : '—'}
          </div>
          <div className="stat__label">{d.home.statTrackedSince}</div>
        </div>
      </div>

      <div className="section">
        <div className="grid-2">
          {d.about.cards.map(card => (
            <div className="card" style={{ padding: 20 }} key={card.heading}>
              <h3 style={{ marginBottom: 8 }}>{card.heading}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <SectionHead title={d.about.doTitle} />
        <ul className="do-list">
          {d.about.doItems.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="cta-row">
          <a className="button button--primary" href={localePath(locale, '/trending/weekly')}>
            {d.nav.trending}
          </a>
          <a className="button" href={localePath(locale, '/languages')}>
            {d.nav.languages}
          </a>
          <a className="button" href={localePath(locale, '/rankings')}>
            {d.nav.rankings}
          </a>
        </div>
      </div>

      <div className="section">
        <SectionHead
          title={d.about.howTitle}
          href={localePath(locale, '/methodology')}
          linkLabel={d.nav.methodology}
        />
        <div className="prose">
          <p>{d.about.howBody}</p>
          <p style={{ color: 'var(--text-faint)' }}>{d.about.independence}</p>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>
            {SITE.name} © 2026
          </p>
        </div>
      </div>
    </Shell>
  );
}
