from flask import Blueprint, jsonify, request

from db import get_cursor, mydb

holdings_bp = Blueprint('holdings', __name__)

# Helper function to build a holding dictionary from an asset record
def _build_holding(asset):
    cursor = get_cursor()
    cursor.execute(
        "SELECT name, open_price FROM stocks WHERE symbol = %s ORDER BY price_date DESC LIMIT 1",
        (asset['symbol'],),
    )
    latest = cursor.fetchone()

    quantity = float(asset['quantity'])
    latest_price = float(latest['open_price']) if latest else 0.0
    value = round(quantity * latest_price, 2)

    return {
        'ticker': asset['symbol'],
        'name': latest['name'] if latest else asset['symbol'],
        'quantity': quantity,
        'value': value,
    }

# Route to list all holdings with their allocations
@holdings_bp.route('/')
def list_holdings():
    cursor = get_cursor()
    cursor.execute("SELECT symbol, quantity FROM user_assets")
    assets = cursor.fetchall()

    holdings = [_build_holding(asset) for asset in assets]
    total = sum(h['value'] for h in holdings) or 1
    for h in holdings:
        h['allocation'] = round(h['value'] / total * 100, 1)

    return jsonify(holdings)

# Route to get a specific holding by ticker
@holdings_bp.route('/<ticker>')
def get_holding(ticker):
    cursor = get_cursor()
    cursor.execute("SELECT symbol, quantity FROM user_assets WHERE symbol = %s", (ticker,))
    asset = cursor.fetchone()
    if asset is None:
        return jsonify({'error': 'not found'}), 404

    cursor.execute("SELECT symbol, quantity FROM user_assets")
    all_assets = cursor.fetchall()
    total = sum(_build_holding(a)['value'] for a in all_assets) or 1

    holding = _build_holding(asset)
    holding['allocation'] = round(holding['value'] / total * 100, 1)
    return jsonify(holding)

# Recalculates today's portfolio_history row after a buy/sell changes cash + holdings value
def _update_todays_snapshot(cash_delta):
    cursor = get_cursor()

    cursor.execute("SELECT symbol, quantity FROM user_assets")
    assets = cursor.fetchall()
    holdings_value = sum(_build_holding(a)['value'] for a in assets)

    cursor.execute("SELECT cash_balance FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
    row = cursor.fetchone()
    current_cash = float(row['cash_balance']) if row and row['cash_balance'] is not None else 0.0
    new_cash = current_cash + cash_delta

    cursor.execute(
        """
        INSERT INTO portfolio_history (snapshot_date, total_value, cash_balance)
        VALUES (CURDATE(), %s, %s)
        ON DUPLICATE KEY UPDATE total_value = VALUES(total_value), cash_balance = VALUES(cash_balance)
        """,
        (holdings_value + new_cash, new_cash),
    )


# Route to create a new holding or update an existing one
# Adds to transactions table and the user_assets table
@holdings_bp.route('/', methods=['POST'])
def create_holding():
    data = request.get_json()
    cursor = get_cursor()
    cursor.execute(
        """
        INSERT INTO user_assets (symbol, quantity)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
        """,
        (data['ticker'], data['quantity']),
    )
    cursor.execute(
        "INSERT INTO transactions (symbol, action, quantity, price) VALUES (%s, 'BUY', %s, %s)",
        (data['ticker'], data['quantity'], data['price']),
    )
    _update_todays_snapshot(-(data['quantity'] * data['price']))
    mydb.commit()
    return jsonify({'ticker': data['ticker'], 'quantity': data['quantity']}), 201

# Route to sell a stock
@holdings_bp.route('/<ticker>/sell', methods=['POST'])
def sell_stock(ticker):
    data = request.get_json()
    cursor = get_cursor()
    cursor.execute("SELECT quantity FROM user_assets WHERE symbol = %s", (ticker,))
    asset = cursor.fetchone()
    if asset is None:
        return jsonify({'error': 'not found'}), 404

    held_quantity = float(asset['quantity'])
    sell_quantity = float(data['quantity'])

    if held_quantity < sell_quantity:
        return jsonify({'error': 'insufficient quantity'}), 400
    elif held_quantity == sell_quantity:
        cursor.execute("DELETE FROM user_assets WHERE symbol = %s", (ticker,))
    else:
        cursor.execute(
            "UPDATE user_assets SET quantity = quantity - %s WHERE symbol = %s",
            (sell_quantity, ticker)
        )

    cursor.execute(
        "INSERT INTO transactions (symbol, action, quantity, price) VALUES (%s, 'SELL', %s, %s)",
        (ticker, sell_quantity, data['price'])
    )
    _update_todays_snapshot(sell_quantity * data['price'])
    mydb.commit()
    return jsonify({'ticker': ticker, 'quantity': sell_quantity}), 200