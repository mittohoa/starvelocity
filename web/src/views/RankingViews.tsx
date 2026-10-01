import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { RepoList } from '@/components/RepoList';
import { JsonLd, SectionHead } from '@/components/bits';
import { localePath, t, type Locale } from '@/lib/i18n';
import { fmtCompact, fmtInt } from '@/lib/format';
import { getOwnerRepos, getSiteStats, getTopOwners } from '@/lib/queries';
import { breadcrumbJsonLd } from '@/lib/seo';

function OwnerTable({ locale, owners }: { locale: Locale; owners: ReturnType<typeof getTopOwners> }) {
  const d = t(locale);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{locale === 'vi' ? 'Chủ sở hữu' : 'Owner'}</th>
            <th className="num">{d.owners.repos}</th>
            <th className="num">★</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o, i) => (
            <tr key={o.owner}>
              <td>{i + 1}</td>
              <td>
                <a href={localePath(locale, `/users/${o.owner}`)}>{o.owner}</a>
              </td>
              <td className="num">{fmtInt(o.repos, locale)}</td>
              <td className="num">{fmtCompact(o.stars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankingsView({ locale }: { locale: Locale }) {
  const d = t(locale);
  const stats = getSiteStats();
  const orgs = getTopOwners('Organization', 40);
  const users = getTopOwners('User', 40);

  return (
    <Shell locale={locale} path="/rankings" active="rankings" lastCollected={stats.lastDay}>
      <JsonLd json={breadcrumbJsonLd(locale, [{ name: d.nav.rankings, path: '/rankings' }])} />

      <p className="eyebrow">{d.nav.rankings}</p>
      <h1>{d.nav.rankings}</h1>
      <p className="lead" style={{ marginTop: 12 }}>
        {locale === 'vi'
          ? 'Tổng hợp theo chủ sở hữu trong tập repo đang theo dõi, xếp theo tổng star.'
          : 'Aggregated by owner across the tracked set, ordered by total stars.'}
      </p>

      <div className="section">
        <SectionHead title={d.owners.orgsTitle} />
        <OwnerTable locale={locale} owners={orgs} />
      </div>

      <div className="section">
        <SectionHead title={d.owners.usersTitle} />
        <OwnerTable locale={locale} owners={users} />
      </div>
    </Shell>
  );
}

export function OwnerView({ locale, owner }: { locale: Locale; owner: string }) {
  const d = t(locale);
  const repos = getOwnerRepos(owner, 60);
  if (repos.length === 0) notFound();

  const stats = getSiteStats();
  const canonicalOwner = repos[0]!.owner;
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const path = `/users/${canonicalOwner}`;

  return (
    <Shell locale={locale} path={path} active="rankings" lastCollected={stats.lastDay}>
      <JsonLd
        json={breadcrumbJsonLd(locale, [
          { name: d.nav.rankings, path: '/rankings' },
          { name: canonicalOwner, path },
        ])}
      />

      <div className="repo-head">
        <img
          className="repo-head__avatar"
          src={`https://github.com/${canonicalOwner}.png?size=112`}
          alt=""
          width={56}
          height={56}
          loading="lazy"
        />
        <div className="repo-head__body">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            {repos[0]!.ownerType === 'Organization' ? 'Organization' : 'User'}
          </p>
          <h1>{d.owners.reposBy(canonicalOwner)}</h1>
          <div className="chip-row" style={{ marginTop: 12 }}>
            <span className="badge">
              {fmtInt(repos.length, locale)} {d.owners.repos}
            </span>
            <span className="badge">★ {fmtCompact(totalStars)}</span>
          </div>
          <div className="cta-row">
            <a className="button" href={`https://github.com/${canonicalOwner}`} rel="noopener">
              {d.repo.openOnGitHub} ↗
            </a>
          </div>
        </div>
      </div>

      <div className="section">
        <RepoList locale={locale} repos={repos} window="7d" basis="stars" />
      </div>
    </Shell>
  );
}
