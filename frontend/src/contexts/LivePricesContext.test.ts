import { describe, expect, it } from 'vitest';
import { computeDayGain, withLiveDailyChange } from './LivePricesContext';
import type { Holding } from '../types/portfolio';

const holding: Holding = {
  id: 'aapl',
  ticker: 'AAPL',
  name: 'Apple Inc.',
  value: 1000,
  allocation: 100,
  dailyChange: 0,
  type: 'Stocks',
  sector: 'Technology',
  quantity: 10,
  currentPrice: 100,
  avgCostBasis: 90,
  totalGainLoss: 100,
};

describe('live price calculations', () => {
  it('updates market value, daily change, day gain, and total gain from a live price', () => {
    const [updated] = withLiveDailyChange([holding], { AAPL: 110 }, { AAPL: 105 });

    expect(updated).toMatchObject({
      value: 1100,
      dailyChange: (5 / 105) * 100,
      dayGainValue: 50,
      totalGainLoss: 200,
    });
  });

  it('uses the fetched current price when no previous close has arrived', () => {
    const [updated] = withLiveDailyChange([holding], { AAPL: 95 });

    expect(updated.dailyChange).toBe(-5);
    expect(updated.dayGainValue).toBe(-50);
  });

  it('leaves holdings with no usable live price unchanged and aggregates daily gains', () => {
    expect(withLiveDailyChange([holding], {})).toEqual([holding]);
    expect(computeDayGain([{ ...holding, dayGainValue: 15 }, { ...holding, dayGainValue: -5 }], 1000)).toEqual({
      dayGain: 10,
      dayGainPercent: 1,
    });
  });
});
