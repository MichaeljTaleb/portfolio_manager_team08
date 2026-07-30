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

    return {
      ...holding,
      value: holding.quantity * livePrice,
      dailyChange,
    };
  });
}

// Aggregates each holding's dollar gain (value * dailyChange%) into a
// portfolio-wide day gain, expressed as a percentage of total portfolio value.
export function computeDayGain(holdings: Holding[], totalValue: number): { dayGain: number; dayGainPercent: number } {
  const dayGain = holdings.reduce((sum, holding) => sum + holding.value * (holding.dailyChange / 100), 0);
  const dayGainPercent = totalValue ? (dayGain / totalValue) * 100 : 0;
  return { dayGain, dayGainPercent };
}
