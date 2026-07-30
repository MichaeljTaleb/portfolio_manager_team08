import { useEffect, useMemo, useState } from 'react';
import { fetchCash } from '../api/client';
import { CashTransferForm } from '../components/cash/CashTransferForm';
import { Card } from '../components/common/Card';
import { Toast } from '../components/common/Toast';
import type { CashSummary } from '../types/portfolio';
import { formatDateTime, formatPrice, formatQuantity } from '../utils/formatters';

const emptySummary: CashSummary = { balance: 0, transactions: [] };
const PAGE_SIZE = 10;

type TransactionFilter = 'All' | 'Buy' | 'Sell' | 'Deposit' | 'Withdraw';
const transactionFilters: TransactionFilter[] = ['All', 'Buy', 'Sell', 'Deposit', 'Withdraw'];

export function CashPage() {
  const [summary, setSummary] = useState<CashSummary>(emptySummary);
  const [transferMode, setTransferMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<TransactionFilter>('All');

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
    setPage(0);
  };

  const filteredTransactions = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return summary.transactions.filter((transaction) => {
      const isCashTransfer = transaction.symbol === 'CASH';
      const isBuy = transaction.action === 'BUY';
      const label = isCashTransfer ? (isBuy ? 'Deposit' : 'Withdraw') : (isBuy ? 'Buy' : 'Sell');

      const matchesQuery = trimmedQuery === '' || transaction.symbol.toLowerCase().includes(trimmedQuery);
      const matchesFilter = actionFilter === 'All' || label === actionFilter;
      return matchesQuery && matchesFilter;
    });
  }, [summary.transactions, query, actionFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleTransactions = filteredTransactions.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
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

      <div className="holdings-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search by symbol"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          aria-label="Search transactions"
        />
        <select
          className="select-input"
          value={actionFilter}
          onChange={(event) => { setActionFilter(event.target.value as TransactionFilter); setPage(0); }}
          aria-label="Filter by transaction type"
        >
          {transactionFilters.map((option) => (
            <option key={option} value={option}>{option === 'All' ? 'All transactions' : option}</option>
          ))}
        </select>
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
              {visibleTransactions.map((transaction, index) => {
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
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length > PAGE_SIZE && (
          <div className="table-pagination">
            <span>Page {currentPage + 1} of {pageCount}</span>
            <div className="table-pagination-controls">
              <button
                type="button"
                className="text-button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={currentPage === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                disabled={currentPage >= pageCount - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
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
