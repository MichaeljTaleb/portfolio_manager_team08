import { Card } from '../components/common/Card';

export function AnalyticsPage() {
  return (
    <>
      <div className="page-heading"><div><h1>Analytics</h1><p>Deeper portfolio insights will live here.</p></div></div>
      <Card className="empty-state">
        <span className="empty-icon">↗</span>
        <h2>Analytics UI coming next</h2>
        <p>This frontend-only placeholder keeps the navigation structure ready without adding backend functionality.</p>
      </Card>
    </>
  );
}
