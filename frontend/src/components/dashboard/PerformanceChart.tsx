import type { TimeRange } from '../../types/portfolio';
import { buildChartPaths } from '../../utils/chart';
import { formatSignedCurrency, formatSignedPercent } from '../../utils/formatters';
import { performanceData } from '../../data/mockPortfolio';
import { Card } from '../common/Card';

interface PerformanceChartProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

const ranges: TimeRange[] = ['1D', '1W', '1M', '1Y', 'All'];

export function PerformanceChart({ range, onRangeChange }: PerformanceChartProps) {
  const series = performanceData[range];
  const paths = buildChartPaths(series.values);
  const first = series.values[0];
  const last = series.values.at(-1) ?? first;
  const change = (last - first) * 1000;
  const percent = ((last - first) / first) * 100;
  const tone = change >= 0 ? 'positive' : 'negative';

  return (
    <Card className="performance-card">
      <div className="accent-glow" aria-hidden="true" />
      <div className="performance-header">
        <div>
          <span className="eyebrow">Total portfolio value</span>
          <h1 className="portfolio-value">$284,750</h1>
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
        <svg viewBox="0 0 720 210" preserveAspectRatio="none" role="img" aria-label={`Portfolio performance for the ${series.label}`}>
          <defs>
            <linearGradient id="portfolioArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={paths.area} fill="url(#portfolioArea)" />
          <path d={paths.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="chart-axis" aria-hidden="true">
          {series.axis.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
    </Card>
  );
}
