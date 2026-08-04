"""
Integration tests that exercise the real yfinance / Yahoo Finance API through
the app's existing, unmodified routes in routes/holdings.py.

No mocking, no test database, no changes to any project code. These hit the
live external API exactly the way the running app does, through Flask's
test client (see conftest.py).

Tradeoffs that come with that choice, worth knowing before you run these:
  - Requires network access and a working Yahoo Finance response to pass.
  - Slower than mocked unit tests (real HTTP calls under the hood).
  - Can be flaky: Yahoo's undocumented rate limits (see the earlier
    discussion on YFRateLimitError / HTTP 429) mean occasional failures
    aren't necessarily a real regression — rerun before assuming a bug.
  - Assertions are intentionally loose (types, ranges, non-empty) rather than
    exact values, since real market data changes every time these run.

Run from the backend/ directory with:  pytest
"""
import pytest

# A large, heavily-traded, always-listed stock — picked to minimize flakiness
# from "no data available" on days/times with thin coverage.
KNOWN_TICKER = "AAPL"
BOGUS_TICKER = "THISISNOTAREALTICKERXYZ"


# ---------------------------------------------------------------------------
# GET /api/holdings/search
# ---------------------------------------------------------------------------

def test_search_symbols_finds_known_company(client):
    response = client.get("/api/holdings/search?q=Apple")
    assert response.status_code == 200

    results = response.get_json()
    assert isinstance(results, list)
    assert any(r["symbol"] == KNOWN_TICKER for r in results)
    # every result should have both fields the frontend relies on
    assert all({"symbol", "name"}.issubset(r.keys()) for r in results)


def test_search_symbols_empty_query_short_circuits(client):
    # The route returns [] before ever calling yfinance for an empty query —
    # this should be instant and never touch the network.
    response = client.get("/api/holdings/search?q=")
    assert response.status_code == 200
    assert response.get_json() == []


# ---------------------------------------------------------------------------
# GET /api/holdings/quote/<ticker>
# ---------------------------------------------------------------------------

def test_get_quote_returns_live_price_fields(client):
    response = client.get(f"/api/holdings/quote/{KNOWN_TICKER}")
    assert response.status_code == 200

    data = response.get_json()
    assert data["symbol"] == KNOWN_TICKER
    assert isinstance(data["name"], str) and data["name"]
    assert isinstance(data["price"], (int, float)) and data["price"] > 0
    assert isinstance(data["previousClose"], (int, float)) and data["previousClose"] > 0
    # sanity range check — catches unit/scale bugs (e.g. cents vs dollars)
    # without pinning to an exact price that will drift day to day.
    assert 1 < data["price"] < 100_000


def test_get_quote_unknown_ticker_returns_404(client):
    response = client.get(f"/api/holdings/quote/{BOGUS_TICKER}")
    assert response.status_code == 404
    assert "error" in response.get_json()


# ---------------------------------------------------------------------------
# GET /api/holdings/<ticker>/performance
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("range_param", ["1d", "1w", "1m", "1y"])
def test_holding_performance_returns_price_series(client, range_param):
    response = client.get(f"/api/holdings/{KNOWN_TICKER}/performance?range={range_param}")
    assert response.status_code == 200

    data = response.get_json()
    assert data["values"], f"expected non-empty price history for range={range_param}"
    assert len(data["values"]) == len(data["axis"])
    assert all(isinstance(v, (int, float)) and v > 0 for v in data["values"])
    assert data["label"] == range_param.upper()


def test_holding_performance_unknown_range_falls_back_to_1mo(client):
    # holding_performance() maps any unrecognized range to the 1mo/1d default
    # rather than erroring — this locks in that fallback behavior.
    response = client.get(f"/api/holdings/{KNOWN_TICKER}/performance?range=not-a-real-range")
    assert response.status_code == 200
    data = response.get_json()
    assert data["values"]


# ---------------------------------------------------------------------------
# GET /api/holdings/<ticker>/analysis
# ---------------------------------------------------------------------------

def test_holding_analysis_returns_expected_shape(client):
    response = client.get(f"/api/holdings/{KNOWN_TICKER}/analysis")
    assert response.status_code == 200

    data = response.get_json()
    expected_keys = {
        "earningsDate", "recommendation", "recommendationMean",
        "numberOfAnalysts", "targetMeanPrice", "targetHighPrice", "targetLowPrice",
    }
    assert expected_keys.issubset(data.keys())

    # AAPL is one of the most heavily-covered stocks on the market, so real
    # analyst data should be present — this would have caught the earlier
    # "wrong previous_close field" class of bug if it had touched this route.
    assert data["numberOfAnalysts"] is not None and data["numberOfAnalysts"] > 0
    assert data["targetMeanPrice"] is not None and data["targetMeanPrice"] > 0


def test_holding_analysis_unknown_ticker_degrades_gracefully(client):
    # Every field is explicitly best-effort in the route (each wrapped in its
    # own try/except) — a bogus ticker should come back 200 with nulls, not
    # a 500. This is the behavior that keeps the stock detail page from
    # breaking on a symbol with sparse Yahoo coverage.
    response = client.get(f"/api/holdings/{BOGUS_TICKER}/analysis")
    assert response.status_code == 200
    data = response.get_json()
    assert data["recommendation"] is None
    assert data["earningsDate"] is None
