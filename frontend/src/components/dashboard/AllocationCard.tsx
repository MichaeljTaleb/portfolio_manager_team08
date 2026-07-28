import { useEffect, useState } from 'react';
import { fetchAllocation, fetchHoldings } from '../../api/client';
import type { AllocationItem } from '../../types/portfolio';
import { Card } from '../common/Card';

export function AllocationCard() {
  const [drawn, setDrawn] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [holdingsCount, setHoldingsCount] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    fetchAllocation().then(setAllocations);
    fetchHoldings().then((holdings) => setHoldingsCount(holdings.length));
  }, []);

  let cumulative = 0;
  const circumference = 2 * Math.PI * 54;
  const segments = allocations.map((item) => {
    const length = (item.percentage / 100) * circumference;
    const offset = -(cumulative / 100) * circumference;
    cumulative += item.percentage;
    return { ...item, length, offset };
  });

  const hoveredSegment = segments.find((segment) => segment.name === hovered) ?? null;

  return (
    <Card className="allocation-card">
      <span className="eyebrow">Asset allocation</span>
      <div className="allocation-content fade-slide-in">
        <div className="donut-wrap">
          <svg viewBox="0 0 132 132" role="img" aria-label="Asset allocation breakdown">
            <circle cx="66" cy="66" r="54" fill="none" stroke="var(--track)" strokeWidth="16" />
            {segments.map((segment, index) => (
              <circle
                key={segment.name}
                className="donut-segment"
                data-dimmed={hovered !== null && hovered !== segment.name}
                cx="66"
                cy="66"
                r="54"
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={drawn ? segment.offset : segment.offset + segment.length}
                style={{ transitionDelay: `${index * 120}ms` }}
                onMouseEnter={() => setHovered(segment.name)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div className="donut-label">
            {hoveredSegment ? (
              <>
                <span>{hoveredSegment.name}</span>
                <strong>{hoveredSegment.percentage.toFixed(1)}%</strong>
              </>
            ) : (
              <>
                <span>Holdings</span>
                <strong>{holdingsCount}</strong>
              </>
            )}
          </div>
        </div>
        <div className="allocation-legend">
          {allocations.map((item) => (
            <div
              className="legend-item"
              key={item.name}
              data-active={hovered === item.name}
              onMouseEnter={() => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="legend-dot" style={{ background: item.color }} />
              <span>{item.name}</span>
              <strong>{item.percentage.toFixed(1)}%</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
