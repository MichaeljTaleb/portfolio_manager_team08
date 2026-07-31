import { useEffect, useMemo, useState } from 'react';
import { buyHolding, fetchHoldingAnalysis, fetchHoldingDetail, fetchHoldingPerformance, sellHolding } from '../api/client';
import { Card } from '../components/common/Card';
import { Toast } from '../components/common/Toast';
import { MetricCard } from '../components/dashboard/MetricCard';
import { AddHoldingForm } from '../components/holdings/AddHoldingForm';
import { SellHoldingForm } from '../components/holdings/SellHoldingForm';
import { usePreviousCloses, useLivePrices } from '../contexts/LivePricesContext';
import type { Holding, PerformanceSeries, StockAnalysis, StockRange } from '../types/portfolio';
import { buildChartPaths } from '../utils/chart';
import { useChartRangeSelect } from '../utils/useChartRangeSelect';
import { formatCurrency, formatDate, formatPrice, formatQuantity, formatSignedCurrency, formatSignedPercent } from '../utils/formatters';

const formatRecommendation = (key: string | null): string | null => {
  if (!key || key === 'none') return null;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const daysUntil = (isoDate: string): number | null => {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  return Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
};

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

export function StockDetailPage({ holding: initialHolding, onBack }: StockDetailPageProps) {
  const [holding, setHolding] = useState(initialHolding);
  const ticker = holding.ticker;
  const [range, setRange] = useState<StockRange>('1M');
  const [series, setSeries] = useState<PerformanceSeries>(emptySeries);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const livePrices = useLivePrices();
  const previousCloses = usePreviousCloses();

  useEffect(() => {
    fetchHoldingPerformance(ticker, range).then(setSeries);
  }, [ticker, range]);

  useEffect(() => {
    setAnalysis(null);
    fetchHoldingAnalysis(ticker).then(setAnalysis).catch(() => setAnalysis(null));
  }, [ticker]);

  const handleBuy = async (newHolding: Omit<Holding, 'id' | 'allocation'>) => {
    try {
      await buyHolding(newHolding.ticker, newHolding.quantity, newHolding.currentPrice);
      setIsBuying(false);
      setToastTone('success');
      setToastMessage(`Bought ${formatQuantity(newHolding.quantity)} ${newHolding.ticker} ${newHolding.quantity === 1 ? 'share' : 'shares'}.`);
      if (newHolding.ticker === ticker) {
        setHolding(await fetchHoldingDetail(ticker));
      }
    } catch (error) {
      setToastTone('error');
      setToastMessage(error instanceof Error ? error.message : 'Failed to buy.');
    }
  };

  const handleSell = async (quantity: number) => {
    try {
      await sellHolding(ticker, quantity, holding.currentPrice);
      setIsSelling(false);
      setToastTone('neutral');
      setToastMessage(`Sold ${formatQuantity(quantity)} ${ticker} ${quantity === 1 ? 'share' : 'shares'}.`);
      try {
        setHolding(await fetchHoldingDetail(ticker));
      } catch {
        onBack();
      }
    } catch (error) {
      setToastTone('error');
      setToastMessage(error instanceof Error ? error.message : 'Failed to sell.');
    }
  };

  const livePrice = livePrices[ticker];
  const previousClose = previousCloses[ticker];

  const values = useMemo(() => {
    if (!series.values.length) return [];
    if (livePrice === undefined) return series.values;
    return [...series.values.slice(0, -1), livePrice];
  }, [series.values, livePrice]);

  const paths = useMemo(() => buildChartPaths(values.length ? values : [0]), [values]);

  const { hoverIndex, dragRange, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } = useChartRangeSelect(paths);

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

  // avgCostBasis comes straight from the backend rather than being derived from
  // (value - totalGainLoss)/quantity — that derivation breaks once value is live
  // and totalGainLoss isn't (or vice versa), since it assumes both share the same
  // price basis.
  const avgCost = holding.avgCostBasis ?? 0;
  const liveTotalGainLoss = avgCost ? holding.quantity * (displayPrice - avgCost) : holding.totalGainLoss;

  const sector = holding.sector ?? 'Other';
  const sectorClass = sector.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const earningsDaysUntil = analysis?.earningsDate ? daysUntil(analysis.earningsDate) : null;
  const earningsDetail =
    earningsDaysUntil === null ? undefined : earningsDaysUntil > 0 ? `in ${earningsDaysUntil} days` : earningsDaysUntil === 0 ? 'today' : 'reported';
  const recommendationLabel = formatRecommendation(analysis?.recommendation ?? null);
  const targetUpsidePercent =
    analysis?.targetMeanPrice && displayPrice ? ((analysis.targetMeanPrice - displayPrice) / displayPrice) * 100 : null;

  const hovered = !dragRange && hoverIndex !== null ? paths.points[hoverIndex] : null;
  const hoveredLabel = !dragRange && hoverIndex !== null ? series.dates[hoverIndex] : null;

  const dragLowIndex = dragRange ? Math.min(dragRange.startIndex, dragRange.endIndex) : null;
  const dragHighIndex = dragRange ? Math.max(dragRange.startIndex, dragRange.endIndex) : null;
  const dragStartPoint = dragLowIndex !== null ? paths.points[dragLowIndex] : null;
  const dragEndPoint = dragHighIndex !== null ? paths.points[dragHighIndex] : null;
  const dragChangeValue = dragStartPoint && dragEndPoint ? dragEndPoint.value - dragStartPoint.value : 0;
  const dragChangePercent = dragStartPoint?.value ? (dragChangeValue / dragStartPoint.value) * 100 : 0;
  const dragTone = dragChangeValue >= 0 ? 'positive' : 'negative';
  const dragColor = dragTone === 'positive' ? 'var(--positive)' : 'var(--negative)';
  const dragMidX = dragStartPoint && dragEndPoint ? (dragStartPoint.x + dragEndPoint.x) / 2 : 0;
  const dragMidY = dragStartPoint && dragEndPoint ? (dragStartPoint.y + dragEndPoint.y) / 2 : 0;

  const displayedPrice = dragEndPoint ? dragEndPoint.value : hovered ? hovered.value : displayPrice;

  return (
    <>
      <button type="button" className="back-button" onClick={onBack} aria-label="Back">&larr;</button>
      <div className="page-heading">
        <div>
          <h1>{ticker}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ margin: 0 }}>{holding.name}</p>
            <span className={`sector-badge sector-${sectorClass}`}>{sector}</span>
          </div>
        </div>
        <div className="holdings-toolbar" style={{ marginBottom: 0 }}>
          <button type="button" className="primary-button" onClick={() => setIsBuying(true)}>Buy</button>
          <button type="button" className="primary-button" onClick={() => setIsSelling(true)}>Sell</button>
        </div>
      </div>

      <Card className="performance-card">
        <div className="accent-glow" aria-hidden="true" />
        <div className="performance-header fade-slide-in">
          <div>
            <span className="eyebrow">Current price</span>
            <h1 className="portfolio-value">{formatPrice(displayedPrice)}</h1>
            <div className="range-summary">
              {dragRange ? (
                <span className={`change-pill ${dragTone}`}>
                  {dragChangeValue >= 0 ? '▲' : '▼'} {formatSignedCurrency(dragChangeValue)} ({formatSignedPercent(dragChangePercent)}) selected
                </span>
              ) : (
                <span className={`change-pill ${rangeTone}`}>
                  {rangeChange >= 0 ? '▲' : '▼'} {formatSignedCurrency(rangeChange)} ({formatSignedPercent(rangeChangePercent)})
                </span>
              )}
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
          <div
            className="chart-plot"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <svg key={range} className="chart-svg-animate" viewBox="0 0 720 210" preserveAspectRatio="none" role="img" aria-label={`${ticker} performance for the ${series.label}`}>
              <defs>
                <linearGradient id="stockArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={paths.area} fill="url(#stockArea)" />
              {dragStartPoint && dragEndPoint && (
                <rect
                  x={Math.min(dragStartPoint.x, dragEndPoint.x)}
                  y="0"
                  width={Math.max(1, Math.abs(dragEndPoint.x - dragStartPoint.x))}
                  height={paths.height}
                  fill={dragColor}
                  fillOpacity="0.14"
                />
              )}
              <path d={paths.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {hovered && (
                <line x1={hovered.x} x2={hovered.x} y1="0" y2={paths.height} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
              {dragStartPoint && dragEndPoint && (
                <>
                  <line x1={dragStartPoint.x} x2={dragStartPoint.x} y1="0" y2={paths.height} stroke={dragColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  <line x1={dragEndPoint.x} x2={dragEndPoint.x} y1="0" y2={paths.height} stroke={dragColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                </>
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
            {dragStartPoint && dragEndPoint && (
              <>
                <span className="chart-dot" style={{ left: `${(dragStartPoint.x / paths.width) * 100}%`, top: `${(dragStartPoint.y / paths.height) * 100}%`, background: dragColor, boxShadow: `0 0 0 3px ${dragTone === 'positive' ? 'var(--positive-soft)' : 'var(--negative-soft)'}` }} />
                <span className="chart-dot" style={{ left: `${(dragEndPoint.x / paths.width) * 100}%`, top: `${(dragEndPoint.y / paths.height) * 100}%`, background: dragColor, boxShadow: `0 0 0 3px ${dragTone === 'positive' ? 'var(--positive-soft)' : 'var(--negative-soft)'}` }} />
                <div
                  className="chart-tooltip"
                  data-flip={dragMidY / paths.height < 0.3}
                  style={{
                    left: `${Math.min(92, Math.max(8, (dragMidX / paths.width) * 100))}%`,
                    top: `${(dragMidY / paths.height) * 100}%`,
                  }}
                >
                  <strong className={dragTone}>{formatSignedCurrency(dragChangeValue)}</strong>
                  <span>{formatSignedPercent(dragChangePercent)}</span>
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
          value={formatSignedCurrency(liveTotalGainLoss)}
          detail={formatSignedPercent(avgCost ? (liveTotalGainLoss / (avgCost * holding.quantity)) * 100 : 0)}
          tone={liveTotalGainLoss < 0 ? 'negative' : 'positive'}
        />
        <MetricCard label="Market value" value={formatCurrency(holding.quantity * displayPrice)} />
        <MetricCard label="Allocation" value={`${holding.allocation.toFixed(1)}%`} />
      </div>

      <div className="section-heading">
        <h2>Analyst &amp; earnings</h2>
      </div>
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <MetricCard
          label="Next earnings"
          value={analysis?.earningsDate ? formatDate(analysis.earningsDate) : '—'}
          detail={earningsDetail}
        />
        <MetricCard
          label="Analyst rating"
          value={recommendationLabel ?? '—'}
          detail={analysis?.numberOfAnalysts ? `${analysis.numberOfAnalysts} analysts` : undefined}
        />
        <MetricCard
          label="Price target (mean)"
          value={analysis?.targetMeanPrice ? formatPrice(analysis.targetMeanPrice) : '—'}
          detail={targetUpsidePercent !== null ? `${formatSignedPercent(targetUpsidePercent)} vs current` : undefined}
          tone={targetUpsidePercent === null ? 'neutral' : targetUpsidePercent >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Price target range"
          value={
            analysis?.targetLowPrice && analysis?.targetHighPrice
              ? `${formatPrice(analysis.targetLowPrice)} – ${formatPrice(analysis.targetHighPrice)}`
              : '—'
          }
        />
      </div>

      {isBuying && <AddHoldingForm initialTicker={ticker} onCancel={() => setIsBuying(false)} onSubmit={handleBuy} />}
      {isSelling && <SellHoldingForm holding={holding} onCancel={() => setIsSelling(false)} onConfirm={handleSell} />}
      {toastMessage && (
        <Toast message={toastMessage} tone={toastTone} onDismiss={() => setToastMessage(null)} />
      )}
    </>
  );
}
