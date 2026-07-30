import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Holding } from '../../types/portfolio';
import { useLivePrices } from '../../contexts/LivePricesContext';
import { formatPrice } from '../../utils/formatters';

interface AddHoldingFormProps {
  onCancel: () => void;
  onSubmit: (holding: Omit<Holding, 'id' | 'allocation'>) => void | Promise<void>;
}

export function AddHoldingForm({ onCancel, onSubmit }: AddHoldingFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const livePrices = useLivePrices();

  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');

  const livePrice = ticker ? (livePrices[ticker.toUpperCase()] ?? null) : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedTicker = ticker.trim().toUpperCase();
    const qty = Number(quantity);
    const price = livePrice ?? 0;

    if (!trimmedTicker) return setError('Enter a ticker.');
    if (!Number.isFinite(qty) || qty <= 0) return setError('Enter a quantity greater than 0.');
    if (!price) return setError('Price not available. Try searching again.');

    setIsSubmitting(true);
    try {
      await onSubmit({
        ticker: trimmedTicker,
        name: trimmedTicker,
        type: 'Stocks',
        quantity: qty,
        currentPrice: price,
        value: qty * price,
        dailyChange: 0,
        totalGainLoss: 0,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-holding-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="buy-holding-title">Buy holdings</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel} disabled={isSubmitting}>×</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <fieldset className="modal-fieldset" disabled={isSubmitting}>
            <label className="form-field">
              <span>Ticker</span>
              <input
                type="text"
                value={ticker}
                onChange={(event) => { setTicker(event.target.value); setError(null); }}
                placeholder="e.g. AAPL"
                maxLength={8}
                autoFocus
              />
            </label>
            {ticker && (
              <label className="form-field">
                <span>Current price</span>
                <div style={{ padding: '8px', background: 'var(--background-secondary)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                  {livePrice ? formatPrice(livePrice) : 'Loading...'}
                </div>
              </label>
            )}
            <label className="form-field">
              <span>Quantity</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(event) => { setQuantity(event.target.value); setError(null); }}
                placeholder="10"
                disabled={!ticker}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
          </fieldset>

          <div className="modal-actions">
            <button type="button" className="text-button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSubmitting || !livePrice}>
              {isSubmitting ? 'Buying…' : 'Buy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
