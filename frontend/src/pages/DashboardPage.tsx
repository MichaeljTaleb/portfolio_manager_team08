import { useEffect, useMemo, useState } from 'react';
import { AllocationCard } from '../components/dashboard/AllocationCard';
import { MetricCard } from '../components/dashboard/MetricCard';
import { PerformanceChart } from '../components/dashboard/PerformanceChart';
import { HoldingsTable } from '../components/holdings/HoldingsTable';
import { fetchAllocation, fetchCash, fetchHoldings, fetchSummary, type PortfolioSummary } from '../api/client';
import { computeDayGain, usePreviousCloses, useLivePrices, withLiveDailyChange } from '../contexts/LivePricesContext';
import { getFirstName, useUser } from '../contexts/UserContext';
import type { AllocationItem, CashSummary, Holding, TimeRange } from '../types/portfolio';
import { formatAsOf, formatPrice, formatSignedCurrency, formatSignedPercent, getGreeting } from '../utils/formatters';

let cachedHoldings: Holding[] = [];
let cachedSummary: PortfolioSummary | null = null;
let cachedAllocations: AllocationItem[] = [];
let cachedCash: CashSummary | null = null;

interface DashboardPageProps {
  onViewHoldings: () => void;
}

export function DashboardPage({ onViewHoldings }: DashboardPageProps) {
  const [range, setRange] = useState<TimeRange>('1M');
  const [now, setNow] = useState(() => new Date());
  const [holdings, setHoldings] = useState<Holding[]>(cachedHoldings);
  const [summary, setSummary] = useState<PortfolioSummary | null>(cachedSummary);
  const [allocations, setAllocations] = useState<AllocationItem[]>(cachedAllocations);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(cachedCash);
  const livePrices = useLivePrices();
  const previousCloses = usePreviousCloses();
  const { profile } = useUser();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      try {
        const [nextHoldings, nextSummary, nextAllocations, nextCash] = await Promise.all([
          fetchHoldings(),
          fetchSummary(),
          fetchAllocation(),
          fetchCash(),
        ]);

        if (!active) return;

        cachedHoldings = nextHoldings;
        cachedSummary = nextSummary;
        cachedAllocations = nextAllocations;
        cachedCash = nextCash;

        setHoldings(nextHoldings);
        setSummary(nextSummary);
        setAllocations(nextAllocations);
        setCashSummary(nextCash);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      }
    };

    void loadDashboardData();

    return () => {
      active = false;
    };
  }, []);

  const liveHoldings = useMemo(
    () => withLiveDailyChange(holdings, livePrices, previousCloses),
    [holdings, livePrices, previousCloses],
  );
  const { dayGain, dayGainPercent } = useMemo(
    () => computeDayGain(liveHoldings, summary?.totalValue ?? 0),
    [liveHoldings, summary],
  );
  const liveTotalValue = (summary?.totalValue ?? 0) + dayGain;
  const cashValue = cashSummary?.balance ?? 0;

  const totalGainLoss = useMemo(
    () => liveHoldings.reduce((sum, holding) => sum + holding.totalGainLoss, 0),
    [liveHoldings],
  );
  const totalGainLossPercent = liveTotalValue ? (totalGainLoss / liveTotalValue) * 100 : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{getGreeting(now)}, {getFirstName(profile.name)}</h1>
          <div className="page-subline">
            <p>Here&apos;s how your portfolio is doing today</p>
          </div>
        </div>
        <span className="page-heading-asof">As of {formatAsOf(now)}</span>
      </div>

      <div className="dashboard-grid">
        <PerformanceChart range={range} onRangeChange={setRange} totalValue={liveTotalValue} />
        <div className="dashboard-rail">
          <div className="metric-grid">
            <MetricCard label="Today's change" value={formatSignedCurrency(dayGain)} detail={`${formatSignedPercent(dayGainPercent)} today`} tone={dayGain < 0 ? 'negative' : 'positive'} />
            <MetricCard label="Total return" value={formatSignedCurrency(totalGainLoss)} detail={`${formatSignedPercent(totalGainLossPercent)} all time`} tone={totalGainLoss < 0 ? 'negative' : 'positive'} />
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
      <HoldingsTable holdings={liveHoldings.slice(0, 5)} />
    </>
  );
}
