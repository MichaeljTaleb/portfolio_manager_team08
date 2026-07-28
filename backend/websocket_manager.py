import asyncio
import json
import logging
import random
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Stock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("websocket_service")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New connection established. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Connection closed. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            return

        payload = json.dumps(message, default=str)
        disconnects = []

        for connection in self.active_connections:
            try: 
                await connection.send_text(payload)
            except Exception as e:
                logger.error(f"Error sending message to a connection: {e}")
                disconnects.append(connection)

        for conn in disconnects:
            self.disconnect(conn)

manager = ConnectionManager()

class PriceSimulator:
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.is_running = False
        self.tickers: List[str] = []
        self.latest_prices: Dict[str, Decimal] = {}

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

    async def start(self, interval_seconds: float = 2.0):
        self.is_running = True
        logger.info("Real-time price simulator started.")

        while self.is_running:
            try:
                await asyncio.sleep(interval_seconds)

                if not self.connection_manager.active_connections:
                    continue

                if not self.tickers:
                    self.load_initial_prices()
                    if not self.tickers:
                        logger.warning("No tickers available for price simulation.")
                        continue

                k_sample = min(random.randint(2,4), len(self.tickers)) 
                selected_symbols = random.sample(self.tickers, k=k_sample)
                tick_updates = []

                for symbol in selected_symbols:
                    current_price = self.latest_prices.get(symbol, 100.00)
                    percentage_change = random.uniform(-0.005, 0.005)
                    new_price = round(current_price * (1 + percentage_change), 2)

                    self.latest_prices[symbol] = new_price
                    price_delta = round(new_price - current_price, 2)


                    tick_updates.append({
                        "symbol": symbol,
                        "price": str(new_price),
                        "change": str(price_delta),
                        "change_percent": str(round(percentage_change * 100, 2)),
                        "direction": "UP" if price_delta > 0 else "DOWN" 
                    })

                if tick_updates:
                    payload = {
                        "event": "PRICE_UPDATE",
                        "timestamp": datetime.utcnow().isoformat(),
                        "data": tick_updates
                    }
                    await self.connection_manager.broadcast(payload)
                    logger.debug(f"Broadcasted price updates: {payload}")

            except asyncio.CancelledError:
                logger.info("Real-time price simulator task was cancelled.")
                break

            except Exception as e:
                logger.error(f"Error occurred while simulating price update: {e}")

    def stop_simulation(self):
        self.is_running = False
        logger.info("Real-time price simulator stopped.")

simulator = PriceSimulator(connection_manager=manager)

def register_websocket_routes(app):
    @app.websocket("/ws/prices")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                await websocket.send_text(json.dumps({"event": "PONG", "message": "Heartbeat acknowledged"}))
        except WebSocketDisconnect:
            manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            manager.disconnect(websocket)

    @app.on_event("startup")
    async def on_startup():
        asyncio.create_task(simulator.start(interval_seconds=2.0))

    @app.on_event("shutdown")
    def on_shutdown():
        simulator.stop_simulation()
