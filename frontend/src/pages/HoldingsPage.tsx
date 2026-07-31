import { useEffect, useMemo, useState } from 'react';
import { Toast } from '../components/common/Toast';
import { AddHoldingForm } from '../components/holdings/AddHoldingForm';
import { HoldingsTable } from '../components/holdings/HoldingsTable';
import { SellHoldingForm } from '../components/holdings/SellHoldingForm';
import { buyHolding, fetchHoldings, sellHolding } from '../api/client';
import { useLivePrices, usePreviousCloses, withLiveDailyChange } from '../contexts/LivePricesContext';
import type { AssetType, Holding } from '../types/portfolio';
import { formatCurrency } from '../utils/formatters';

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

interface HoldingsPageProps {
  onSelectStock: (holding: Holding) => void;
}

export function HoldingsPage({ onSelectStock }: HoldingsPageProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('All');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [isAddingBuy, setIsAddingBuy] = useState(false);
  const [pendingSale, setPendingSale] = useState<Holding | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [lastRemoved, setLastRemoved] = useState<{ holding: Holding; index: number } | null>(null);
  const livePrices = useLivePrices();
  const previousCloses = usePreviousCloses();

  const loadHoldings = async () => {
    setIsLoading(true);
    try {
      const backendHoldings = await fetchHoldings();
      setHoldings((current) => {
        const localOnly = current.filter((holding) => holding.type !== 'Stocks');
        return recalculateAllocations([...backendHoldings, ...localOnly]);
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHoldings();
  }, []);

  const handleAddHolding = async (holding: Omit<Holding, 'id' | 'allocation'>) => {
    try {
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
      setToastTone('success');
      setToastMessage(`${holding.ticker} added to holdings.`);
    } catch (error) {
      setToastTone('error');
      setToastMessage(error instanceof Error ? error.message : 'Failed to add holding.');
    }
  };


  const handleConfirmSale = async (quantity: number) => {
    if (!pendingSale) return;
    const isFullSale = quantity >= pendingSale.quantity;
    const isCash = pendingSale.type === 'Cash';

    if (pendingSale.type === 'Stocks') {
      await sellHolding(pendingSale.ticker, quantity, pendingSale.currentPrice);
      await loadHoldings();
    } else if (isFullSale) {
      const index = holdings.findIndex((holding) => holding.id === pendingSale.id);
      setHoldings((current) => recalculateAllocations(current.filter((holding) => holding.id !== pendingSale.id)));
      setLastRemoved({ holding: pendingSale, index });
    } else {
      setHoldings((current) =>
        recalculateAllocations(
          current.map((holding) => {
            if (holding.id !== pendingSale.id) return holding;
            const remainingQuantity = holding.quantity - quantity;
            return {
              ...holding,
              quantity: remainingQuantity,
              value: remainingQuantity * holding.currentPrice,
            };
          }),
        ),
      );
      setLastRemoved(null);
    }

    setToastTone('neutral');
    setToastMessage(
      isCash
        ? `${formatCurrency(quantity)} withdrawn from ${pendingSale.ticker}.`
        : `Sold ${quantity} ${pendingSale.ticker} ${quantity === 1 ? 'share' : 'shares'}.`,
    );
    setPendingSale(null);
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

  const sectors = useMemo(() => {
    const unique = new Set(holdings.map((holding) => holding.sector).filter((sector): sector is string => Boolean(sector)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [holdings]);

  const visibleHoldings = useMemo(() => {
    const liveHoldings = withLiveDailyChange(holdings, livePrices, previousCloses);
    const trimmedQuery = query.trim().toLowerCase();
    const filtered = liveHoldings.filter((holding) => {
      const matchesQuery =
        trimmedQuery === '' ||
        holding.ticker.toLowerCase().startsWith(trimmedQuery) ||
        holding.name.toLowerCase().startsWith(trimmedQuery);
      const matchesType = assetFilter === 'All' || holding.type === assetFilter;
      const matchesSector = sectorFilter === 'All' || (holding.sector ?? 'Other') === sectorFilter;
      return matchesQuery && matchesType && matchesSector;
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
  }, [holdings, livePrices, previousCloses, query, assetFilter, sectorFilter, sortBy]);

  return (
    <>
      <div className="page-heading holdings-heading">
        <div><h1>Holdings</h1><p>{holdings.length} positions across stocks and bonds</p></div>
      </div>

      {isLoading ? (
        <div className="page-loading" role="status" aria-live="polite">
          <span className="loading-animation" aria-hidden="true" />
          <span>Loading</span>
        </div>
      ) : (
        <>
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
        </select>
        <select
          className="select-input"
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value)}
          aria-label="Filter by sector"
        >
          <option value="All">All sectors</option>
          {sectors.map((sector) => (
            <option key={sector} value={sector}>{sector}</option>
          ))}
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
        <button type="button" className="primary-button holdings-add-button" onClick={() => setIsAdding(true)}>+ Buy holdings</button>
          </div>

          <HoldingsTable
            holdings={visibleHoldings}
            onRequestBuy={() => setIsAddingBuy(true)}
            onRequestSell={setPendingSale}
            onSelectStock={onSelectStock}
          />
        </>
      )}
      {(isAdding || isAddingBuy) && <AddHoldingForm onCancel={() => { setIsAdding(false); setIsAddingBuy(false); }} onSubmit={handleAddHolding} />}
      {pendingSale && (
        <SellHoldingForm
          holding={pendingSale}
          onCancel={() => setPendingSale(null)}
          onConfirm={handleConfirmSale}
        />
      )}
      {toastMessage && (
        <Toast
          message={toastMessage}
          tone={toastTone}
          onDismiss={() => setToastMessage(null)}
          onUndo={lastRemoved ? handleUndoRemove : undefined}
        />
      )}
    </>
  );
}
