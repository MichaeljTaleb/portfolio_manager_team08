import type { AllocationItem, AssetType, CashSummary, Holding, PerformanceSeries, StockRange, TimeRange } from '../types/portfolio';

const BASE_URL = 'http://127.0.0.1:5001';

interface ApiHolding {
  ticker: string;
  name: string;
  type?: AssetType;
  sector?: string;
  quantity: number;
  currentPrice: number;
  value: number;
  allocation: number;
  totalGainLoss: number;
}

export async function fetchHoldings(): Promise<Holding[]> {
  const response = await fetch(`${BASE_URL}/api/holdings/`);
  const data: ApiHolding[] = await response.json();
  return data.map((holding) => ({
    id: holding.ticker,
    ticker: holding.ticker,
    name: holding.name,
    sector: holding.sector ?? 'Other',
    value: holding.value,
    allocation: holding.allocation,
    // TODO: replace with live day-over-day change once the websocket feed exists.
    dailyChange: 0,
    type: holding.type ?? 'Stocks',
    quantity: holding.quantity,
    currentPrice: holding.currentPrice,
    totalGainLoss: holding.totalGainLoss,
  }));
}

export interface StockSymbol {
  symbol: string;
  name: string;
}

export async function fetchSymbols(): Promise<StockSymbol[]> {
  const response = await fetch(`${BASE_URL}/api/holdings/symbols`);
  return response.json();
}

export interface PortfolioSummary {
  asOf: string;
  totalValue: number;
  dayGain: number;
  dayGainPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export async function fetchSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${BASE_URL}/api/portfolio/summary`);
  return response.json();
}

const ALLOCATION_COLORS: Record<string, string> = {
  Holdings: '#3B82F6',
  Cash: '#22C55E',
};

interface ApiAllocationItem {
  name: string;
  percentage: number;
}

export async function fetchAllocation(): Promise<AllocationItem[]> {
  const response = await fetch(`${BASE_URL}/api/portfolio/allocation`);
  const data: ApiAllocationItem[] = await response.json();
  return data.map((item) => ({
    name: item.name as AllocationItem['name'],
    percentage: item.percentage,
    color: ALLOCATION_COLORS[item.name] ?? '#94A3B8',
  }));
}

const downsample = <T,>(items: T[], maxPoints = 5): T[] => {
  if (items.length <= maxPoints) return items;
  return Array.from({ length: maxPoints }, (_, index) =>
    items[Math.round((index / (maxPoints - 1)) * (items.length - 1))],
  );
};

interface ApiPerformance {
  values: number[];
  axis: string[];
  label: string;
}

export async function fetchPerformance(range: TimeRange): Promise<PerformanceSeries> {
  const response = await fetch(`${BASE_URL}/api/portfolio/performance?range=${range.toLowerCase()}`);
  const data: ApiPerformance = await response.json();
  return {
    values: data.values,
    dates: data.axis,
    axis: downsample(data.axis),
    label: data.label,
  };
}

interface ApiStockPerformance {
  values: number[];
  axis: string[];
  label: string;
  sinceDate?: string;
}

export async function fetchHoldingPerformance(ticker: string, range: StockRange): Promise<PerformanceSeries> {
  const response = await fetch(`${BASE_URL}/api/holdings/${ticker}/performance?range=${range.toLowerCase()}`);
  const data: ApiStockPerformance = await response.json();
  return {
    values: data.values,
    dates: data.axis,
    axis: downsample(data.axis),
    label: data.label,
    sinceDate: data.sinceDate,
  };
}

export async function buyHolding(ticker: string, quantity: number, price: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/holdings/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, quantity, price }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'Failed to add holding.');
  }
}

export async function sellHolding(ticker: string, quantity: number, price: number): Promise<void> {
  await fetch(`${BASE_URL}/api/holdings/${ticker}/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity, price }),
  });
}

export async function fetchCash(): Promise<CashSummary> {
  const response = await fetch(`${BASE_URL}/api/portfolio/cash`);
  return response.json();
}

export async function executeCashTransfer(action: 'DEPOSIT' | 'WITHDRAW', amount: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/portfolio/cash/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, amount }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'Failed to execute cash transfer.');
  }
}
