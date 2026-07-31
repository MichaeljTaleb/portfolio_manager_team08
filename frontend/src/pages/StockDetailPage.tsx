import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { fetchHoldingPerformance } from '../api/client';
import { Card } from '../components/common/Card';
import { MetricCard } from '../components/dashboard/MetricCard';
import { usePreviousCloses, useLivePrices } from '../contexts/LivePricesContext';
import type { Holding, PerformanceSeries, StockRange } from '../types/portfolio';
import { buildChartPaths } from '../utils/chart';
import { formatCurrency, formatPrice, formatQuantity, formatSignedCurrency, formatSignedPercent } from '../utils/formatters';

interface StockDetailPageProps {
  holding: Holding;
  onBack: () => void;
}

const ranges: { value: StockRange; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '1Y', label: '1Y' },
  { value: 'SINCE_BOUGHT', label: 'Since bought' },
];

const emptySeries: PerformanceSeries = { values: [], dates: [], axis: [], label: '' };

export function StockDetailPage({ holding, onBack }: StockDetailPageProps) {
  const ticker = holding.ticker;
  const [range, setRange] = useState<StockRange>('1M');
  const [series, setSeries] = useState<PerformanceSeries>(emptySeries);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const livePrices = useLivePrices();
  const previousCloses = usePreviousCloses();

  useEffect(() => {
    setHoverIndex(null);
    fetchHoldingPerformance(ticker, range).then(setSeries);
  }, [ticker, range]);

  const livePrice = livePrices[ticker];
  const previousClose = previousCloses[ticker];

  const values = useMemo(() => {
    if (!series.values.length) return [];
    if (livePrice === undefined) return series.values;
    return [...series.values.slice(0, -1), livePrice];
  }, [series.values, livePrice]);

  const paths = useMemo(() => buildChartPaths(values.length ? values : [0]), [values]);

  const first = values[0] ?? 0;
  const last = values.at(-1) ?? first;
  const rangeChange = last - first;
  const rangeChangePercent = first ? (rangeChange / first) * 100 : 0;
  const rangeTone = rangeChange >= 0 ? 'positive' : 'negative';

  const displayPrice = livePrice ?? holding.currentPrice;
  const referencePrice = previousClose ?? holding.currentPrice;
  const dayChangePercent = referencePrice ? ((displayPrice - referencePrice) / referencePrice) * 100 : 0;
  const dayChangeValue = holding.quantity * (displayPrice - referencePrice);
  const dayTone = dayChangeValue >= 0 ? 'positive' : 'negative';

  const avgCost = holding.quantity ? (holding.value - holding.totalGainLoss) / holding.quantity : 0;

  const hovered = hoverIndex === null ? null : paths.points[hoverIndex];
  const hoveredLabel = hoverIndex === null ? null : series.dates[hoverIndex];

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || !paths.points.length) return;
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const index = Math.round(Math.min(1, Math.max(0, ratio)) * (paths.points.length - 1));
    setHoverIndex(index);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <button type="button" className="text-button" onClick={onBack}>&larr; Back</button>
          <h1>{ticker}</h1>
          <p>{holding.name}</p>
        </div>
      </div>

      <Card className="performance-card">
        <div className="accent-glow" aria-hidden="true" />
        <div className="performance-header fade-slide-in">
          <div>
            <span className="eyebrow">Current price</span>
            <h1 className="portfolio-value">{formatPrice(hovered ? hovered.value : displayPrice)}</h1>
            <div className="range-summary">
              <span className={`change-pill ${rangeTone}`}>
                {rangeChange >= 0 ? '▲' : '▼'} {formatSignedCurrency(rangeChange)} ({formatSignedPercent(rangeChangePercent)})
              </span>
              <span className="muted">{series.label}</span>
            </div>
          </div>
          <div className="range-control" aria-label="Stock performance range">
            {ranges.map((option) => (
              <button
                key={option.value}
                type="button"
                className="range-button"
                data-active={option.value === range}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-wrap">
          <div className="chart-plot" onMouseMove={handleMove} onMouseLeave={() => setHoverIndex(null)}>
            <svg key={range} className="chart-svg-animate" viewBox="0 0 720 210" preserveAspectRatio="none" role="img" aria-label={`${ticker} performance for the ${series.label}`}>
              <defs>
                <linearGradient id="stockArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={paths.area} fill="url(#stockArea)" />
              <path d={paths.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {hovered && (
                <line x1={hovered.x} x2={hovered.x} y1="0" y2={paths.height} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {hovered && (
              <>
                <span className="chart-dot" style={{ left: `${(hovered.x / paths.width) * 100}%`, top: `${(hovered.y / paths.height) * 100}%` }} />
                <div
                  className="chart-tooltip"
                  data-flip={hovered.y / paths.height < 0.3}
                  style={{ left: `${Math.min(92, Math.max(8, (hovered.x / paths.width) * 100))}%`, top: `${(hovered.y / paths.height) * 100}%` }}
                >
                  <strong>{formatPrice(hovered.value)}</strong>
                  {hoveredLabel && <span>{hoveredLabel}</span>}
                </div>
              </>
            )}
          </div>
          <div className="chart-axis" aria-hidden="true">
            {series.axis.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
          </div>
        </div>
      </Card>

      <div className="metric-grid" style={{ marginTop: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <MetricCard
          label="Today's change"
          value={formatSignedCurrency(dayChangeValue)}
          detail={formatSignedPercent(dayChangePercent)}
          tone={dayTone}
        />
        <MetricCard label="Quantity owned" value={formatQuantity(holding.quantity)} />
        <MetricCard
          label="Total gain/loss"
          value={formatSignedCurrency(holding.totalGainLoss)}
          detail={formatSignedPercent(avgCost ? (holding.totalGainLoss / (avgCost * holding.quantity)) * 100 : 0)}
          tone={holding.totalGainLoss < 0 ? 'negative' : 'positive'}
        />
        <MetricCard label="Market value" value={formatCurrency(holding.quantity * displayPrice)} />
        <MetricCard label="Allocation" value={`${holding.allocation.toFixed(1)}%`} />
      </div>
    </>
  );
}
