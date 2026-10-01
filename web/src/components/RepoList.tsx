import { localePath, t, type Locale } from '@/lib/i18n';
import { fmtCompact, fmtDelta, fmtPercent, fmtRate, languageHue } from '@/lib/format';
import type { RankingBasis, RepoSummary, Window } from '@/lib/queries';

interface RepoListProps {
  locale: Locale;
  repos: RepoSummary[];
  window: Window;
  basis: RankingBasis;
  startRank?: number;
}

const WINDOW_LABEL: Record<Window, string> = { '1d': '1d', '7d': '7d', '30d': '30d' };

/**
 * The ranked grid.
 *
 * `basis` decides what the headline figure means. When velocity is not resolved
 * yet the card shows total stars and an explicit "not yet known" marker rather
 * than a zero delta — a zero would claim the repo gained nothing.
 */
export function RepoList({ locale, repos, window, basis, startRank = 1 }: RepoListProps) {
  const d = t(locale);

  return (
    <ol className="card-grid">
      {repos.map((repo, i) => {
        const rank = startRank + i;
        const hue = languageHue(repo.language);
        const hasVelocity = basis === 'velocity' && repo.delta !== null;
        const href = localePath(locale, `/repo/${repo.fullName}`);

        return (
          <li className="repo-card" key={repo.id}>
            <div className="repo-card__body">
              <div className="repo-card__top">
                <span className={`rank${rank <= 3 ? ` rank--${rank}` : ''}`}>{rank}</span>

                {/* Static export ships no image optimiser; avatars come straight
                    from GitHub. */}
                <img
                  className="repo-card__avatar"
                  src={`https://github.com/${repo.owner}.png?size=68`}
                  alt=""
                  width={34}
                  height={34}
                  loading="lazy"
                />

                <div style={{ minWidth: 0 }}>
                  <a className="repo-card__name" href={href}>
                    <span className="owner">{repo.owner}/</span>
                    <b>{repo.name}</b>
                  </a>
                  <div style={{ marginTop: 6 }}>
                    {hasVelocity ? (
                      <span className="badge badge--up">
                        {fmtDelta(repo.delta!)} ★ / {WINDOW_LABEL[window]}
                      </span>
                    ) : (
                      <span className="badge badge--unknown">{d.velocity.unknown}</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="repo-card__desc">{repo.description ?? ''}</p>

              <div className="repo-card__meta">
                <span className="badge">★ {fmtCompact(repo.stars)}</span>
                <span className="badge">⑂ {fmtCompact(repo.forks)}</span>
                {repo.language ? (
                  <span className="badge badge--lang" style={{ ['--hue' as string]: String(hue) }}>
                    {repo.language}
                  </span>
                ) : null}
                {hasVelocity && repo.accel !== null ? (
                  <span className="badge badge--accent">
                    {repo.accel > 0 ? `↑ ${d.velocity.accelUp}` : `↓ ${d.velocity.accelDown}`}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="repo-card__foot">
              <span className="mono" style={{ color: 'var(--text-faint)' }}>
                {hasVelocity && repo.ratePerDay !== null
                  ? `${fmtRate(repo.ratePerDay)}${d.velocity.perDay}${
                      repo.relative !== null ? ` · ${fmtPercent(repo.relative)}` : ''
                    }`
                  : `★ ${fmtCompact(repo.stars)}`}
              </span>
              <a className="go" href={href}>
                {d.repo.viewDetail} →
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
