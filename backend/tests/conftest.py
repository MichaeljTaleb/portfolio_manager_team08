"""
Shared pytest fixtures for backend tests.

Deliberately does NOT import backend/app.py. Importing app.py triggers two
side effects on the real, unmodified startup code that we don't want during
tests: it starts the live-price background thread (websocket_manager) and it
kicks off the daily automation job immediately, which writes a snapshot row
to whatever database is configured in backend/.env.

Instead, this builds a minimal local Flask app that registers only the
existing holdings_bp blueprint (unmodified, imported directly from
routes/holdings.py), which is enough to exercise the real routes and the
real yfinance calls inside them without any of app.py's startup side effects,
without touching the database, and without mocking anything.
"""
import sys
from pathlib import Path

import pytest
from flask import Flask

# Make sure `backend/` is importable regardless of which directory pytest is
# invoked from (matches how app.py itself imports `routes.holdings`).
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routes.holdings import holdings_bp  # noqa: E402  (import after sys.path setup)


@pytest.fixture
def client():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.register_blueprint(holdings_bp, url_prefix="/api/holdings")
    with test_app.test_client() as test_client:
        yield test_client
