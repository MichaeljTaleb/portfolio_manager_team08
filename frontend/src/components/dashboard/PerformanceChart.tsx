import { useEffect, useMemo, useState } from 'react';
import type { PerformanceSeries, TimeRange } from '../../types/portfolio';
import { buildChartPaths } from '../../utils/chart';
import { useChartRangeSelect } from '../../utils/useChartRangeSelect';
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '../../utils/formatters';
import { fetchPerformance } from '../../api/client';
import { Card } from '../common/Card';

interface PerformanceChartProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
}

const ranges: TimeRange[] = ['1W', '2W', '3W', '1M'];
const emptySeries: PerformanceSeries = { values: [], dates: [], axis: [], label: '' };

export function PerformanceChart({ range, onRangeChange, totalValue, totalReturn, totalReturnPercent }: PerformanceChartProps) {
  const [series, setSeries] = useState<PerformanceSeries>(emptySeries);

  useEffect(() => {
    fetchPerformance(range).then(setSeries);
  }, [range]);

  const paths = useMemo(() => {
    const vals = series.values.length ? series.values : [totalValue];
    return buildChartPaths(vals);
  }, [series.values, totalValue]);

  const { hoverIndex, dragRange, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } = useChartRangeSelect(paths);

  const tone = totalReturn >= 0 ? 'positive' : 'negative';

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

  const displayedValue = dragEndPoint ? dragEndPoint.value : hovered ? hovered.value : totalValue;

  return (
    <Card className="performance-card">
      <div className="accent-glow" aria-hidden="true" />
      <div className="performance-header fade-slide-in">
        <div>
          <span className="eyebrow">Total portfolio value</span>
          <h1 className="portfolio-value">{formatCurrency(displayedValue)}</h1>
          <div className="range-summary">
            {dragRange ? (
              <span className={`change-pill ${dragTone}`}>
                {dragChangeValue >= 0 ? '▲' : '▼'} {formatSignedCurrency(dragChangeValue)} ({formatSignedPercent(dragChangePercent)}) selected
              </span>
            ) : (
              <span className={`change-pill ${tone}`}>
                {totalReturn >= 0 ? '▲' : '▼'} {formatSignedCurrency(totalReturn)} ({formatSignedPercent(totalReturnPercent)})
              </span>
            )}
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
        <svg key={range} className="chart-svg-animate" viewBox="0 0 720 210" preserveAspectRatio="none" role="img" aria-label={`Portfolio performance for the ${series.label}`}>
          <defs>
            <linearGradient id="portfolioArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={paths.area} fill="url(#portfolioArea)" />
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
          {dragStartPoint && dragEndPoint && (
            <>
              <line x1={dragStartPoint.x} x2={dragStartPoint.x} y1="0" y2={paths.height} stroke={dragColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={dragEndPoint.x} x2={dragEndPoint.x} y1="0" y2={paths.height} stroke={dragColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </>
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
          {series.axis.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
    </Card>
  );
}
