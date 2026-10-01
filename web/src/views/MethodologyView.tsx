import { Shell } from '@/components/Shell';
import { JsonLd } from '@/components/bits';
import { t, type Locale } from '@/lib/i18n';
import { fmtDate, fmtInt } from '@/lib/format';
import { getSiteStats } from '@/lib/queries';
import { breadcrumbJsonLd } from '@/lib/seo';

export function MethodologyView({ locale }: { locale: Locale }) {
  const d = t(locale);
  const stats = getSiteStats();

  return (
    <Shell
      locale={locale}
      path="/methodology"
      active="methodology"
      lastCollected={stats.lastDay}
      aiContext={[d.methodology.title, d.methodology.lead]
        .concat(d.methodology.sections.map(s => `${s.heading}: ${s.body.join(' ')}`))
        .join('\n\n')}
    >
      <JsonLd json={breadcrumbJsonLd(locale, [{ name: d.methodology.title, path: '/methodology' }])} />

      <p className="eyebrow">{d.nav.methodology}</p>
      <h1>{d.methodology.title}</h1>

      <div className="prose" style={{ marginTop: 18 }}>
        <p className="lead">{d.methodology.lead}</p>

        {/* State of the data, rendered from the database rather than written by
            hand, so this page cannot drift out of date. */}
        <div className="card" style={{ padding: 18, margin: '26px 0' }}>
          <dl className="kv" style={{ padding: 0 }}>
            <dt>{locale === 'vi' ? 'Repo đang theo dõi' : 'Repos tracked'}</dt>
            <dd>{fmtInt(stats.repos, locale)}</dd>
            <dt>{locale === 'vi' ? 'Ngày dữ liệu' : 'Days of history'}</dt>
            <dd>{fmtInt(stats.snapshotDays, locale)}</dd>
            <dt>{locale === 'vi' ? 'Ghi nhận từ' : 'Recording since'}</dt>
            <dd>{stats.firstDay ? fmtDate(stats.firstDay, locale) : '—'}</dd>
            <dt>{locale === 'vi' ? 'Cửa sổ 1d / 7d / 30d đã tính' : 'Resolved 1d / 7d / 30d windows'}</dt>
            <dd>
              {fmtInt(stats.velocityWindows['1d'], locale)} / {fmtInt(stats.velocityWindows['7d'], locale)} /{' '}
              {fmtInt(stats.velocityWindows['30d'], locale)}
            </dd>
            <dt>{locale === 'vi' ? 'Trang có review' : 'Pages with a review'}</dt>
            <dd>{fmtInt(stats.published, locale)}</dd>
          </dl>
        </div>

        {d.methodology.sections.map(section => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </section>
        ))}
      </div>
    </Shell>
  );
}
