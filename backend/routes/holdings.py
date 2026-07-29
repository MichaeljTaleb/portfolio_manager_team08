from flask import Blueprint, jsonify, request
from sqlalchemy import text

from database import SessionLocal

holdings_bp = Blueprint('holdings', __name__)


# Helper function to build a holding dictionary from a symbol + quantity
def _build_holding(session, symbol, quantity):
    latest = session.execute(
        text("SELECT name, open_price FROM stocks WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1"),
        {"symbol": symbol},
    ).mappings().first()

    quantity = float(quantity)
    latest_price = float(latest['open_price']) if latest else 0.0
    value = round(quantity * latest_price, 2)

    return {
        'ticker': symbol,
        'name': latest['name'] if latest else symbol,
        'quantity': quantity,
        'currentPrice': latest_price,
        'value': value,
    }

# Route to list all holdings with their allocations
@holdings_bp.route('/')
def list_holdings():
    with SessionLocal() as session:
        assets = session.execute(text("SELECT symbol, quantity FROM user_assets")).mappings().all()
        holdings = [_build_holding(session, a['symbol'], a['quantity']) for a in assets]

        total = sum(h['value'] for h in holdings) or 1
        for h in holdings:
            h['allocation'] = round(h['value'] / total * 100, 1)

        return jsonify(holdings)

# Route to get a specific holding by ticker
@holdings_bp.route('/<ticker>')
def get_holding(ticker):
    with SessionLocal() as session:
        asset = session.execute(
            text("SELECT symbol, quantity FROM user_assets WHERE symbol = :symbol"),
            {"symbol": ticker},
        ).mappings().first()
        if asset is None:
            return jsonify({'error': 'not found'}), 404

        all_assets = session.execute(text("SELECT symbol, quantity FROM user_assets")).mappings().all()
        total = sum(_build_holding(session, a['symbol'], a['quantity'])['value'] for a in all_assets) or 1

        holding = _build_holding(session, asset['symbol'], asset['quantity'])
        holding['allocation'] = round(holding['value'] / total * 100, 1)
        return jsonify(holding)

# Recalculates today's portfolio_history row after a buy/sell changes cash + holdings value
def _update_todays_snapshot(session, cash_delta):
    assets = session.execute(text("SELECT symbol, quantity FROM user_assets")).mappings().all()
    holdings_value = sum(_build_holding(session, a['symbol'], a['quantity'])['value'] for a in assets)

    row = session.execute(
        text("SELECT cash_balance FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
    ).mappings().first()
    current_cash = float(row['cash_balance']) if row and row['cash_balance'] is not None else 0.0
    new_cash = current_cash + cash_delta

    session.execute(
        text(
            """
            INSERT INTO portfolio_history (snapshot_date, total_value, cash_balance)
            VALUES (CURDATE(), :total_value, :cash_balance)
            ON DUPLICATE KEY UPDATE total_value = VALUES(total_value), cash_balance = VALUES(cash_balance)
            """
        ),
        {"total_value": holdings_value + new_cash, "cash_balance": new_cash},
    )


# Route to create a new holding or update an existing one
# Adds to transactions table and the user_assets table
@holdings_bp.route('/', methods=['POST'])
def create_holding():
    data = request.get_json()
    cost = data['quantity'] * data['price']

    with SessionLocal() as session:
        row = session.execute(
            text("SELECT cash_balance FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
        ).mappings().first()
        current_cash = float(row['cash_balance']) if row and row['cash_balance'] is not None else 0.0

        if cost > current_cash:
            return jsonify({'error': 'insufficient cash'}), 400

        session.execute(
            text(
                """
                INSERT INTO user_assets (symbol, quantity)
                VALUES (:symbol, :quantity)
                ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
                """
            ),
            {"symbol": data['ticker'], "quantity": data['quantity']},
        )
        session.execute(
            text("INSERT INTO transactions (symbol, action, quantity, price) VALUES (:symbol, 'BUY', :quantity, :price)"),
            {"symbol": data['ticker'], "quantity": data['quantity'], "price": data['price']},
        )
        _update_todays_snapshot(session, -cost)
        session.commit()
        return jsonify({'ticker': data['ticker'], 'quantity': data['quantity']}), 201

# Route to sell a stock
@holdings_bp.route('/<ticker>/sell', methods=['POST'])
def sell_stock(ticker):
    data = request.get_json()
    with SessionLocal() as session:
        asset = session.execute(
            text("SELECT quantity FROM user_assets WHERE symbol = :symbol"),
            {"symbol": ticker},
        ).mappings().first()
        if asset is None:
            return jsonify({'error': 'not found'}), 404

        held_quantity = float(asset['quantity'])
        sell_quantity = float(data['quantity'])

        if held_quantity < sell_quantity:
            return jsonify({'error': 'insufficient quantity'}), 400
        elif held_quantity == sell_quantity:
            session.execute(text("DELETE FROM user_assets WHERE symbol = :symbol"), {"symbol": ticker})
        else:
            session.execute(
                text("UPDATE user_assets SET quantity = quantity - :quantity WHERE symbol = :symbol"),
                {"quantity": sell_quantity, "symbol": ticker},
            )

        session.execute(
            text("INSERT INTO transactions (symbol, action, quantity, price) VALUES (:symbol, 'SELL', :quantity, :price)"),
            {"symbol": ticker, "quantity": sell_quantity, "price": data['price']},
        )
        _update_todays_snapshot(session, sell_quantity * data['price'])
        session.commit()
        return jsonify({'ticker': ticker, 'quantity': sell_quantity}), 200
