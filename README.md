# Vantage: Portfolio Management App

### Team 8 - Katelyn Vo, Michael Taleb, Sasi Vattikuti

Vantage is a full stack portfolio management app for tracking stock holdings, cash balances, and portfolio performance over time with live price updates and an AI assisted quant advisor.


<img width="1470" height="810" alt="Screenshot 2026-08-04 at 5 07 28 AM" src="https://github.com/user-attachments/assets/a525ad0a-0bb5-42d0-a280-77e4454aa20d" />

## Features

- **Dashboard** — total portfolio value with a performance chart (range selection, drag-to-compare), day gain / total return metrics, cash balance, and asset/sector allocation breakdowns.
- **Holdings** — buy and sell stocks (with ticker/company autocomplete backed by live search), track bonds, filter/sort by asset type or sector, and a deep dive into a stock's detail page (price history, analyst recommendations, earnings dates).
- **Cash & Activity** — cash balance with deposit/withdraw and a filterable, paginated transaction history.
- **Quant Advisor** — an AI powered assistant (Gemini) that summarizes portfolio risk/return and answers questions about your holdings.
- **Profile** — edit your display name/email; the avatar initials and dashboard greeting update accordingly.
- **Live prices** — a WebSocket feed streams simulated real time price ticks so daily change and portfolio value update without a page refresh.

## Tech stack

- **Backend**: Python (Flask), SQLAlchemy, MySQL, `flask-sock` (WebSockets), `yfinance` (market data), Google Gemini API (quant advisor)
- **Frontend**: React + TypeScript, Vite, plain CSS 

## Project structure

```
backend/
  app.py                   # Flask app entrypoint, blueprint + websocket registration
  database.py              # SQLAlchemy engine/session setup (reads DATABASE_URL)
  models.py                # ORM models (stocks, user_assets, transactions, portfolio_history)
  seed_data.py             # Seeds the database with sample stocks/holdings
  automation_service.py    # Scheduled daily price sync + portfolio snapshot job
  websocket_manager.py     # Simulated live price feed over WebSocket
  routes/
    holdings.py            # Buy/sell, ticker search, holding detail/performance/analysis
    portfolio.py           # Summary, allocation, cash balance + transfers, performance
    quant_advisor.py       # AI portfolio summary + chat endpoint
frontend/
  src/
    pages/                  # Dashboard, Holdings, Cash, Profile, Quant Advisor, Stock Detail
    components/             # Shared UI (cards, forms, tables, dialogs, charts)
    contexts/               # Live prices (WebSocket) and user profile contexts
    api/client.ts           # Fetch wrappers for all backend endpoints
```
