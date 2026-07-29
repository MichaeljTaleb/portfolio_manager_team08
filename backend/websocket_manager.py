import json
import logging
import random
import threading
import time
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any

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

    def start(self, interval_seconds: float = 2.0):
        if self.is_running:
            return

        self.is_running = True
        self.load_initial_prices()

        # Launch non-blocking daemon thread
        self._thread = threading.Thread(target=self._run_loop, args=(interval_seconds,), daemon=True)
        self._thread.start()
        logger.info("🚀 Flask Real-Time Price Simulator thread started.")

    def _run_loop(self, interval_seconds: float):
        while self.is_running:
            try:
                time.sleep(interval_seconds)

                # Skip wiggling if no clients are connected
                if not self.connection_manager.active_connections:
                    continue

                if not self.tickers:
                    self.load_initial_prices()
                    if not self.tickers:
                        continue

                # Pick 2 to 4 random stocks per tick
                k_sample = min(random.randint(2, 4), len(self.tickers))
                selected_symbols = random.sample(self.tickers, k=k_sample)
                tick_updates = []

                for symbol in selected_symbols:
                    current_price = self.latest_prices.get(symbol, Decimal("100.00"))
                    
                    # Calculate percentage change (-0.5% to +0.5%)
                    percentage_change = Decimal(str(round(random.uniform(-0.005, 0.005), 6)))
                    new_price = round(current_price * (Decimal("1") + percentage_change), 2)

                    self.latest_prices[symbol] = new_price
                    price_delta = round(new_price - current_price, 2)

                    tick_updates.append({
                        "symbol": symbol,
                        "price": str(new_price),
                        "change": str(price_delta),
                        "change_percent": str(round(float(percentage_change) * 100, 2)),
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
                logger.error(f"Error in price simulator thread: {e}")

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

    simulator.start(interval_seconds=2.0)