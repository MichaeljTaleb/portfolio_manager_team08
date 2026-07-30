import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Holding } from '../../types/portfolio';
import { useLivePrices } from '../../contexts/LivePricesContext';
import { formatCurrency, formatPrice, formatQuantity } from '../../utils/formatters';

interface SellHoldingFormProps {
  holding: Holding;
  onCancel: () => void;
  onConfirm: (quantity: number) => void | Promise<void>;
}

export function SellHoldingForm({ holding, onCancel, onConfirm }: SellHoldingFormProps) {
  const isCash = holding.type === 'Cash';
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const livePrices = useLivePrices();

  const actionLabel = isCash ? 'Withdraw' : 'Sell';
  const unitLabel = isCash ? '$' : 'shares/units';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const parsed = Number(quantity);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(`Enter a ${isCash ? 'amount' : 'quantity'} greater than 0.`);
      return;
    }
    if (!isCash && !Number.isInteger(parsed)) {
      setError('Enter a whole number of shares');
      return;
    }
    if (parsed > holding.quantity) {
      setError(`You only hold ${formatQuantity(holding.quantity)} ${unitLabel}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const livePrice = livePrices[holding.ticker] ?? holding.currentPrice;
  const estimatedProceeds = (Number(quantity) || 0) * livePrice;

  return (
    <div className="modal-overlay" role="presentation" onClick={isSubmitting ? undefined : onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sell-holding-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="sell-holding-title">{actionLabel} {holding.ticker}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel} disabled={isSubmitting}>×</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <p className="confirm-message">
            You currently hold {formatQuantity(holding.quantity)} {unitLabel} of {holding.name}
          </p>
          {!isCash && (
            <label className="form-field">
              <span>Sell price</span>
              <div style={{ padding: '8px', background: 'var(--background-secondary)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                {formatPrice(livePrice)}
              </div>
            </label>
          )}
          <label className="form-field">
            <span>{isCash ? 'Amount ($)' : 'Quantity'}</span>
            <input
              type="number"
              min="0"
              step={isCash ? '0.01' : '1'}
              max={holding.quantity}
              value={quantity}
              onChange={(event) => { setQuantity(event.target.value); setError(null); }}
              placeholder={isCash ? '1000' : '10'}
              autoFocus
              disabled={isSubmitting}
            />
          </label>
          {!isCash && quantity && Number(quantity) > 0 && (
            <p className="confirm-message">Proceeds: {formatCurrency(estimatedProceeds)}</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="text-button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? `${actionLabel}ing…` : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
