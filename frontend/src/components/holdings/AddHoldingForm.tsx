import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AssetType, Holding } from '../../types/portfolio';

interface AddHoldingFormProps {
  onCancel: () => void;
  onSubmit: (holding: Omit<Holding, 'id' | 'allocation'>) => void;
}

const assetTypes: AssetType[] = ['Stocks', 'Bonds', 'Cash'];

const toShortCode = (value: string, fallback: string) => {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 5) || fallback;
};

export function AddHoldingForm({ onCancel, onSubmit }: AddHoldingFormProps) {
  const [type, setType] = useState<AssetType>('Stocks');
  const [error, setError] = useState<string | null>(null);

  // Stock fields
  const [ticker, setTicker] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [averageCost, setAverageCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  // Bond fields
  const [bondName, setBondName] = useState('');
  const [bondQuantity, setBondQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [couponRate, setCouponRate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');

  // Cash fields
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (type === 'Stocks') {
      const trimmedTicker = ticker.trim().toUpperCase();
      const quantity = Number(stockQuantity);
      const cost = Number(averageCost);

      if (!trimmedTicker) return setError('Enter a ticker.');
      if (!Number.isFinite(quantity) || quantity <= 0) return setError('Enter a quantity greater than 0.');
      if (!Number.isFinite(cost) || cost <= 0) return setError('Enter an average cost greater than 0.');

      onSubmit({
        ticker: trimmedTicker,
        name: trimmedTicker,
        type,
        quantity,
        currentPrice: cost,
        value: quantity * cost,
        dailyChange: 0,
        totalGainLoss: 0,
        purchaseDate: purchaseDate || undefined,
      });
      return;
    }

    if (type === 'Bonds') {
      const trimmedName = bondName.trim();
      const quantity = Number(bondQuantity);
      const price = Number(purchasePrice);
      const coupon = Number(couponRate);

      if (!trimmedName) return setError('Enter a bond name.');
      if (!Number.isFinite(quantity) || quantity <= 0) return setError('Enter a quantity greater than 0.');
      if (!Number.isFinite(price) || price <= 0) return setError('Enter a purchase price greater than 0.');
      if (!Number.isFinite(coupon) || coupon < 0) return setError('Enter a valid coupon rate.');
      if (!maturityDate) return setError('Enter a maturity date.');

      onSubmit({
        ticker: toShortCode(trimmedName, 'BOND'),
        name: trimmedName,
        type,
        quantity,
        currentPrice: price,
        value: quantity * price,
        dailyChange: 0,
        totalGainLoss: 0,
        couponRate: coupon,
        maturityDate,
      });
      return;
    }

    const trimmedAccount = accountName.trim();
    const parsedAmount = Number(amount);

    if (!trimmedAccount) return setError('Enter an account name.');
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setError('Enter an amount greater than 0.');

    onSubmit({
      ticker: toShortCode(trimmedAccount, 'CASH'),
      name: trimmedAccount,
      type,
      quantity: parsedAmount,
      currentPrice: 1,
      value: parsedAmount,
      dailyChange: 0,
      totalGainLoss: 0,
    });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-holding-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="add-holding-title">Add holding</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Asset type</span>
            <select value={type} onChange={(event) => { setType(event.target.value as AssetType); setError(null); }}>
              {assetTypes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          {type === 'Stocks' && (
            <>
              <label className="form-field">
                <span>Ticker</span>
                <input
                  type="text"
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value)}
                  placeholder="e.g. VTI"
                  maxLength={8}
                  autoFocus
                />
              </label>
              <div className="form-row">
                <label className="form-field">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                    placeholder="100"
                  />
                </label>
                <label className="form-field">
                  <span>Average cost ($)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={averageCost}
                    onChange={(event) => setAverageCost(event.target.value)}
                    placeholder="150.00"
                  />
                </label>
              </div>
              <label className="form-field">
                <span>Purchase date (optional)</span>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
              </label>
            </>
          )}

          {type === 'Bonds' && (
            <>
              <label className="form-field">
                <span>Bond name</span>
                <input
                  type="text"
                  value={bondName}
                  onChange={(event) => setBondName(event.target.value)}
                  placeholder="e.g. US Treasury 10Y"
                  autoFocus
                />
              </label>
              <div className="form-row">
                <label className="form-field">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={bondQuantity}
                    onChange={(event) => setBondQuantity(event.target.value)}
                    placeholder="50"
                  />
                </label>
                <label className="form-field">
                  <span>Purchase price ($)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    placeholder="98.50"
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="form-field">
                  <span>Coupon rate (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={couponRate}
                    onChange={(event) => setCouponRate(event.target.value)}
                    placeholder="4.25"
                  />
                </label>
                <label className="form-field">
                  <span>Maturity date</span>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(event) => setMaturityDate(event.target.value)}
                  />
                </label>
              </div>
            </>
          )}

          {type === 'Cash' && (
            <>
              <label className="form-field">
                <span>Account name</span>
                <input
                  type="text"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="e.g. Cash & sweep"
                  autoFocus
                />
              </label>
              <label className="form-field">
                <span>Amount ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="5000"
                />
              </label>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Add holding</button>
          </div>
        </form>
      </div>
    </div>
  );
}
