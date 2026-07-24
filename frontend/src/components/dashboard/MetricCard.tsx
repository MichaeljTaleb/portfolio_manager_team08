import { Card } from '../common/Card';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export function MetricCard({ label, value, detail, tone = 'neutral' }: MetricCardProps) {
  return (
    <Card className="metric-card">
      <span className="eyebrow">{label}</span>
      <strong className={`metric-value ${tone}`}>{value}</strong>
      {detail && <span className={`metric-detail ${tone}`}>{detail}</span>}
    </Card>
  );
}
