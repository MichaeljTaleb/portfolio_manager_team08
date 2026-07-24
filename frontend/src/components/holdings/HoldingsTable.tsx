import type { Holding } from '../../types/portfolio';
import { formatCurrency, formatSignedPercent } from '../../utils/formatters';
import { Card } from '../common/Card';

interface HoldingsTableProps {
  holdings: Holding[];
  compact?: boolean;
}

export function HoldingsTable({ holdings, compact = false }: HoldingsTableProps) {
  const maxAllocation = Math.max(...holdings.map((holding) => holding.allocation));

  return (
    <Card className="table-card">
      <div className="table-scroll">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>Holding</th>
              {!compact && <th>Type</th>}
              {compact && <th>Allocation</th>}
              <th className="numeric">Today</th>
              <th className="numeric">Value</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr key={holding.ticker}>
                <td>
                  <div className="holding-cell">
                    <span className={`ticker-badge ${holding.type.toLowerCase()}`}>{holding.ticker}</span>
                    <div><strong>{holding.ticker}</strong><span>{holding.name}</span></div>
                  </div>
                </td>
                {!compact && <td><span className={`asset-tag ${holding.type.toLowerCase()}`}>{holding.type}</span></td>}
                {compact && (
                  <td>
                    <div className="allocation-bar-row">
                      <span className="allocation-bar"><span style={{ width: `${(holding.allocation / maxAllocation) * 100}%` }} /></span>
                      <span>{holding.allocation.toFixed(1)}%</span>
                    </div>
                  </td>
                )}
                <td className={`numeric ${holding.dailyChange > 0 ? 'positive' : holding.dailyChange < 0 ? 'negative' : 'muted'}`}>{formatSignedPercent(holding.dailyChange)}</td>
                <td className="numeric holding-value">{formatCurrency(holding.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
