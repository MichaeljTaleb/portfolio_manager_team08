"""
Standalone console script — NOT part of pytest (filename doesn't start with
test_, so pytest won't auto-collect it), NOT wired into the app's routes or
startup. Run it directly:

    python3 pl_test_real_functions.py

Unlike a mock-based test, this calls the REAL create_holding / sell_stock /
get_holding routes from routes/holdings.py through Flask's test client,
exactly as the live app runs them, against your actual configured database
(backend/.env). No functions are modified or reimplemented.

It uses a throwaway ticker (TEST_TICKER) so your real holdings are never
touched, and cleans up everything it creates in a finally block — but it
DOES temporarily overwrite your real CASH balance for the duration of the
run (restored afterward) so it can assert exact values matching the CSV
trace, rather than only checking relative deltas.

CAVEAT: get_holding()/_build_holding() only ever compute CURRENT unrealized
gain/loss — there is no realized_pl or total_pl anywhere in the schema or
API. So this script checks cash, shares, avg_cost_per_share, and
unrealized_pl against the real functions; it does not (and can't) check
realized_pl/total_pl, since no real function computes those today.
"""

import csv
import sys
from pathlib import Path

from flask import Flask
from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
from routes.holdings import holdings_bp  # noqa: E402

TEST_TICKER = "ZZTEST"
STARTING_CASH = 1000.0
CSV_PATH = Path(__file__).resolve().parent / "pl_simulation_sample.csv"


def build_test_client():
    app = Flask(__name__)
    app.register_blueprint(holdings_bp, url_prefix="/api/holdings")
    return app.test_client()


def get_real_cash_balance(session) -> float:
    row = session.execute(text("SELECT quantity FROM user_assets WHERE symbol = 'CASH'")).mappings().first()
    return float(row["quantity"]) if row else 0.0


def set_cash_balance(session, amount: float) -> None:
    session.execute(
        text(
            """
            INSERT INTO user_assets (symbol, quantity, avg_cost_basis)
            VALUES ('CASH', :amount, 1)
            ON DUPLICATE KEY UPDATE quantity = :amount
            """
        ),
        {"amount": amount},
    )
    session.commit()


def set_test_price(session, price: float) -> None:
    """Writes today's open_price for the test ticker — this is exactly what
    _build_holding() reads to compute currentPrice / totalGainLoss, so
    setting it here is how we feed each CSV row's price into the real
    calculation without touching any app code."""
    session.execute(
        text(
            """
            INSERT INTO stocks (symbol, name, sector, price_date, open_price)
            VALUES (:symbol, :symbol, 'Other', CURDATE(), :price)
            ON DUPLICATE KEY UPDATE open_price = :price
            """
        ),
        {"symbol": TEST_TICKER, "price": price},
    )
    session.commit()


def cleanup(session) -> None:
    session.execute(text("DELETE FROM user_assets WHERE symbol = :s"), {"s": TEST_TICKER})
    session.execute(text("DELETE FROM transactions WHERE symbol = :s"), {"s": TEST_TICKER})
    session.execute(text("DELETE FROM stocks WHERE symbol = :s"), {"s": TEST_TICKER})
    session.commit()


def close_enough(actual: float, expected: float, tolerance: float = 0.01) -> bool:
    return abs(actual - expected) <= tolerance


def parse_action(raw_action: str):
    raw_action = (raw_action or "").strip()
    if not raw_action:
        return None
    side, qty = raw_action.split()
    return side.upper(), float(qty)


def run() -> bool:
    client = build_test_client()

    with SessionLocal() as session:
        original_cash = get_real_cash_balance(session)
        print(f"(saved your real cash balance: {original_cash:.2f} -- will restore when done)\n")
        cleanup(session)  # in case a previous run was interrupted before cleanup
        set_cash_balance(session, STARTING_CASH)

    all_passed = True
    try:
        with CSV_PATH.open(newline="") as f:
            rows = list(csv.DictReader(f))

        print(f"Starting cash: {STARTING_CASH:.2f}\n")

        for i, row in enumerate(rows, start=1):
            price = float(row["current_price"])
            action = parse_action(row["action"])

            with SessionLocal() as session:
                set_test_price(session, price)

            if action:
                side, qty = action
                if side == "BUY":
                    resp = client.post("/api/holdings/", json={
                        "ticker": TEST_TICKER, "quantity": qty, "price": price,
                    })
                else:
                    resp = client.post(f"/api/holdings/{TEST_TICKER}/sell", json={
                        "quantity": qty, "price": price,
                    })
                if resp.status_code not in (200, 201):
                    print(f"Row {i}: request failed ({resp.status_code}): {resp.get_json()}")
                    all_passed = False
                    continue

            get_resp = client.get(f"/api/holdings/{TEST_TICKER}")
            if get_resp.status_code != 200:
                print(f"Row {i}: could not fetch holding after action ({get_resp.status_code})")
                all_passed = False
                continue

            data = get_resp.get_json()
            actual = {
                "shares": data["quantity"],
                "avg_cost_per_share": data["avgCostBasis"],
                "unrealized_pl": data["totalGainLoss"],
            }
            with SessionLocal() as session:
                actual["cash_in_hand"] = get_real_cash_balance(session)

            expected = {key: float(row[key]) for key in actual}
            row_passed = all(close_enough(actual[key], expected[key]) for key in actual)
            all_passed = all_passed and row_passed

            label = row["action"].strip() or "(mark-to-market)"
            status = "PASS" if row_passed else "FAIL"
            print(f"Row {i:>2} | price={price:<6} action={label:<10} -> {status}")

            if not row_passed:
                for key in actual:
                    if not close_enough(actual[key], expected[key]):
                        print(f"         {key}: expected {expected[key]}, got {actual[key]}")


    finally:
        with SessionLocal() as session:
            cleanup(session)
            sets_cash_balance(session, original_cash)
        print(f"\n(cleaned up test data, restored real cash balance to {original_cash:.2f})")

    return all_passed


if __name__ == "__main__":
    run()
