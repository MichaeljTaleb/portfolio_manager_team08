import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Toast } from '../components/common/Toast';
import { AddHoldingForm } from '../components/holdings/AddHoldingForm';
import { HoldingsTable } from '../components/holdings/HoldingsTable';
import { buyHolding, fetchHoldings, sellHolding } from '../api/client';
import type { AssetType, Holding } from '../types/portfolio';

type AssetFilter = 'All' | AssetType;
type SortOption = 'name' | 'value-desc' | 'allocation-desc' | 'today-desc' | 'gain-desc';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'value-desc', label: 'Value (high to low)' },
  { value: 'allocation-desc', label: 'Allocation (high to low)' },
  { value: 'today-desc', label: "Today's change (high to low)" },
  { value: 'gain-desc', label: 'Total gain/loss (high to low)' },
];

const recalculateAllocations = (items: Holding[]): Holding[] => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items.map((item) => ({
    ...item,
    allocation: total === 0 ? 0 : Number(((item.value / total) * 100).toFixed(1)),
  }));
};

export function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('All');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [pendingRemoval, setPendingRemoval] = useState<Holding | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{ holding: Holding; index: number } | null>(null);

  const loadHoldings = async () => {
    const backendHoldings = await fetchHoldings();
    setHoldings((current) => {
      const localOnly = current.filter((holding) => holding.type !== 'Stocks');
      return recalculateAllocations([...backendHoldings, ...localOnly]);
    });
  };

  useEffect(() => {
    loadHoldings();
  }, []);

  const handleAddHolding = async (holding: Omit<Holding, 'id' | 'allocation'>) => {
    if (holding.type === 'Stocks') {
      await buyHolding(holding.ticker, holding.quantity, holding.currentPrice);
      await loadHoldings();
    } else {
      const newHolding: Holding = {
        ...holding,
        id: `${holding.ticker}-${holdings.length}-${Math.random().toString(36).slice(2, 8)}`,
        allocation: 0,
      };
      setHoldings((current) => recalculateAllocations([...current, newHolding]));
    }
    setIsAdding(false);
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoval) return;

    if (pendingRemoval.type === 'Stocks') {
      await sellHolding(pendingRemoval.ticker, pendingRemoval.quantity, pendingRemoval.currentPrice);
      await loadHoldings();
    } else {
      const index = holdings.findIndex((holding) => holding.id === pendingRemoval.id);
      setHoldings((current) => recalculateAllocations(current.filter((holding) => holding.id !== pendingRemoval.id)));
      setLastRemoved({ holding: pendingRemoval, index });
    }
    setToastMessage(`${pendingRemoval.ticker} removed from holdings.`);
    setPendingRemoval(null);
  };

  const handleUndoRemove = () => {
    if (!lastRemoved) return;
    setHoldings((current) => {
      const restored = [...current];
      restored.splice(lastRemoved.index, 0, lastRemoved.holding);
      return recalculateAllocations(restored);
    });
    setLastRemoved(null);
  };

  const visibleHoldings = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    const filtered = holdings.filter((holding) => {
      const matchesQuery =
        trimmedQuery === '' ||
        holding.ticker.toLowerCase().includes(trimmedQuery) ||
        holding.name.toLowerCase().includes(trimmedQuery);
      const matchesType = assetFilter === 'All' || holding.type === assetFilter;
      return matchesQuery && matchesType;
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case 'value-desc':
        sorted.sort((a, b) => b.value - a.value);
        break;
      case 'allocation-desc':
        sorted.sort((a, b) => b.allocation - a.allocation);
        break;
      case 'today-desc':
        sorted.sort((a, b) => b.dailyChange - a.dailyChange);
        break;
      case 'gain-desc':
        sorted.sort((a, b) => b.totalGainLoss - a.totalGainLoss);
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [holdings, query, assetFilter, sortBy]);

  return (
    <>
      <div className="page-heading holdings-heading">
        <div><h1>Holdings</h1><p>{holdings.length} positions across stocks, bonds, and cash.</p></div>
        <button type="button" className="primary-button" onClick={() => setIsAdding(true)}>+ Add holding</button>
      </div>

      <div className="holdings-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search by ticker or name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search holdings"
        />
        <select
          className="select-input"
          value={assetFilter}
          onChange={(event) => setAssetFilter(event.target.value as AssetFilter)}
          aria-label="Filter by asset type"
        >
          <option value="All">All asset types</option>
          <option value="Stocks">Stocks</option>
          <option value="Bonds">Bonds</option>
          <option value="Cash">Cash</option>
        </select>
        <select
          className="select-input"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
          aria-label="Sort holdings"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>Sort by: {option.label}</option>
          ))}
        </select>
      </div>

      <HoldingsTable holdings={visibleHoldings} onRequestRemove={setPendingRemoval} />
      {isAdding && <AddHoldingForm onCancel={() => setIsAdding(false)} onSubmit={handleAddHolding} />}
      {pendingRemoval && (
        <ConfirmDialog
          title="Remove holding"
          message={`Remove ${pendingRemoval.ticker} — ${pendingRemoval.name} from your holdings?`}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
          onUndo={lastRemoved ? handleUndoRemove : undefined}
        />
      )}
    </>
  );
}
