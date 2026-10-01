import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { RepoList } from '@/components/RepoList';
import { JsonLd, Notice, SectionHead } from '@/components/bits';
import { StarChart } from '@/components/StarChart';
import { localePath, t, type Locale } from '@/lib/i18n';
import { fmtCompact, fmtDate, fmtInt, fmtRelative } from '@/lib/format';
import {
  getOwnerRepos,
  getRanking,
  getRepo,
  getRepoHistory,
  getSiteStats,
  isIndexable,
} from '@/lib/queries';
import { breadcrumbJsonLd, repoJsonLd } from '@/lib/seo';

interface RepoViewProps {
  locale: Locale;
  owner: string;
  name: string;
}

export function RepoView({ locale, owner, name }: RepoViewProps) {
  const d = t(locale);
  const repo = getRepo(owner, name);
  if (!repo) notFound();

  const stats = getSiteStats();
  const history = getRepoHistory(repo.id);
  const siblings = getOwnerRepos(repo.owner, 6).filter(r => r.id !== repo.id);
  const sameLanguage = repo.language
    ? getRanking('7d', { limit: 6, language: repo.language }).repos.filter(r => r.id !== repo.id)
    : [];
  const path = `/repo/${repo.fullName}`;
  const indexable = isIndexable(repo);

  return (
    <Shell
      locale={locale}
      path={path}
      lastCollected={stats.lastDay}
      aiContext={[
        `GitHub repository ${repo.fullName}`,
        repo.description ?? null,
        `Stars: ${repo.stars}. Forks: ${repo.forks}.`,
        repo.language ? `Primary language: ${repo.language}.` : null,
        repo.license && repo.license !== 'NOASSERTION' ? `License: ${repo.license}.` : null,
        repo.topics.length ? `Topics: ${repo.topics.join(', ')}.` : null,
        repo.delta !== null
          ? `Star gain over the last 7 days: ${Math.round(repo.delta)}.`
          : 'Seven-day star velocity is not yet available for this repository.',
      ]
        .filter(Boolean)
        .join('\n')}
    >
      <JsonLd json={repoJsonLd(locale, repo)} />
      <JsonLd
        json={breadcrumbJsonLd(locale, [
          { name: d.nav.trending, path: '/trending/weekly' },
          { name: repo.owner, path: `/users/${repo.owner}` },
          { name: repo.name, path },
        ])}
      />

      <div className="repo-head">
        {/* Static export means no image optimiser; the avatar is fetched directly. */}
        <img
          className="repo-head__avatar"
          src={`https://github.com/${repo.owner}.png?size=120`}
          alt=""
          width={60}
          height={60}
          loading="lazy"
        />
        <div className="repo-head__body">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            {repo.ownerType === 'Organization' ? 'Organization' : 'User'} ·{' '}
            <a href={localePath(locale, `/users/${repo.owner}`)}>{repo.owner}</a>
          </p>
          <h1 className="mono">
            <span className="owner">{repo.owner}/</span>
            {repo.name}
          </h1>
          {repo.description ? (
            <p className="lead" style={{ marginTop: 10 }}>
              {repo.description}
            </p>
          ) : null}

          <div className="chip-row" style={{ marginTop: 12 }}>
            <span className="badge">★ {fmtInt(repo.stars, locale)}</span>
            <span className="badge">⑂ {fmtInt(repo.forks, locale)}</span>
            {repo.language ? <span className="badge">{repo.language}</span> : null}
            {repo.license && repo.license !== 'NOASSERTION' ? (
              <span className="badge">{repo.license}</span>
            ) : null}
            {repo.delta !== null ? (
              <span className="badge badge--up">
                {repo.delta > 0 ? '+' : ''}
                {fmtCompact(repo.delta)} ★ / 7d
              </span>
            ) : (
              <span className="badge badge--unknown">7d {d.velocity.unknown}</span>
            )}
          </div>

          <div className="cta-row">
            <a
              className="button button--primary"
              href={`https://github.com/${repo.fullName}`}
              rel="noopener"
            >
              {d.repo.openOnGitHub} ↗
            </a>
          </div>
        </div>
      </div>

      {!indexable ? (
        <div className="section">
          <Notice title={d.repo.noReviewTitle}>{d.repo.noReviewBody}</Notice>
        </div>
      ) : null}

      <div className="section">
        <SectionHead title={d.repo.chartTitle} />
        <StarChart locale={locale} points={history} />
      </div>

      <div className="section grid-2">
        <div className="card">
          <dl className="kv">
            <dt>{d.repo.stars}</dt>
            <dd>{fmtInt(repo.stars, locale)}</dd>
            <dt>{d.repo.forks}</dt>
            <dd>{fmtInt(repo.forks, locale)}</dd>
            <dt>{d.repo.language}</dt>
            <dd>{repo.language ?? '—'}</dd>
            <dt>{d.repo.license}</dt>
            <dd>{repo.license && repo.license !== 'NOASSERTION' ? repo.license : '—'}</dd>
            <dt>{d.repo.created}</dt>
            <dd>{fmtDate(repo.createdAt, locale)}</dd>
            <dt>{d.repo.lastPush}</dt>
            <dd>{fmtRelative(repo.pushedAt, locale)}</dd>
            <dt>{d.repo.qualityScore}</dt>
            <dd>{repo.qualityScore !== null ? repo.qualityScore.toFixed(1) : '—'}</dd>
          </dl>
        </div>

        {repo.topics.length > 0 ? (
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginBottom: 12 }}>{d.repo.topics}</h3>
            <div className="chip-row">
              {repo.topics.map(topic => (
                <span className="badge" key={topic}>
                  #{topic}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {siblings.length > 0 ? (
        <div className="section">
          <SectionHead title={d.repo.relatedByOwner} href={localePath(locale, `/users/${repo.owner}`)} linkLabel={d.home.viewAll} />
          <RepoList locale={locale} repos={siblings} window="7d" basis="stars" />
        </div>
      ) : null}

      {sameLanguage.length > 0 && repo.language ? (
        <div className="section">
          <SectionHead
            title={`${d.repo.relatedByLanguage} ${repo.language}`}
            href={localePath(locale, `/languages/${encodeURIComponent(repo.language.toLowerCase())}`)}
            linkLabel={d.home.viewAll}
          />
          <RepoList locale={locale} repos={sameLanguage} window="7d" basis="stars" />
        </div>
      ) : null}
    </Shell>
  );
}
