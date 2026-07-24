import { useState } from 'react';
import { AllocationCard } from '../components/dashboard/AllocationCard';
import { MetricCard } from '../components/dashboard/MetricCard';
import { PerformanceChart } from '../components/dashboard/PerformanceChart';
import { HoldingsTable } from '../components/holdings/HoldingsTable';
import { holdings, portfolioSummary } from '../data/mockPortfolio';
import type { TimeRange } from '../types/portfolio';
import { formatSignedCurrency, formatSignedPercent } from '../utils/formatters';

interface DashboardPageProps {
  onViewHoldings: () => void;
}

export function DashboardPage({ onViewHoldings }: DashboardPageProps) {
  const [range, setRange] = useState<TimeRange>('1M');

  return (
    <>
      <div className="page-heading">
        <div><h1>Good afternoon, Sang</h1><p>Here&apos;s how your portfolio is doing today.</p></div>
        <span>As of {portfolioSummary.asOf}</span>
      </div>

      <div className="dashboard-grid">
        <PerformanceChart range={range} onRangeChange={setRange} />
        <div className="dashboard-rail">
          <div className="metric-grid">
            <MetricCard label="Today's gain" value={formatSignedCurrency(portfolioSummary.dayGain)} detail={`${formatSignedPercent(portfolioSummary.dayGainPercent)} today`} tone="positive" />
            <MetricCard label="Total return" value={formatSignedCurrency(portfolioSummary.totalReturn)} detail={`${formatSignedPercent(portfolioSummary.totalReturnPercent, 1)} all time`} tone="positive" />
          </div>
          <AllocationCard />
        </div>
      </div>

      <div className="section-heading">
        <h2>Portfolio holdings</h2>
        <button type="button" className="text-button" onClick={onViewHoldings}>View all holdings</button>
      </div>
      <HoldingsTable holdings={holdings.slice(0, 5)} compact />
    </>
  );
}
