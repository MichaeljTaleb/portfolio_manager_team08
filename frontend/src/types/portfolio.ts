export type AssetType = 'Stocks' | 'Bonds' | 'Cash';
export type TimeRange = '1W' | '2W' | '3W' | '1M';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  value: number;
  allocation: number;
  dailyChange: number;
  type: AssetType;
  sector?: string;
  quantity: number;
  currentPrice: number;
  totalGainLoss: number;
  purchaseDate?: string;
  couponRate?: number;
  maturityDate?: string;
}

export interface AllocationItem {
  name: AssetType;
  percentage: number;
  color: string;
}

export interface PerformanceSeries {
  values: number[];
  dates: string[];
  axis: string[];
  label: string;
}

export interface Transaction {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: string;
}

export interface CashSummary {
  balance: number;
  transactions: Transaction[];
}
