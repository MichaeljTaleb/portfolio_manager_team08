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
        assets = session.execute(
            text("SELECT symbol, quantity FROM user_assets WHERE symbol != 'CASH'")
        ).mappings().all()

        holdings_value = 0.0
        for asset in assets:
            price_row = session.execute(
                text("SELECT open_price FROM stocks WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1"),
                {"symbol": asset['symbol']},
            ).mappings().first()
            if price_row:
                holdings_value += float(asset['quantity']) * float(price_row['open_price'])

        # Cash lives as its own row in user_assets (symbol='CASH'), matching automation_service.py.
        row = session.execute(
            text("SELECT quantity FROM user_assets WHERE symbol = 'CASH'")
        ).mappings().first()
        cash_value = float(row['quantity']) if row else 0.0

        total = (holdings_value + cash_value) or 1
        return jsonify([
            {'name': 'Holdings', 'percentage': round(holdings_value / total * 100, 1)},
            {'name': 'Cash', 'percentage': round(cash_value / total * 100, 1)},
        ])

@portfolio_bp.route('/cash')
def cash():
    with SessionLocal() as session:
        row = session.execute(
            text("SELECT cash_balance FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 1")
        ).mappings().first()
        balance = float(row['cash_balance']) if row and row['cash_balance'] is not None else 0.0

        transactions = session.execute(
            text(
                "SELECT symbol, action, quantity, price, executed_at FROM transactions "
                "ORDER BY executed_at DESC LIMIT 100"
            )
        ).mappings().all()

        return jsonify({
            'balance': balance,
            'transactions': [
                {
                    'symbol': t['symbol'],
                    'action': t['action'],
                    'quantity': float(t['quantity']),
                    'price': float(t['price']),
                    'executedAt': t['executed_at'].isoformat(),
                }
                for t in transactions
            ],
        })



@portfolio_bp.route('/cash/transfer', methods=['POST'])
def transfer_cash():
    data = request.get_json() or {}
    action = data.get('action')
    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'invalid amount'}), 400

    if amount <= 0 or action not in ['DEPOSIT', 'WITHDRAW']:
        return jsonify({'error': 'invalid request'}), 400

    with SessionLocal() as session:
        current_balance_row = session.execute(
            text("SELECT quantity FROM user_assets WHERE symbol = 'CASH'")
        ).mappings().first()
        current_cash = float(current_balance_row['quantity']) if current_balance_row else 0.0

        if action == 'WITHDRAW' and amount > current_cash:
            return jsonify({'error': 'insufficient cash balance'}), 400

        cash_delta = amount if action == 'DEPOSIT' else -amount
        new_cash = current_cash + cash_delta

        # Calculate current equity holdings value for snapshot synchronization
        assets = session.execute(
            text("SELECT symbol, quantity FROM user_assets WHERE symbol != 'CASH'")
        ).mappings().all()
        holdings_value = 0.0
        for asset in assets:
            price_row = session.execute(
                text("SELECT open_price FROM stocks WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1"),
                {"symbol": asset['symbol']},
            ).mappings().first()
            if price_row:
                holdings_value += float(asset['quantity']) * float(price_row['open_price'])

        # Update cash quantity in user_assets
        session.execute(
            text(
                """
                INSERT INTO user_assets (symbol, quantity, avg_cost_basis)
                VALUES ('CASH', :new_cash, 1)
                ON DUPLICATE KEY UPDATE quantity = :new_cash
                """
            ),
            {"new_cash": new_cash},
        )

        # Record transaction ledger entry
        session.execute(
            text(
                """
                INSERT INTO transactions (symbol, action, quantity, price)
                VALUES ('CASH', :action, :quantity, 1)
                """
            ),
            {"action": action, "quantity": amount},
        )

        # Synchronize daily snapshot in portfolio_history
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

        session.commit()

        return jsonify({
            'status': 'success',
            'action': action,
            'amount': amount,
            'newCashBalance': new_cash
        }), 200


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
