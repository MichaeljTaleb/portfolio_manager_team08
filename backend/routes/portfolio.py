from flask import Blueprint, jsonify, request
from sqlalchemy import text

from database import SessionLocal

portfolio_bp = Blueprint('portfolio', __name__)

@portfolio_bp.route('/summary')
def summary():
    with SessionLocal() as session:
        first = session.execute(
            text("SELECT snapshot_date, total_value FROM portfolio_history ORDER BY snapshot_date ASC LIMIT 1")
        ).mappings().first()
        if first is None:
            return jsonify({'error': 'no portfolio_history snapshots yet'}), 404

        latest = session.execute(
            text("SELECT snapshot_date, total_value FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
        ).mappings().first()

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
    with SessionLocal() as session:
        assets = session.execute(text("SELECT symbol, quantity FROM user_assets")).mappings().all()

        holdings_value = 0.0
        for asset in assets:
            price_row = session.execute(
                text("SELECT open_price FROM stocks WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1"),
                {"symbol": asset['symbol']},
            ).mappings().first()
            if price_row:
                holdings_value += float(asset['quantity']) * float(price_row['open_price'])

        row = session.execute(
            text("SELECT cash_balance FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
        ).mappings().first()
        cash_value = float(row['cash_balance']) if row and row['cash_balance'] is not None else 0.0

        total = (holdings_value + cash_value) or 1
        return jsonify([
            {'name': 'Holdings', 'percentage': round(holdings_value / total * 100, 1)},
            {'name': 'Cash', 'percentage': round(cash_value / total * 100, 1)},
        ])

@portfolio_bp.route('/performance')
def performance():
    range_param = request.args.get('range', '1m')
    days = {'1w': 7, '2w': 14, '3w': 21, '1m': 30}.get(range_param, 30)

    with SessionLocal() as session:
        rows = session.execute(
            text(
                "SELECT snapshot_date, total_value FROM portfolio_history "
                "WHERE snapshot_date >= CURDATE() - INTERVAL :days DAY ORDER BY snapshot_date"
            ),
            {"days": days},
        ).mappings().all()

        return jsonify({
            'values': [float(r['total_value']) for r in rows],
            'axis': [str(r['snapshot_date']) for r in rows],
            'label': range_param,
        })
