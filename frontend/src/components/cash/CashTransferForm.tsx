import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatPrice } from '../../utils/formatters';

interface CashTransferFormProps {
  mode: 'deposit' | 'withdraw';
  balance: number;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}

export function CashTransferForm({ mode, balance, onCancel, onConfirm }: CashTransferFormProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isDeposit = mode === 'deposit';
  const actionLabel = isDeposit ? 'Deposit' : 'Withdraw';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    if (!isDeposit && parsed > balance) {
      setError(`You only have ${formatPrice(balance)} available.`);
      return;
    }

    onConfirm(parsed);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-transfer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="cash-transfer-title">{actionLabel} cash</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <p className="confirm-message">Current balance: {formatPrice(balance)}</p>
          <label className="form-field">
            <span>Amount ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => { setAmount(event.target.value); setError(null); }}
              placeholder="1000"
              autoFocus
            />
          </label>
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
