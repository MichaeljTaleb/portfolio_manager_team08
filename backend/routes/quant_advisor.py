import json
import math
import os
import time
import urllib.error
import urllib.request
from flask import Blueprint, jsonify, request
from sqlalchemy import text

from database import SessionLocal

quant_advisor_bp = Blueprint('quant_advisor', __name__)
GEMINI_MODEL = 'gemini-3-flash-preview'
FORECAST_DAYS = 30
SIMULATION_COUNT = 500


def _get_latest_price(session, symbol):
    row = session.execute(
        text("SELECT name, sector, open_price FROM stocks WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1"),
        {'symbol': symbol},
    ).mappings().first()
    if not row:
        return None

    return {
        'name': row['name'] or symbol,
        'sector': row['sector'] or 'Other',
        'price': float(row['open_price']) if row['open_price'] is not None else 0.0,
    }


def _get_cash_balance(session):
    row = session.execute(text("SELECT quantity FROM user_assets WHERE symbol = 'CASH'"))
    row = row.mappings().first()
    return float(row['quantity']) if row and row['quantity'] is not None else 0.0


def _get_holdings(session):
    rows = session.execute(text("SELECT symbol, quantity FROM user_assets WHERE symbol != 'CASH'"))
    rows = rows.mappings().all()

    holdings = []
    for row in rows:
        symbol = row['symbol']
        quantity = float(row['quantity'] or 0)
        if quantity <= 0:
            continue

        price_row = _get_latest_price(session, symbol)
        if not price_row:
            continue

        value = round(quantity * price_row['price'], 2)
        holdings.append({
            'symbol': symbol,
            'name': price_row['name'],
            'sector': price_row['sector'],
            'quantity': quantity,
            'price': price_row['price'],
            'value': value,
        })

    return holdings


def _quantile(values, value):
    if not values:
        return 0
    index = max(0, min(len(values) - 1, round((len(values) - 1) * value)))
    return values[index] or 0


def _create_forecast(starting_value, daily_volatility, days=FORECAST_DAYS, paths=SIMULATION_COUNT):
    seed = 81421

    def random_value():
        nonlocal seed
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646

    def normal_value():
        return math.sqrt(-2 * math.log(max(random_value(), 0.000001))) * math.cos(2 * math.pi * random_value())

    paths_data = []
    for _ in range(paths):
        values = [starting_value]
        for _ in range(days):
            daily_return = 0.00025 + daily_volatility * normal_value()
            values.append(values[-1] * (1 + daily_return))
        paths_data.append(values)

    forecast = []
    for day in range(days + 1):
        values = sorted(path[day] for path in paths_data)
        forecast.append({
            'day': day,
            'low': round(_quantile(values, 0.1), 2),
            'likely': round(_quantile(values, 0.5), 2),
            'high': round(_quantile(values, 0.9), 2),
        })

    return forecast


def _build_summary_payload(session):
    holdings = _get_holdings(session)
    cash_balance = _get_cash_balance(session)
    total_value = round(sum(item['value'] for item in holdings) + cash_balance, 2)

    grouped = {}
    for holding in holdings:
        sector = holding['sector'] or 'Other'
        grouped[sector] = grouped.get(sector, 0) + holding['value']

    if not grouped and cash_balance <= 0:
        return {
            'totalValue': round(total_value, 2),
            'healthScore': 0,
            'metrics': {'risk': 0, 'efficiency': 0},
            'forecast': [{'day': index, 'low': 0, 'likely': 0, 'high': 0} for index in range(FORECAST_DAYS + 1)],
            'sectorRisk': [],
        }

    total = total_value or 1
    risks = []
    for name, value in grouped.items():
        weight = (value / total) * 100
        risks.append({
            'name': name,
            'value': value,
            'moneyWeight': round(weight, 1),
        })

    risks.sort(key=lambda item: item['value'], reverse=True)
    total_risk = sum(item['moneyWeight'] for item in risks) or 1
    sector_breakdown = []
    for item in risks:
        risk_weight = (item['moneyWeight'] / total_risk) * 100
        sector_breakdown.append({
            'name': item['name'],
            'value': item['value'],
            'moneyWeight': item['moneyWeight'],
            'riskWeight': round(risk_weight, 1),
        })

    concentration = sum((item['moneyWeight'] / 100) ** 2 for item in risks)
    volatility = min(0.34, max(0.08, 0.11 + concentration * 0.22))
    daily_volatility = volatility / math.sqrt(252)
    forecast = _create_forecast(total_value or 1, daily_volatility)

    health_score = round(max(25, min(97, 92 - concentration * 70 - max(0, volatility - 0.16) * 90 + min(len(risks), 6) * 2)))
    efficiency = max(0.08, min(1.2, 0.58 - volatility + len(risks) * 0.025))

    return {
        'totalValue': round(total_value, 2),
        'healthScore': health_score,
        'metrics': {
            'risk': round(volatility * 100, 1),
            'efficiency': round(efficiency, 2),
        },
        'forecast': forecast,
        'sectorRisk': sector_breakdown,
    }


@quant_advisor_bp.route('/summary')
def summary():
    with SessionLocal() as session:
        payload = _build_summary_payload(session)
        return jsonify(payload)


@quant_advisor_bp.route('/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    prompt = (data.get('prompt') or '').strip()
    if not prompt:
        return jsonify({'error': 'Prompt is required.'}), 400

    api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        return jsonify({'error': 'Gemini API key is not configured on the backend.'}), 500

    with SessionLocal() as session:
        summary_payload = _build_summary_payload(session)

    risk_summary = ', '.join(f"{item['name']} {item['riskWeight']:.1f}%" for item in summary_payload['sectorRisk'][:4])
    context = (
        f"Portfolio total: ${summary_payload['totalValue']:.0f}. "
        f"Health score: {summary_payload['healthScore']}/100. "
        f"Estimated volatility risk: {summary_payload['metrics']['risk']:.1f}%. "
        f"Top sector risks: {risk_summary}. "
        "Explain everything in plain English for a beginner. Do not give personalized investment instructions; explain risk and trade-offs."
    )

    payload = {
        'contents': [{
            'role': 'user',
            'parts': [{'text': f"{context}\n\n{prompt}"}],
        }],
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"

    last_error = None
    for attempt in range(3):
        request_obj = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
            },
            method='POST',
        )

        try:
            with urllib.request.urlopen(request_obj, timeout=90) as response:
                body = json.loads(response.read().decode('utf-8'))
                break
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code in {429, 500, 502, 503} and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
    else:
        body = {}

    if last_error is not None and 'body' not in locals():
        return jsonify({'error': f'Gemini request failed: {last_error}'}), 502

    answer_text = ''
    candidates = body.get('candidates') or []
    if candidates:
        parts = candidates[0].get('content', {}).get('parts') or []
        answer_text = ''.join(part.get('text', '') for part in parts).strip()

    if not answer_text:
        return jsonify({'error': 'Gemini returned an empty response.'}), 502

    return jsonify({'answer': answer_text})
