import { useEffect, useState } from 'react';
import { fetchCash } from '../api/client';
import { CashTransferForm } from '../components/cash/CashTransferForm';
import { Card } from '../components/common/Card';
import { Toast } from '../components/common/Toast';
import type { CashSummary } from '../types/portfolio';
import { formatDateTime, formatPrice, formatQuantity } from '../utils/formatters';

const emptySummary: CashSummary = { balance: 0, transactions: [] };

export function CashPage() {
  const [summary, setSummary] = useState<CashSummary>(emptySummary);
  const [transferMode, setTransferMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchCash().then(setSummary);
  }, []);

  const handleConfirmTransfer = (amount: number) => {
    const isDeposit = transferMode === 'deposit';
    setSummary((current) => ({
      balance: isDeposit ? current.balance + amount : current.balance - amount,
      transactions: [
        {
          symbol: 'CASH',
          action: isDeposit ? 'BUY' : 'SELL',
          quantity: amount,
          price: 1,
          executedAt: new Date().toISOString(),
        },
        ...current.transactions,
      ],
    }));
    setToastMessage(isDeposit ? `${formatPrice(amount)} deposited.` : `${formatPrice(amount)} withdrawn.`);
    setTransferMode(null);
  };

  return (
    <>
      <div className="page-heading">
        <div><h1>Cash</h1><p>Your cash balance and transaction history.</p></div>
      </div>

      <Card className="cash-balance-card">
        <span className="eyebrow">Cash balance</span>
        <strong className="cash-balance-value">{formatPrice(summary.balance)}</strong>
        <div className="cash-balance-actions">
          <button type="button" className="primary-button button-sm" onClick={() => setTransferMode('deposit')}>+ Add Cash</button>
          <button type="button" className="primary-button button-sm" onClick={() => setTransferMode('withdraw')}>− Remove Cash</button>
        </div>
      </Card>

      <div className="section-heading">
        <h2>Transaction history</h2>
      </div>

      <Card className="table-card">
        <div className="table-scroll">
          <table className="holdings-table cash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Action</th>
                <th className="numeric">Quantity</th>
                <th className="numeric">Price</th>
                <th className="numeric">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.transactions.map((transaction, index) => {
                const isCashTransfer = transaction.symbol === 'CASH';
                const isBuy = transaction.action === 'BUY';
                const label = isCashTransfer ? (isBuy ? 'Deposit' : 'Withdraw') : (isBuy ? 'Buy' : 'Sell');
                const tagClass = isCashTransfer ? (isBuy ? 'deposit' : 'withdraw') : (isBuy ? 'stocks' : 'cash');
                return (
                  <tr key={`${transaction.symbol}-${transaction.executedAt}-${index}`} className="holding-row">
                    <td>{formatDateTime(transaction.executedAt)}</td>
                    <td><strong>{transaction.symbol}</strong></td>
                    <td>
                      <span className={`asset-tag ${tagClass}`}>{label}</span>
                    </td>
                    <td className="numeric">{isCashTransfer ? '—' : formatQuantity(transaction.quantity)}</td>
                    <td className="numeric">{isCashTransfer ? '—' : formatPrice(transaction.price)}</td>
                    <td className="numeric holding-value">
                      {isCashTransfer ? formatPrice(transaction.quantity) : formatPrice(transaction.quantity * transaction.price)}
                    </td>
                  </tr>
                );
              })}
              {summary.transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">No transactions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {transferMode && (
        <CashTransferForm
          mode={transferMode}
          balance={summary.balance}
          onCancel={() => setTransferMode(null)}
          onConfirm={handleConfirmTransfer}
        />
      )}
      {toastMessage && <Toast message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} />}
    </>
  );
}
