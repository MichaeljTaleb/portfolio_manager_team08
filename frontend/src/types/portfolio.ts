export type AssetType = 'Stocks' | 'Bonds' | 'Cash';
export type TimeRange = '1W' | '2W' | '3W' | '1M';
export type StockRange = '1D' | '1W' | '1M' | '1Y' | 'SINCE_BOUGHT';

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
  sinceDate?: string;
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

export interface StockAnalysis {
  earningsDate: string | null;
  recommendation: string | null;
  recommendationMean: number | null;
  numberOfAnalysts: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
}
