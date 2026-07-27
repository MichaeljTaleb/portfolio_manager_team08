import math
from datetime import datetime, timedelta
from decimal import Decimal

import yfinance as yf
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from models import PortfolioHistory, Stock, Transaction, TransactionAction, UserAsset

STOCK_TICKERS = ["MSFT", "AAPL", "NVDA", "AMZN", "GOOGL", 
    "META", "TSLA", "JPM", "V", "WMT"]
STOCK_NAMES = {
    "MSFT": "Microsoft Corporation",
    "AAPL": "Apple Inc.",
    "NVDA": "NVIDIA Corporation",
    "AMZN": "Amazon.com, Inc.",
    "GOOGL": "Alphabet Inc.",
    "META": "Meta Platforms, Inc.",
    "TSLA": "Tesla, Inc.",
    "JPM": "JPMorgan Chase & Co.",
    "V": "Visa Inc.",
    "WMT": "Walmart Inc."
}


def seed_database(reset: bool = False):
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        if reset:
            print("Resetting existing seed data...")
            db.query(PortfolioHistory).delete()
            db.query(Transaction).delete()
            db.query(UserAsset).delete()
            db.query(Stock).delete()
            db.commit()
        else:
            existing_assets_count = db.query(Stock).count()
            if existing_assets_count > 0:
                print("Assets already exist in the database. Skipping seeding.")
                return

        print("Seeding database with the last month of daily stock history")

        hist_df = yf.download(STOCK_TICKERS, period="1mo", interval="1d")
        if hist_df.empty:
            raise RuntimeError("No stock history data returned from yfinance.")

        open_prices = hist_df["Open"]
        if open_prices.empty:
            raise RuntimeError("No Open price data available for the requested tickers.")

        for timestamp, row in open_prices.iterrows():
            record_date = timestamp.date()

            for symbol in STOCK_TICKERS:
                price_val = row[symbol] if symbol in row else None

                if price_val is not None and not math.isnan(price_val):
                    decimal_price = Decimal(str(round(float(price_val), 4)))
                    stock_record = Stock(
                        symbol=symbol,
                        name=STOCK_NAMES[symbol],
                        price_date=record_date,
                        open_price=decimal_price,
                    )
                    db.add(stock_record)

        db.flush()
        print(f"Stock daily history seeded successfully for: {', '.join(STOCK_TICKERS)}.")

        initial_holdings = {
            "MSFT": (Decimal("100.00"), Decimal("400.00")),
            "AAPL": (Decimal("50.00"), Decimal("150.00")),
            "NVDA": (Decimal("30.00"), Decimal("200.00")),
            "AMZN": (Decimal("80.00"), Decimal("180.00")),
            "GOOGL": (Decimal("90.00"), Decimal("170.00")),
            "META": (Decimal("50.00"), Decimal("200.00")),
        }

        for symbol, (quantity, avg_cost_basis) in initial_holdings.items():
            user_asset = UserAsset(
                symbol=symbol,
                quantity=quantity,
                avg_cost_basis=avg_cost_basis,
            )
            db.add(user_asset)

            transaction = Transaction(
                symbol=symbol,
                action=TransactionAction.BUY,
                quantity=quantity,
                price=avg_cost_basis,
                executed_at=datetime.now() - timedelta(days=30),
            )
            db.add(transaction)

        print("Initial user assets and transactions seeded successfully.")

        for timestamp, row in open_prices.iterrows():
            snapshot_date = timestamp.date()
            daily_stock_total = Decimal("0.00")

            for symbol, (qty, _) in initial_holdings.items():
                if symbol in row and not math.isnan(row[symbol]):
                    price_decimal = Decimal(str(round(float(row[symbol]), 4)))
                    daily_stock_total += price_decimal * qty

            if daily_stock_total > 0:
                history_record = PortfolioHistory(
                    snapshot_date=snapshot_date,
                    total_value=daily_stock_total,
                    cash_balance=Decimal("25000.00") - daily_stock_total,
                )
                db.add(history_record)

        db.commit()
        print("Portfolio history seeded successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error occurred during seeding: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database(reset=False)
