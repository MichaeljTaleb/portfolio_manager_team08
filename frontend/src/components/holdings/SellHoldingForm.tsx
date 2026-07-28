import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Holding } from '../../types/portfolio';
import { formatCurrency, formatQuantity } from '../../utils/formatters';

interface SellHoldingFormProps {
  holding: Holding;
  onCancel: () => void;
  onConfirm: (quantity: number) => void;
}

export function SellHoldingForm({ holding, onCancel, onConfirm }: SellHoldingFormProps) {
  const isCash = holding.type === 'Cash';
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const actionLabel = isCash ? 'Withdraw' : 'Sell';
  const unitLabel = isCash ? '$' : 'shares/units';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(quantity);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(`Enter a ${isCash ? 'amount' : 'quantity'} greater than 0.`);
      return;
    }
    if (parsed > holding.quantity) {
      setError(`You only hold ${formatQuantity(holding.quantity)} ${unitLabel}.`);
      return;
    }

    onConfirm(parsed);
  };

  const estimatedProceeds = (Number(quantity) || 0) * holding.currentPrice;

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sell-holding-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="sell-holding-title">{actionLabel} {holding.ticker}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <p className="confirm-message">
            You currently hold {formatQuantity(holding.quantity)} {unitLabel} of {holding.name}.
          </p>
          <label className="form-field">
            <span>{isCash ? 'Amount ($)' : 'Quantity'}</span>
            <input
              type="number"
              min="0"
              step={isCash ? '0.01' : '0.001'}
              max={holding.quantity}
              value={quantity}
              onChange={(event) => { setQuantity(event.target.value); setError(null); }}
              placeholder={isCash ? '1000' : '10'}
              autoFocus
            />
          </label>
          {!isCash && quantity && Number(quantity) > 0 && (
            <p className="confirm-message">Estimated proceeds: {formatCurrency(estimatedProceeds)}</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">{actionLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
