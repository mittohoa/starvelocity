import { t, type Locale } from '@/lib/i18n';
import { fmtDate, fmtInt } from '@/lib/format';
import type { HistoryPoint } from '@/lib/queries';

interface StarChartProps {
  locale: Locale;
  points: HistoryPoint[];
}

const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28 };

/**
 * Axis labels must be chosen by the *span* of the data, not by how large the
 * numbers are. A repo sitting at 510,091 stars that gained 98 over two weeks
 * has three ticks that all round to "510k" under compact formatting, leaving an
 * axis that says nothing. Precision has to follow the range being shown.
 */
function axisFormatter(span: number, locale: Locale): (v: number) => string {
  if (span >= 2_000_000) return v => `${(v / 1_000_000).toFixed(1)}M`;
  if (span >= 20_000) return v => `${Math.round(v / 1_000)}k`;
  if (span >= 2_000) return v => `${(v / 1_000).toFixed(1)}k`;
  return v => fmtInt(Math.round(v), locale);
}

/**
 * Star history as inline SVG — no charting library, which keeps the static
 * bundle at zero JavaScript for this page.
 *
 * Two points is the minimum for a line. With fewer, the component says what it
 * has instead of drawing a flat line that implies "no growth".
 */
export function StarChart({ locale, points }: StarChartProps) {
  const d = t(locale);

  if (points.length < 2) {
    return (
      <div className="card">
        <div className="chart__empty">{d.repo.chartEmpty(points.length)}</div>
      </div>
    );
  }

  const values = points.map(p => p.stars);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A flat series would collapse to a zero-height range and divide by zero.
  const pad = Math.max((rawMax - rawMin) * 0.12, 1);
  const yMin = Math.max(rawMin - pad, 0);
  const yMax = rawMax + pad;

  // Three horizontal guides is enough orientation without turning into a grid.
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const formatTick = axisFormatter(yMax - yMin, locale);
  const tickLabels = ticks.map(formatTick);

  // Reserve room for the widest label rather than a fixed gutter, so exact
  // six-digit counts do not collide with the plot.
  const widest = Math.max(...tickLabels.map(l => l.length));
  const padLeft = Math.min(Math.max(widest * 6.6 + 14, 40), 110);

  const plotW = W - padLeft - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => padLeft + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.stars).toFixed(1)}`).join(' ');
  const area =
    `${line} L${x(points.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} ` +
    `L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;
  const hasBackfill = points.some(p => p.source === 'backfill');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const gained = last.stars - first.stars;

  return (
    <div className="card chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${d.repo.chartTitle}: ${fmtInt(first.stars, locale)} → ${fmtInt(last.stars, locale)}`}
      >
        <defs>
          <linearGradient id="starFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--text-faint)"
            >
              {tickLabels[i]}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#starFill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />

        {/* Only mark points when they are sparse enough to be readable. */}
        {points.length <= 45
          ? points.map((p, i) => (
              <circle
                key={p.day}
                cx={x(i)}
                cy={y(p.stars)}
                r={p.source === 'snapshot' ? 3 : 2.5}
                fill={p.source === 'snapshot' ? 'var(--accent)' : 'var(--surface)'}
                stroke="var(--accent)"
                strokeWidth="1.5"
              />
            ))
          : null}

        <text x={padLeft} y={H - 8} fontSize="11" fill="var(--text-faint)">
          {fmtDate(first.day, locale)}
        </text>
        <text x={W - PAD.right} y={H - 8} fontSize="11" fill="var(--text-faint)" textAnchor="end">
          {fmtDate(last.day, locale)}
        </text>
      </svg>

      <div className="chart__legend">
        <span>
          <span
            className="chart__swatch"
            style={{ background: 'var(--accent)' }}
            aria-hidden="true"
          />
          {d.repo.chartObserved}
        </span>
        {hasBackfill ? (
          <span>
            <span
              className="chart__swatch"
              style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)' }}
              aria-hidden="true"
            />
            {d.repo.chartBackfilled}
          </span>
        ) : null}
        <span>
          {fmtInt(first.stars, locale)} → {fmtInt(last.stars, locale)}
          {gained !== 0 ? ` (${gained > 0 ? '+' : ''}${fmtInt(gained, locale)})` : ''}
        </span>
      </div>
    </div>
  );
}
