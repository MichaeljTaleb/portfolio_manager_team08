import { useEffect, useState } from 'react';
import { AllocationCard } from '../components/dashboard/AllocationCard';
import { MetricCard } from '../components/dashboard/MetricCard';
import { PerformanceChart } from '../components/dashboard/PerformanceChart';
import { HoldingsTable } from '../components/holdings/HoldingsTable';
import { fetchAllocation, fetchHoldings, fetchSummary, type PortfolioSummary } from '../api/client';
import type { AllocationItem, Holding, TimeRange } from '../types/portfolio';
import { formatAsOf, formatPrice, formatSignedCurrency, formatSignedPercent, getGreeting } from '../utils/formatters';

interface DashboardPageProps {
  onViewHoldings: () => void;
}

export function DashboardPage({ onViewHoldings }: DashboardPageProps) {
  const [range, setRange] = useState<TimeRange>('1M');
  const [now, setNow] = useState(() => new Date());
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchHoldings().then(setHoldings);
    fetchSummary().then(setSummary);
    fetchAllocation().then(setAllocations);
  }, []);

  const cashPercentage = allocations.find((item) => item.name === 'Cash')?.percentage ?? 0;
  const cashValue = ((summary?.totalValue ?? 0) * cashPercentage) / 100;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{getGreeting(now)}, Sang</h1>
          <div className="page-subline">
            <p>Here&apos;s how your portfolio is doing today</p>
          </div>
        </div>
        <span className="page-heading-asof">As of {formatAsOf(now)}</span>
      </div>

      <div className="dashboard-grid">
        <PerformanceChart range={range} onRangeChange={setRange} totalValue={summary?.totalValue ?? 0} />
        <div className="dashboard-rail">
          <div className="metric-grid">
            <MetricCard label="Today's change" value={formatSignedCurrency(summary?.dayGain ?? 0)} detail={`${formatSignedPercent(summary?.dayGainPercent ?? 0)} today`} tone={(summary?.dayGain ?? 0) < 0 ? 'negative' : 'positive'} />
            <MetricCard label="Total return" value={formatSignedCurrency(summary?.totalReturn ?? 0)} detail={`${formatSignedPercent(summary?.totalReturnPercent ?? 0)} all time`} tone={(summary?.totalReturn ?? 0) < 0 ? 'negative' : 'positive'} />
          </div>
          <MetricCard label="Cash Balance" value={formatPrice(cashValue)} tone="neutral" />
          <AllocationCard />
        </div>
      </div>

      <div className="section-heading">
        <h2>Portfolio holdings</h2>
        <button type="button" className="text-button" onClick={onViewHoldings}>
          View all holdings <span className="text-button-arrow">&rarr;</span>
        </button>
      </div>
      <HoldingsTable holdings={holdings.slice(0, 5)} />
    </>
  );
}
