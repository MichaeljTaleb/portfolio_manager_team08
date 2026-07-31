import json
import logging
import random
import threading
import time
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any

import yfinance as yf
from flask import Flask
from flask_sock import Sock
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Stock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("websocket_service")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[Any] = []
        self._lock = threading.Lock()

    def connect(self, ws):
        with self._lock:
            self.active_connections.append(ws)
            logger.info(f"New connection established. Total connections: {len(self.active_connections)}")

    def disconnect(self, ws):
        with self._lock:
            if ws in self.active_connections:
                self.active_connections.remove(ws)
                logger.info(f"Connection closed. Total connections: {len(self.active_connections)}")

    def broadcast(self, message: Dict[str, Any]):
        with self._lock:
            if not self.active_connections:
                return

            payload = json.dumps(message, default=str)
            dead_connections = []

            for ws in self.active_connections:
                try:
                    ws.send(payload)
                except Exception as e:
                    logger.error(f"Error broadcasting message to WebSocket client: {e}")
                    dead_connections.append(ws)

            for ws in dead_connections:
                if ws in self.active_connections:
                    self.active_connections.remove(ws)

manager = ConnectionManager()

class PriceSimulator:
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.is_running = False
        self.tickers: List[str] = []
        self.latest_prices: Dict[str, Decimal] = {}
        self._thread: threading.Thread = None
        self._warmed_up = False

    def load_initial_prices(self):
        db: Session = SessionLocal()
        try:
            latest_date = db.query(func.max(Stock.price_date)).scalar()

            if not latest_date:
                logger.warning("No stock data available to load initial prices.")
                return

            latest_stocks = db.query(Stock).filter(Stock.price_date == latest_date).all()
            self.latest_prices = {}
            self.tickers = []

            for stock in latest_stocks:
                self.tickers.append(stock.symbol)
                self.latest_prices[stock.symbol] = Decimal(str(stock.open_price))

            logger.info(f"Loaded initial prices for {len(self.tickers)} tickers.")

        except Exception as e:
            logger.error(f"Error loading initial prices from database: {e}")
        finally:
            db.close()

    def start(self, interval_seconds: float = 10.0):
        if self.is_running:
            return

        self.is_running = True
        self.load_initial_prices()

        # Launch non-blocking daemon thread
        self._thread = threading.Thread(target=self._run_loop, args=(interval_seconds,), daemon=True)
        self._thread.start()
        logger.info("🚀 Live price feed thread started.")

    def _fetch_live_prices(self, symbols: List[str]) -> Dict[str, Dict[str, Decimal]]:
        quotes: Dict[str, Dict[str, Decimal]] = {}
        try:
            tickers_obj = yf.Tickers(" ".join(symbols))
            for symbol in symbols:
                try:
                    fast_info = tickers_obj.tickers[symbol].fast_info
                    last_price = fast_info["last_price"]
                    # fast_info has two different "previous close" fields that can diverge
                    # significantly; regular_market_previous_close is the one that matches
                    # what real finance sites use as "Prev Close" for daily % change.
                    previous_close = fast_info["regular_market_previous_close"]
                    if last_price is not None and previous_close is not None:
                        quotes[symbol] = {
                            "price": Decimal(str(round(float(last_price), 2))),
                            "previous_close": Decimal(str(round(float(previous_close), 2))),
                        }
                except Exception as e:
                    logger.warning(f"Could not fetch live price for {symbol}: {e}")
        except Exception as e:
            logger.error(f"Error fetching live prices from yfinance: {e}")
        return quotes

    def subscribe(self, symbol: str) -> Dict[str, Decimal] | None:
        """Add a user-selected symbol to the live feed and return its latest quote."""
        symbol = symbol.upper()
        quotes = self._fetch_live_prices([symbol])
        quote = quotes.get(symbol)
        if quote is None:
            return None

        if symbol not in self.tickers:
            self.tickers.append(symbol)
        self.latest_prices[symbol] = quote["price"]
        return quote

    def _run_loop(self, interval_seconds: float):
        while self.is_running:
            try:
                time.sleep(interval_seconds)

                # Skip fetching if no clients are connected
                if not self.connection_manager.active_connections:
                    continue

                if not self.tickers:
                    self.load_initial_prices()
                    if not self.tickers:
                        continue

                if not self._warmed_up:
                    # First tick after a client connects: cover every tracked ticker
                    # in one burst so prices/% change don't take several throttled
                    # cycles to populate. One-time cost, not sustained polling.
                    selected_symbols = list(self.tickers)
                    self._warmed_up = True
                else:
                    # Pick 2 to 4 random stocks per tick to spread out API calls
                    k_sample = min(random.randint(2, 4), len(self.tickers))
                    selected_symbols = random.sample(self.tickers, k=k_sample)

                live_quotes = self._fetch_live_prices(selected_symbols)
                tick_updates = []

                for symbol, quote in live_quotes.items():
                    new_price = quote["price"]
                    previous_close = quote["previous_close"]
                    previous_price = self.latest_prices.get(symbol, new_price)
                    price_delta = round(new_price - previous_price, 2)
                    # Daily change is measured against the prior session's close,
                    # matching how real market data / finance sites report it.
                    day_change_percent = round(float((new_price - previous_close) / previous_close) * 100, 2) if previous_close else 0.0

                    self.latest_prices[symbol] = new_price

                    tick_updates.append({
                        "symbol": symbol,
                        "price": str(new_price),
                        "previous_close": str(previous_close),
                        "change": str(price_delta),
                        "change_percent": str(day_change_percent),
                        "direction": "UP" if price_delta >= 0 else "DOWN"
                    })

                if tick_updates:
                    payload = {
                        "event": "PRICE_UPDATE",
                        "timestamp": datetime.utcnow().isoformat(),
                        "data": tick_updates
                    }
                    self.connection_manager.broadcast(payload)
                    logger.debug(f"Broadcasted tick: {payload}")

            except Exception as e:
                logger.error(f"Error in price feed thread: {e}")

    def stop_simulation(self):
        self.is_running = False
        logger.info("Price simulator thread stopped.")


simulator = PriceSimulator(connection_manager=manager)


def register_websocket_routes(app: Flask):
    sock = Sock(app)

    @sock.route("/ws/prices")
    def websocket_endpoint(ws):
        manager.connect(ws)
        try:
            while True:
                data = ws.receive()
                if data is None:
                    break
                ws.send(json.dumps({"event": "PONG", "message": "Heartbeat acknowledged"}))
        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
        finally:
            manager.disconnect(ws)

    simulator.start(interval_seconds=10.0)
