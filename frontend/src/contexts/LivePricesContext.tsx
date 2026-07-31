import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Holding } from '../types/portfolio';

// Maps ticker -> latest live price pushed by the /ws/prices feed.
type LivePricesMap = Record<string, number>;

const LivePricesContext = createContext<LivePricesMap>({});
// Maps ticker -> prior session's closing price, used as the daily % change baseline
// (matches how real market data / finance sites report daily change).
const PreviousCloseContext = createContext<LivePricesMap>({});

const WS_URL = 'ws://127.0.0.1:5001/ws/prices';

export function LivePricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<LivePricesMap>({});
  const [previousCloses, setPreviousCloses] = useState<LivePricesMap>({});
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.event !== 'PRICE_UPDATE') return;

        const ticks = message.data as { symbol: string; price: string; previous_close?: string }[];

        setPrices((current) => {
          const next = { ...current };
          for (const tick of ticks) {
            next[tick.symbol] = Number(tick.price);
          }
          return next;
        });

        setPreviousCloses((current) => {
          const next = { ...current };
          for (const tick of ticks) {
            if (tick.previous_close !== undefined) {
              next[tick.symbol] = Number(tick.previous_close);
            }
          }
          return next;
        });
      };

      ws.onclose = () => {
        if (!cancelled) setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, []);

  return (
    <LivePricesContext.Provider value={prices}>
      <PreviousCloseContext.Provider value={previousCloses}>{children}</PreviousCloseContext.Provider>
    </LivePricesContext.Provider>
  );
}

export function useLivePrices(): LivePricesMap {
  return useContext(LivePricesContext);
}

export function usePreviousCloses(): LivePricesMap {
  return useContext(PreviousCloseContext);
}

// Applies live prices and daily % change to each holding by comparing the
// incoming websocket price against the prior session's close. Falls back to
// the REST-fetched currentPrice (today's opening) if a previous close hasn't
// arrived over the websocket yet.
export function withLiveDailyChange(
  holdings: Holding[],
  livePrices: LivePricesMap,
  previousCloses: LivePricesMap = {},
): Holding[] {
  return holdings.map((holding) => {
    const livePrice = livePrices[holding.ticker];
    if (livePrice === undefined || !holding.currentPrice) return holding;

    const referencePrice = previousCloses[holding.ticker] ?? holding.currentPrice;
    const dailyChange = ((livePrice - referencePrice) / referencePrice) * 100;
    // True dollar gain since the reference price — quantity times the actual
    // price delta, not the live value scaled by a percentage (that overstates
    // the gain, since it applies today's % change to today's already-moved
    // value instead of to the starting value).
    const dayGainValue = holding.quantity * (livePrice - referencePrice);
    // The backend computes totalGainLoss from the opening price, so it goes
    // stale the moment the live price moves away from open. Recompute it here
    // against the live price so it stays consistent with the live value shown
    // alongside it, wherever avgCostBasis is available.
    const totalGainLoss =
      holding.avgCostBasis !== undefined
        ? holding.quantity * (livePrice - holding.avgCostBasis)
        : holding.totalGainLoss;

    return {
      ...holding,
      value: holding.quantity * livePrice,
      dailyChange,
      dayGainValue,
      totalGainLoss,
    };
  });
}

// Aggregates each holding's true dollar gain since the reference price into
// a portfolio-wide day gain, expressed as a percentage of total portfolio value.
export function computeDayGain(holdings: Holding[], totalValue: number): { dayGain: number; dayGainPercent: number } {
  const dayGain = holdings.reduce((sum, holding) => sum + (holding.dayGainValue ?? 0), 0);
  const dayGainPercent = totalValue ? (dayGain / totalValue) * 100 : 0;
  return { dayGain, dayGainPercent };
}
