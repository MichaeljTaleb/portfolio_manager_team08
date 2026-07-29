import asyncio
import logging
import math
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

import yfinance as yf
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Stock, UserAsset, PortfolioHistory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("automation_service")

def sync_daily_stock_prices(db:Session) -> int:
    logger.info("Starting daily stock price synchronization...")

    holding_symbols = [s[0].upper() for s in db.query(UserAsset.symbol).distinct().all() if s[0]]
    existing_symbols = [s[0].upper() for s in db.query(Stock.symbol).distinct().all() if s[0]]

    all_symbols = list(set(holding_symbols + existing_symbols))

    symbols_to_sync = [
        symbol for symbol in all_symbols
        if symbol not in ["USD", "CASH"]
    ]

    if not symbols_to_sync:
        logger.info("No symbols to synchronize.")
        return 0

    inserted_records_count = 0

    try:
        hist_df = yf.download(symbols_to_sync, period="2d", group_by='ticker', auto_adjust=True, threads=True)

        if hist_df.empty:
            logger.warning("No historical data fetched from Yahoo Finance.")
            return 0

        open_prices = hist_df['Open'] if 'Open' in hist_df else hist_df

        for timestamp, row in open_prices.iterrows():
            record_date: date = timestamp.date()
            
            for symbol in symbols_to_sync:
                existing_entry = (
                    db.query(Stock)
                    .filter(Stock.symbol == symbol, Stock.price_date == record_date)
                    .first()
                )

                if existing_entry:
                    continue

                price_val = None
                if len(symbols_to_sync) == 1:
                    price_val = row if isinstance(row, (int, float, Decimal)) else row.iloc[0]
                elif symbol in row:
                    price_val = row[symbol] 

                if price_val is not None and not math.isnan(price_val):
                    decimal_price = Decimal(str(round(float(price_val), 4)))

                    existing_stock = db.query(Stock).filter(Stock.symbol == symbol).first()
                    company_name = existing_stock.name if existing_stock else symbol

                    stock_record = Stock(
                        symbol=symbol,
                        name=company_name,
                        price_date=record_date,
                        open_price=decimal_price
                    )
                    db.add(stock_record)
                    inserted_records_count += 1
        db.commit()
        logger.info(f"Inserted {inserted_records_count} new stock price records.")
        return inserted_records_count

    except Exception as e:
        logger.error(f"Error during stock price synchronization: {e}")
        db.rollback()
        return 0

def record_daily_portfolio_snapshot(db: Session) -> Optional[PortfolioHistory]:
    today: date = date.today()
    logger.info(f"Recording daily portfolio snapshot for {today}")

    try:
        existing_snapshot = db.query(PortfolioHistory).filter(PortfolioHistory.snapshot_date == today).first()

        latest_price_date = db.query(func.max(Stock.price_date)).scalar() or today

        user_assets = db.query(UserAsset).all()

        total_stock_value = Decimal(0)
        cash_value = Decimal(0)

        for asset in user_assets:
            if asset.symbol.upper() in ["USD", "CASH"]:
                cash_value = Decimal(str(asset.quantity)) * Decimal(str(asset.avg_cost_basis))
                continue

            stock_entry = (
                db.query(Stock)
                .filter(Stock.symbol == asset.symbol, Stock.price_date == latest_price_date)
                .first()
            )

            unit_price = stock_entry.open_price if stock_entry else asset.avg_cost_basis
            total_stock_value += unit_price * asset.quantity

        total_nav = total_stock_value + cash_value

        if existing_snapshot:
            existing_snapshot.total_value = total_nav
            existing_snapshot.cash_balance = cash_value
            db.commit()
            logger.info(f"Updated existing portfolio snapshot for {today}")
            return existing_snapshot

        new_snapshot = PortfolioHistory(
            snapshot_date=today,
            total_value=total_nav,
            cash_balance=cash_value,
            created_at=datetime.utcnow(),
        )
        db.add(new_snapshot)
        db.commit()
        logger.info(f"Recorded new portfolio snapshot for {today}")
        return new_snapshot

    except Exception as e:
        logger.error(f"Error recording portfolio snapshot: {e}")
        db.rollback()
        return None


def run_daily_automation_job():
    db: Session = SessionLocal()
    try:
        logger.info("Executing scheduled daily automation job...")
        sync_daily_stock_prices(db)
        record_daily_portfolio_snapshot(db)
    finally:
        db.close()


class DailyAutomationScheduler:
    def __init__(self):
        self.is_running = False

    async def start_scheduler(self, interval_hours: float = 24.0):
        self.is_running = True

        run_daily_automation_job()

        while self.is_running:
            try:
                await asyncio.sleep(interval_hours * 3600)
                if self.is_running:
                    run_daily_automation_job()
            except asyncio.CancelledError:
                logger.info("Daily automation scheduler has been cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in daily automation scheduler: {e}")

    def stop_scheduler(self):
        self.is_running = False
        logger.info("Daily automation scheduler has been stopped.")

automation_scheduler = DailyAutomationScheduler()

def register_automation_routes(app):
    @app.post("/api/admin/trigger-daily-sync")
    def trigger_daily_sync():
        run_daily_automation_job()
        return {"message": "Daily automation job executed successfully."}

    @app.on_event("startup")
    async def on_startup():
        asyncio.create_task(automation_scheduler.start_scheduler(interval_hours=24.0))

    @app.on_event("shutdown")
    async def on_shutdown():
        automation_scheduler.stop_scheduler()
