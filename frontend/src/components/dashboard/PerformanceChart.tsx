import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { PerformanceSeries, TimeRange } from '../../types/portfolio';
import { buildChartPaths } from '../../utils/chart';
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '../../utils/formatters';
import { fetchPerformance } from '../../api/client';
import { Card } from '../common/Card';

interface PerformanceChartProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  totalValue: number;
}

const ranges: TimeRange[] = ['1W', '2W', '3W', '1M'];
const emptySeries: PerformanceSeries = { values: [], dates: [], axis: [], label: '' };

export function PerformanceChart({ range, onRangeChange, totalValue }: PerformanceChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [series, setSeries] = useState<PerformanceSeries>(emptySeries);

  useEffect(() => {
    fetchPerformance(range).then(setSeries);
  }, [range]);

  const { values, paths, first, last, change, percent, tone } = useMemo(() => {
    const vals = series.values.length ? series.values : [totalValue];
    const pths = buildChartPaths(vals);
    const f = vals[0];
    const l = vals.at(-1) ?? f;
    const c = l - f;
    const p = f ? ((l - f) / f) * 100 : 0;
    return { values: vals, paths: pths, first: f, last: l, change: c, percent: p, tone: c >= 0 ? 'positive' : 'negative' };
  }, [series.values, totalValue]);

  const hovered = hoverIndex === null ? null : paths.points[hoverIndex];
  const hoveredLabel = hoverIndex === null ? null : series.dates[hoverIndex];

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const index = Math.round(Math.min(1, Math.max(0, ratio)) * (paths.points.length - 1));
    setHoverIndex(index);
  };

  return (
    <Card className="performance-card">
      <div className="accent-glow" aria-hidden="true" />
      <div className="performance-header fade-slide-in">
        <div>
          <span className="eyebrow">Total portfolio value</span>
          <h1 className="portfolio-value">{formatCurrency(hovered ? hovered.value : totalValue)}</h1>
          <div className="range-summary">
            <span className={`change-pill ${tone}`}>
              {change >= 0 ? '▲' : '▼'} {formatSignedCurrency(change)} ({formatSignedPercent(percent)})
            </span>
            <span className="muted">{series.label}</span>
          </div>
        </div>
        <div className="range-control" aria-label="Performance range">
          {ranges.map((option) => (
            <button
              key={option}
              type="button"
              className="range-button"
              data-active={option === range}
              onClick={() => onRangeChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <div
          className="chart-plot"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
        <svg key={range} className="chart-svg-animate" viewBox="0 0 720 210" preserveAspectRatio="none" role="img" aria-label={`Portfolio performance for the ${series.label}`}>
          <defs>
            <linearGradient id="portfolioArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={paths.area} fill="url(#portfolioArea)" />
          <path d={paths.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hovered && (
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1="0"
              y2={paths.height}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hovered && (
          <>
            <span
              className="chart-dot"
              style={{ left: `${(hovered.x / paths.width) * 100}%`, top: `${(hovered.y / paths.height) * 100}%` }}
            />
            <div
              className="chart-tooltip"
              data-flip={hovered.y / paths.height < 0.3}
              style={{
                left: `${Math.min(92, Math.max(8, (hovered.x / paths.width) * 100))}%`,
                top: `${(hovered.y / paths.height) * 100}%`,
              }}
            >
              <strong>{formatCurrency(hovered.value)}</strong>
              {hoveredLabel && <span>{hoveredLabel}</span>}
            </div>
          </>
        )}
        </div>
        <div className="chart-axis" aria-hidden="true">
          {series.axis.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
    </Card>
  );
}
