import { useEffect, useState } from 'react';
import { allocations, holdings } from '../../data/mockPortfolio';
import { Card } from '../common/Card';

export function AllocationCard() {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  let cumulative = 0;
  const circumference = 2 * Math.PI * 54;
  const segments = allocations.map((item) => {
    const length = (item.percentage / 100) * circumference;
    const offset = -(cumulative / 100) * circumference;
    cumulative += item.percentage;
    return { ...item, length, offset };
  });

  return (
    <Card className="allocation-card">
      <span className="eyebrow">Asset allocation</span>
      <div className="allocation-content fade-slide-in">
        <div className="donut-wrap">
          <svg viewBox="0 0 132 132" role="img" aria-label="Asset allocation: 68.5% stocks, 21.5% bonds, 10% cash">
            <circle cx="66" cy="66" r="54" fill="none" stroke="var(--track)" strokeWidth="16" />
            {segments.map((segment, index) => (
              <circle
                key={segment.name}
                className="donut-segment"
                cx="66"
                cy="66"
                r="54"
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={drawn ? segment.offset : segment.offset + segment.length}
                style={{ transitionDelay: `${index * 120}ms` }}
              />
            ))}
          </svg>
          <div className="donut-label"><span>Holdings</span><strong>{holdings.length}</strong></div>
        </div>
        <div className="allocation-legend">
          {allocations.map((item) => (
            <div className="legend-item" key={item.name}>
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
