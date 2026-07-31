from datetime import date, timedelta

import pandas as pd
import yfinance as yf
from flask import Blueprint, jsonify, request
from sqlalchemy import text

from database import SessionLocal

holdings_bp = Blueprint('holdings', __name__)


# Helper function to build a holding dictionary from a symbol + quantity
def _build_holding(session, symbol, quantity):
    # Get today's opening price for accurate daily change calculation
    today_price = session.execute(
        text("SELECT name, sector, open_price FROM stocks WHERE symbol = :symbol AND price_date = CURDATE()"),
        {"symbol": symbol},
    ).mappings().first()

    # Fall back to latest if today's data not available
    latest = today_price or session.execute(
        text("SELECT name, sector, open_price FROM stocks WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1"),
        {"symbol": symbol},
    ).mappings().first()

    asset = session.execute(
        text("SELECT avg_cost_basis FROM user_assets WHERE symbol = :symbol"),
        {"symbol": symbol},
    ).mappings().first()

    quantity = float(quantity)
    latest_price = float(latest['open_price']) if latest else 0.0
    avg_cost_basis = float(asset['avg_cost_basis']) if asset else 0.0
    value = round(quantity * latest_price, 2)
    total_gain_loss = round(quantity * (latest_price - avg_cost_basis), 2)

    return {
        'ticker': symbol,
        'name': latest['name'] if latest else symbol,
        'sector': latest['sector'] if (latest and 'sector' in latest) else 'Other',
        'quantity': quantity,
        'currentPrice': latest_price,
        'avgCostBasis': avg_cost_basis,
        'value': value,
        'totalGainLoss': total_gain_loss,
    }


# Cash lives as its own row in user_assets (symbol='CASH', avg_cost_basis=1),
# matching what automation_service.py expects.
def _get_cash_balance(session):
    row = session.execute(
        text("SELECT quantity FROM user_assets WHERE symbol = 'CASH'")
    ).mappings().first()
    return float(row['quantity']) if row else 0.0


def _set_cash_balance(session, new_cash):
    session.execute(
        text(
            """
            INSERT INTO user_assets (symbol, quantity, avg_cost_basis)
            VALUES ('CASH', :amount, 1)
            ON DUPLICATE KEY UPDATE quantity = :amount
            """
        ),
        {"amount": new_cash},
    )

# Route to list all known stock symbols + names, for ticker autocomplete
@holdings_bp.route('/symbols')
def list_symbols():
    with SessionLocal() as session:
        rows = session.execute(
            text(
                """
                SELECT symbol, name FROM stocks s
                WHERE price_date = (SELECT MAX(price_date) FROM stocks WHERE symbol = s.symbol)
                ORDER BY symbol
                """
            )
        ).mappings().all()
        return jsonify([{'symbol': r['symbol'], 'name': r['name']} for r in rows])

# Route to list all holdings with their allocations
@holdings_bp.route('/')
def list_holdings():
    with SessionLocal() as session:
        assets = session.execute(
            text("SELECT symbol, quantity FROM user_assets WHERE symbol != 'CASH'")
        ).mappings().all()
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

        all_assets = session.execute(
            text("SELECT symbol, quantity FROM user_assets WHERE symbol != 'CASH'")
        ).mappings().all()
        total = sum(_build_holding(session, a['symbol'], a['quantity'])['value'] for a in all_assets) or 1

        holding = _build_holding(session, asset['symbol'], asset['quantity'])
        holding['allocation'] = round(holding['value'] / total * 100, 1)
        return jsonify(holding)


# Route to get a symbol's price history for the stock detail page's chart.
# Ranges 1d/1w/1m/1y map to fixed yfinance periods; since_bought starts from
# the symbol's first BUY transaction date.
@holdings_bp.route('/<ticker>/performance')
def holding_performance(ticker):
    range_param = (request.args.get('range', '1m') or '1m').lower()
    ticker = ticker.upper()
    since_date = None

    if range_param == 'since_bought':
        with SessionLocal() as session:
            first_buy = session.execute(
                text("SELECT MIN(executed_at) AS first_buy FROM transactions WHERE symbol = :symbol AND action = 'BUY'"),
                {"symbol": ticker},
            ).mappings().first()

        start = first_buy['first_buy'].date() if first_buy and first_buy['first_buy'] else date.today()
        hist = yf.download(ticker, start=start, end=date.today() + timedelta(days=1), interval="1d", auto_adjust=True, progress=False)
        label = f"Since {start.strftime('%b %d, %Y')}"
        since_date = start.isoformat()
    else:
        period_map = {
            '1d': ('1d', '5m'),
            '1w': ('5d', '30m'),
            '1m': ('1mo', '1d'),
            '1y': ('1y', '1d'),
        }
        period, interval = period_map.get(range_param, ('1mo', '1d'))
        hist = yf.download(ticker, period=period, interval=interval, auto_adjust=True, progress=False)
        label = range_param.upper()

    if hist.empty:
        return jsonify({'values': [], 'axis': [], 'label': label, 'sinceDate': since_date})

    if isinstance(hist.columns, pd.MultiIndex):
        close_series = hist['Close'][ticker] if ticker in hist['Close'].columns else hist['Close'].iloc[:, 0]
    else:
        close_series = hist['Close']

    close_series = close_series.dropna()
    date_format = '%Y-%m-%d %H:%M' if range_param in ('1d', '1w') else '%Y-%m-%d'

    return jsonify({
        'values': [round(float(v), 2) for v in close_series.tolist()],
        'axis': [ts.strftime(date_format) for ts in close_series.index],
        'label': label,
        'sinceDate': since_date,
    })


# Route to get a symbol's earnings date + analyst rating/price targets for
# the stock detail page. yfinance's calendar/info data is sparse for some
# tickers, so every field is best-effort and can come back null.
@holdings_bp.route('/<ticker>/analysis')
def holding_analysis(ticker):
    ticker = ticker.upper()
    stock = yf.Ticker(ticker)

    earnings_date = None
    try:
        calendar = stock.calendar
        raw_date = None
        if isinstance(calendar, dict):
            raw_date = calendar.get('Earnings Date')
        elif calendar is not None and not calendar.empty and 'Earnings Date' in calendar.index:
            raw_date = calendar.loc['Earnings Date'].iloc[0]

        if isinstance(raw_date, (list, tuple)) and raw_date:
            raw_date = raw_date[0]
        if raw_date is not None:
            earnings_date = raw_date.isoformat() if hasattr(raw_date, 'isoformat') else str(raw_date)
    except Exception:
        earnings_date = None

    recommendation = None
    recommendation_mean = None
    number_of_analysts = None
    target_mean_price = None
    target_high_price = None
    target_low_price = None
    try:
        info = stock.info
        recommendation = info.get('recommendationKey')
        recommendation_mean = info.get('recommendationMean')
        number_of_analysts = info.get('numberOfAnalystOpinions')
        target_mean_price = info.get('targetMeanPrice')
        target_high_price = info.get('targetHighPrice')
        target_low_price = info.get('targetLowPrice')
    except Exception:
        pass

    return jsonify({
        'earningsDate': earnings_date,
        'recommendation': recommendation,
        'recommendationMean': recommendation_mean,
        'numberOfAnalysts': number_of_analysts,
        'targetMeanPrice': target_mean_price,
        'targetHighPrice': target_high_price,
        'targetLowPrice': target_low_price,
    })


# Recalculates today's portfolio_history row after a buy/sell changes cash + holdings value.
# Keeps the user_assets CASH row and portfolio_history.cash_balance in sync.
def _update_todays_snapshot(session, cash_delta):
    assets = session.execute(
        text("SELECT symbol, quantity FROM user_assets WHERE symbol != 'CASH'")
    ).mappings().all()
    holdings_value = sum(_build_holding(session, a['symbol'], a['quantity'])['value'] for a in assets)

    new_cash = _get_cash_balance(session) + cash_delta
    _set_cash_balance(session, new_cash)

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
        if cost > _get_cash_balance(session):
            return jsonify({'error': 'insufficient cash'}), 400

        existing = session.execute(
            text("SELECT quantity, avg_cost_basis FROM user_assets WHERE symbol = :symbol"),
            {"symbol": data['ticker']},
        ).mappings().first()

        existing_quantity = float(existing['quantity']) if existing else 0.0
        existing_avg_cost = float(existing['avg_cost_basis']) if existing else 0.0
        new_quantity = existing_quantity + data['quantity']
        # Weighted average of the existing cost basis and this purchase's price,
        # so avg_cost_basis stays accurate across multiple buys of the same stock.
        new_avg_cost = (existing_quantity * existing_avg_cost + data['quantity'] * data['price']) / new_quantity

        session.execute(
            text(
                """
                INSERT INTO user_assets (symbol, quantity, avg_cost_basis)
                VALUES (:symbol, :quantity, :avg_cost_basis)
                ON DUPLICATE KEY UPDATE quantity = :quantity, avg_cost_basis = :avg_cost_basis
                """
            ),
            {"symbol": data['ticker'], "quantity": new_quantity, "avg_cost_basis": new_avg_cost},
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
