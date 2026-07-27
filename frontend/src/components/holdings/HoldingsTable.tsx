import type { Holding } from '../../types/portfolio';
import { formatCurrency, formatPrice, formatQuantity, formatSignedCurrency, formatSignedPercent } from '../../utils/formatters';
import { Card } from '../common/Card';

interface HoldingsTableProps {
  holdings: Holding[];
  onRequestRemove?: (holding: Holding) => void;
}

export function HoldingsTable({ holdings, onRequestRemove }: HoldingsTableProps) {
  return (
    <Card className="table-card">
      <div className="table-scroll">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>Holding</th>
              <th>Type</th>
              <th className="numeric">Quantity</th>
              <th className="numeric">Current price</th>
              <th className="numeric">Today (%)</th>
              <th className="numeric">Total gain/loss</th>
              <th className="numeric">Allocation</th>
              <th className="numeric">Value</th>
              {onRequestRemove && <th className="row-action-col" aria-hidden="true" />}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const isCash = holding.type === 'Cash';
              return (
                <tr key={holding.id} className="holding-row">
                  <td>
                    <div className="holding-cell">
                      <span className={`ticker-badge ${holding.type.toLowerCase()}`}>{holding.ticker}</span>
                      <div><strong>{holding.ticker}</strong><span>{holding.name}</span></div>
                    </div>
                  </td>
                  <td><span className={`asset-tag ${holding.type.toLowerCase()}`}>{holding.type}</span></td>
                  <td className="numeric">{isCash ? '—' : formatQuantity(holding.quantity)}</td>
                  <td className="numeric">{isCash ? '—' : formatPrice(holding.currentPrice)}</td>
                  <td className={`numeric ${holding.dailyChange > 0 ? 'positive' : holding.dailyChange < 0 ? 'negative' : 'muted'}`}>{formatSignedPercent(holding.dailyChange)}</td>
                  <td className={`numeric ${holding.totalGainLoss > 0 ? 'positive' : holding.totalGainLoss < 0 ? 'negative' : 'muted'}`}>
                    {formatSignedCurrency(holding.totalGainLoss)}
                  </td>
                  <td className="numeric">{holding.allocation.toFixed(1)}%</td>
                  <td className="numeric holding-value">{formatCurrency(holding.value)}</td>
                  {onRequestRemove && (
                    <td className="row-action-col">
                      <button
                        type="button"
                        className="row-remove-button"
                        aria-label={`Remove ${holding.ticker}`}
                        onClick={() => onRequestRemove(holding)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
