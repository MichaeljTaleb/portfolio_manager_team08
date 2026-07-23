export type AssetType = 'Stocks' | 'Bonds' | 'Cash';
export type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'All';

export interface Holding {
  ticker: string;
  name: string;
  value: number;
  allocation: number;
  dailyChange: number;
  type: AssetType;
}

export interface AllocationItem {
  name: AssetType;
  percentage: number;
  color: string;
}

export interface PerformanceSeries {
  values: number[];
  axis: string[];
  label: string;
}
