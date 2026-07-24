import { allocations, holdings } from '../../data/mockPortfolio';
import { Card } from '../common/Card';

export function AllocationCard() {
  let cumulative = 0;
  const circumference = 2 * Math.PI * 54;
  const segments = allocations.map((item) => {
    const length = (item.percentage / 100) * circumference;
    const offset = -(cumulative / 100) * circumference;
    cumulative += item.percentage;
    return { ...item, dash: `${length} ${circumference - length}`, offset };
  });

  return (
    <Card className="allocation-card">
      <span className="eyebrow">Asset allocation</span>
      <div className="allocation-content">
        <div className="donut-wrap">
          <svg viewBox="0 0 132 132" role="img" aria-label="Asset allocation: 68.5% stocks, 21.5% bonds, 10% cash">
            <circle cx="66" cy="66" r="54" fill="none" stroke="var(--track)" strokeWidth="16" />
            {segments.map((segment) => (
              <circle
                key={segment.name}
                cx="66"
                cy="66"
                r="54"
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={segment.dash}
                strokeDashoffset={segment.offset}
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
