import type { Holding } from '../../types/portfolio';
import { formatCurrency, formatPrice, formatQuantity, formatSignedCurrency, formatSignedPercent } from '../../utils/formatters';
import { Card } from '../common/Card';
import { RowActionsMenu } from './RowActionsMenu';

interface HoldingsTableProps {
  holdings: Holding[];
  onRequestSell?: (holding: Holding) => void;
  onRequestRemove?: (holding: Holding) => void;
}

export function HoldingsTable({ holdings, onRequestSell, onRequestRemove }: HoldingsTableProps) {
  const showActions = Boolean(onRequestSell || onRequestRemove);

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
              {showActions && <th className="row-action-col" aria-hidden="true" />}
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
                  {showActions && (
                    <td className="row-action-col">
                      <RowActionsMenu
                        label={holding.ticker}
                        sellLabel={isCash ? 'Withdraw' : 'Sell'}
                        onSell={() => onRequestSell?.(holding)}
                        onRemove={() => onRequestRemove?.(holding)}
                      />
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
