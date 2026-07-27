import type { AllocationItem, Holding, PerformanceSeries, TimeRange } from '../types/portfolio';

export const portfolioSummary = {
  totalValue: 284750,
  dayGain: 1842,
  dayGainPercent: 0.65,
  totalReturn: 47320,
  totalReturnPercent: 19.9,
};

export const holdings: Holding[] = [
  { id: 'VTI', ticker: 'VTI', name: 'Vanguard Total Stock Market', value: 84200, allocation: 29.6, dailyChange: 0.82, type: 'Stocks', quantity: 331.079, currentPrice: 254.32, totalGainLoss: 18860.8 },
  { id: 'VXUS', ticker: 'VXUS', name: 'Vanguard Total International Stock', value: 32150, allocation: 11.3, dailyChange: 0.41, type: 'Stocks', quantity: 553.356, currentPrice: 58.1, totalGainLoss: 4565.3 },
  { id: 'AAPL', ticker: 'AAPL', name: 'Apple Inc.', value: 28900, allocation: 10.2, dailyChange: 1.24, type: 'Stocks', quantity: 132.296, currentPrice: 218.45, totalGainLoss: 11155.4 },
  { id: 'MSFT', ticker: 'MSFT', name: 'Microsoft Corp.', value: 26400, allocation: 9.3, dailyChange: 0.93, type: 'Stocks', quantity: 63.584, currentPrice: 415.2, totalGainLoss: 6890.4 },
  { id: 'CASH', ticker: 'CASH', name: 'Cash & sweep', value: 28800, allocation: 10.1, dailyChange: 0, type: 'Cash', quantity: 28800, currentPrice: 1, totalGainLoss: 0 },
  { id: 'BND', ticker: 'BND', name: 'Vanguard Total Bond', value: 41300, allocation: 14.5, dailyChange: -0.18, type: 'Bonds', quantity: 572.419, currentPrice: 72.15, totalGainLoss: -1569.4 },
  { id: 'VNQ', ticker: 'VNQ', name: 'Vanguard Real Estate', value: 12800, allocation: 4.5, dailyChange: -0.62, type: 'Stocks', quantity: 148.148, currentPrice: 86.4, totalGainLoss: 1241.6 },
  { id: 'VTIP', ticker: 'VTIP', name: 'Vanguard Short-Term TIPS', value: 19850, allocation: 7.0, dailyChange: 0.11, type: 'Bonds', quantity: 398.194, currentPrice: 49.85, totalGainLoss: 416.85 },
  { id: 'GLD', ticker: 'GLD', name: 'SPDR Gold Shares', value: 10350, allocation: 3.6, dailyChange: 0.34, type: 'Stocks', quantity: 49.109, currentPrice: 210.75, totalGainLoss: 3301.65 },
];

export const allocations: AllocationItem[] = [
  { name: 'Stocks', percentage: 68.5, color: '#3B82F6' },
  { name: 'Bonds', percentage: 21.5, color: '#8B5CF6' },
  { name: 'Cash', percentage: 10, color: '#22C55E' },
];

const today = new Date();

const buildDailySeries = (days: number, label: string, startValue: number, endValue: number): PerformanceSeries => {
  const values: number[] = [];
  const dates: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const progress = days === 1 ? 1 : (days - 1 - i) / (days - 1);
    const wave = Math.sin(progress * Math.PI * 2.4) * (endValue - startValue) * 0.035;
    const value = startValue + (endValue - startValue) * progress + wave;
    values.push(Number(value.toFixed(2)));
    dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  values[values.length - 1] = endValue;

  const tickCount = Math.min(5, days);
  const axis = Array.from({ length: tickCount }, (_, index) => {
    const dayIndex = tickCount === 1 ? days - 1 : Math.round((index / (tickCount - 1)) * (days - 1));
    return dates[dayIndex];
  });

  return { values, dates, axis, label };
};

export const performanceData: Record<TimeRange, PerformanceSeries> = {
  '1W': buildDailySeries(7, 'past week', 279.1, 284.75),
  '2W': buildDailySeries(14, 'past 2 weeks', 274.8, 284.75),
  '3W': buildDailySeries(21, 'past 3 weeks', 270.2, 284.75),
  '1M': buildDailySeries(30, 'past month', 265.4, 284.75),
};
