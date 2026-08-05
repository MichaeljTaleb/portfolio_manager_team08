import { afterEach, describe, expect, it, vi } from 'vitest';
import { buyHolding, fetchAllocation, fetchHoldings, fetchPerformance, searchSymbols } from './client';

const response = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(body),
});

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('maps backend holdings into the UI model with safe defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{
      ticker: 'MSFT', name: 'Microsoft', quantity: 2, currentPrice: 100, value: 200,
      allocation: 25, totalGainLoss: 20,
    }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHoldings()).resolves.toEqual([expect.objectContaining({
      id: 'MSFT', sector: 'Other', type: 'Stocks', dailyChange: 0,
    })]);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5001/api/holdings/');
  });

  it('assigns allocation colors and downsamples performance axes while retaining endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([{ name: 'Holdings', percentage: 75 }, { name: 'Other', percentage: 25 }]))
      .mockResolvedValueOnce(response({ values: [1, 2, 3, 4, 5, 6], axis: ['a', 'b', 'c', 'd', 'e', 'f'], label: '1 month' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllocation()).resolves.toEqual([
      { name: 'Holdings', percentage: 75, color: '#3B82F6' },
      { name: 'Other', percentage: 25, color: '#94A3B8' },
    ]);
    await expect(fetchPerformance('1M')).resolves.toMatchObject({ axis: ['a', 'b', 'd', 'e', 'f'] });
  });

  it('URL-encodes searches and surfaces backend errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: 'ignored' }, false));
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchSymbols('BRK B')).rejects.toThrow('Unable to search for stocks right now.');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5001/api/holdings/search?q=BRK%20B');

    fetchMock.mockResolvedValue(response({ error: 'Insufficient cash' }, false));
    await expect(buyHolding('AAPL', 1, 100)).rejects.toThrow('Insufficient cash');
  });
});
