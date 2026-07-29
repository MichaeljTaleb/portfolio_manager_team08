from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    DECIMAL,
    Date,
    DateTime,
    Enum as SQLAEnum,
    String,
    BigInteger,
    UniqueConstraint,
    Column,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AssetType(str, Enum):
    EQUITY = "EQUITY"
    BOND = "BOND"
    CASH = "CASH"


class TransactionAction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class Stock(Base):
    __tablename__ = "stocks"

    symbol: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_date: Mapped[date] = mapped_column(Date, primary_key=True)
    open_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False)


class UserAsset(Base):
    __tablename__ = "user_assets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(DECIMAL(18, 6), nullable=False)
    avg_cost_basis: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    action: Mapped[TransactionAction] = mapped_column(
        SQLAEnum(TransactionAction, native_enum=False), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(DECIMAL(18, 6), nullable=False)
    price: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class PortfolioHistory(Base):
    __tablename__ = "portfolio_history"

    snapshot_date: Mapped[date] = mapped_column(Date, primary_key=True)
    total_value: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False)
    cash_balance: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
