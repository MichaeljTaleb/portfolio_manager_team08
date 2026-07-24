import type { AllocationItem, Holding, PerformanceSeries, TimeRange } from '../types/portfolio';

export const portfolioSummary = {
  asOf: 'Jul 23, 2026 · 3:42 PM ET',
  totalValue: 284750,
  dayGain: 1842,
  dayGainPercent: 0.65,
  totalReturn: 47320,
  totalReturnPercent: 19.9,
};

export const holdings: Holding[] = [
  { ticker: 'VTI', name: 'Vanguard Total Stock Market', value: 84200, allocation: 29.6, dailyChange: 0.82, type: 'Stocks' },
  { ticker: 'VXUS', name: 'Vanguard Total International Stock', value: 32150, allocation: 11.3, dailyChange: 0.41, type: 'Stocks' },
  { ticker: 'AAPL', name: 'Apple Inc.', value: 28900, allocation: 10.2, dailyChange: 1.24, type: 'Stocks' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', value: 26400, allocation: 9.3, dailyChange: 0.93, type: 'Stocks' },
  { ticker: 'CASH', name: 'Cash & sweep', value: 28800, allocation: 10.1, dailyChange: 0, type: 'Cash' },
  { ticker: 'BND', name: 'Vanguard Total Bond', value: 41300, allocation: 14.5, dailyChange: -0.18, type: 'Bonds' },
  { ticker: 'VNQ', name: 'Vanguard Real Estate', value: 12800, allocation: 4.5, dailyChange: -0.62, type: 'Stocks' },
  { ticker: 'VTIP', name: 'Vanguard Short-Term TIPS', value: 19850, allocation: 7.0, dailyChange: 0.11, type: 'Bonds' },
  { ticker: 'GLD', name: 'SPDR Gold Shares', value: 10350, allocation: 3.6, dailyChange: 0.34, type: 'Stocks' },
];

export const allocations: AllocationItem[] = [
  { name: 'Stocks', percentage: 68.5, color: 'var(--accent)' },
  { name: 'Bonds', percentage: 21.5, color: 'var(--accent-muted)' },
  { name: 'Cash', percentage: 10, color: 'var(--positive)' },
];

export const performanceData: Record<TimeRange, PerformanceSeries> = {
  '1D': { values: [283.2, 283.5, 283.0, 283.9, 284.1, 283.7, 284.3, 284.6, 284.4, 284.9, 284.7, 284.95, 284.72, 284.75], axis: ['9:30', '11:00', '12:30', '2:00', '4:00'], label: 'today' },
  '1W': { values: [279.1, 280.4, 281.2, 280.1, 282.3, 283.9, 284.75], axis: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], label: 'past week' },
  '1M': { values: [271.0, 273.2, 272.1, 275.4, 278.0, 276.3, 279.1, 281.4, 280.2, 283.0, 282.4, 284.75], axis: ['Jun 23', 'Jul 1', 'Jul 8', 'Jul 15', 'Jul 23'], label: 'past month' },
  '1Y': { values: [237, 240, 246, 242, 251, 255, 259, 263, 268, 264, 272, 278, 275, 281, 284.75], axis: ['Aug', 'Oct', 'Dec', 'Feb', 'Apr', 'Jul'], label: 'past year' },
  All: { values: [168, 185, 205, 199, 222, 241, 236, 258, 262, 255, 271, 284.75], axis: ['2021', '2022', '2023', '2024', '2025', '2026'], label: 'all time' },
};
