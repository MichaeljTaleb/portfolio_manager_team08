from flask import Blueprint, jsonify

from db import get_cursor

portfolio_bp = Blueprint('portfolio', __name__)


@portfolio_bp.route('/summary')
def summary():
    cursor = get_cursor()

    cursor.execute("SELECT snapshot_date, total_value FROM portfolio_history ORDER BY snapshot_date ASC LIMIT 1")
    first = cursor.fetchone()
    if first is None:
        return jsonify({'error': 'no portfolio_history snapshots yet'}), 404

    cursor.execute("SELECT snapshot_date, total_value FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
    latest = cursor.fetchone()

    total_value = float(latest['total_value'])
    first_value = float(first['total_value'])

    total_return = round(total_value - first_value, 2)
    total_return_percent = round(total_return / first_value * 100, 2) if first_value else None

    # TODO: dayGain needs a live current price (websocket feed, built separately).
    # Placeholder until that's wired in.
    day_gain = 0.0
    day_gain_percent = 0.0

    return jsonify({
        'asOf': str(first['snapshot_date']),
        'totalValue': total_value,
        'dayGain': day_gain,
        'dayGainPercent': day_gain_percent,
        'totalReturn': total_return,
        'totalReturnPercent': total_return_percent,
    })


@portfolio_bp.route('/allocation')
def allocation():
    cursor = get_cursor()
    cursor.execute("SELECT symbol, quantity FROM user_assets")
    assets = cursor.fetchall()

    holdings_value = 0.0
    for asset in assets:
        cursor.execute(
            "SELECT open_price FROM stocks WHERE symbol = %s ORDER BY price_date DESC LIMIT 1",
            (asset['symbol'],),
        )
        price_row = cursor.fetchone()
        if price_row:
            holdings_value += float(asset['quantity']) * float(price_row['open_price'])

    cursor.execute("SELECT cash_balance FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
    row = cursor.fetchone()
    cash_value = float(row['cash_balance']) if row and row['cash_balance'] is not None else 0.0

    total = (holdings_value + cash_value) or 1
    return jsonify([
        {'name': 'Holdings', 'percentage': round(holdings_value / total * 100, 1)},
        {'name': 'Cash', 'percentage': round(cash_value / total * 100, 1)},
    ])
