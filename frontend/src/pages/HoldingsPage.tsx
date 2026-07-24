import { MetricCard } from '../components/dashboard/MetricCard';
import { HoldingsTable } from '../components/holdings/HoldingsTable';
import { holdings, portfolioSummary } from '../data/mockPortfolio';
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '../utils/formatters';

export function HoldingsPage() {
  return (
    <>
      <div className="page-heading holdings-heading">
        <div><h1>Holdings</h1><p>{holdings.length} positions across stocks, bonds, and cash.</p></div>
        <button type="button" className="primary-button">+ Add holding</button>
      </div>
      <div className="holdings-metrics">
        <MetricCard label="Market value" value={formatCurrency(portfolioSummary.totalValue)} />
        <MetricCard label="Today's change" value={formatSignedCurrency(portfolioSummary.dayGain)} tone="positive" />
        <MetricCard label="Total return" value={formatSignedCurrency(portfolioSummary.totalReturn)} detail={`(${formatSignedPercent(portfolioSummary.totalReturnPercent, 1)})`} tone="positive" />
      </div>
      <HoldingsTable holdings={holdings} />
    </>
  );
}
