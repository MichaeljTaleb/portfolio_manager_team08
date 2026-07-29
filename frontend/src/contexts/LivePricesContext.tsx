import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Holding } from '../types/portfolio';

// Maps ticker -> latest live price pushed by the /ws/prices feed.
// Only the cumulative price is tracked here; % change vs. today's open
// is computed by consumers against the REST-fetched currentPrice, since
// the websocket's own change_percent is only relative to the prior tick.
type LivePricesMap = Record<string, number>;

const LivePricesContext = createContext<LivePricesMap>({});

const WS_URL = 'ws://127.0.0.1:5001/ws/prices';

export function LivePricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<LivePricesMap>({});
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.event !== 'PRICE_UPDATE') return;

        setPrices((current) => {
          const next = { ...current };
          for (const tick of message.data as { symbol: string; price: string }[]) {
            next[tick.symbol] = Number(tick.price);
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

  return <LivePricesContext.Provider value={prices}>{children}</LivePricesContext.Provider>;
}

export function useLivePrices(): LivePricesMap {
  return useContext(LivePricesContext);
}

// Applies live prices and daily % change to each holding by comparing the
// incoming websocket price against the REST-fetched currentPrice.
export function withLiveDailyChange(holdings: Holding[], livePrices: LivePricesMap): Holding[] {
  return holdings.map((holding) => {
    const livePrice = livePrices[holding.ticker];
    if (livePrice === undefined || !holding.currentPrice) return holding;

    const basePrice = holding.currentPrice;
    const dailyChange = ((livePrice - basePrice) / basePrice) * 100;

    return {
      ...holding,
      currentPrice: livePrice,
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
