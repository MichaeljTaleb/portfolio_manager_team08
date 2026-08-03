import os
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from automation_service import register_automation_routes
from routes.holdings import holdings_bp
from routes.portfolio import portfolio_bp
from routes.quant_advisor import quant_advisor_bp
from websocket_manager import register_websocket_routes

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

app = Flask(__name__)
CORS(app)

app.register_blueprint(holdings_bp, url_prefix='/api/holdings')
app.register_blueprint(portfolio_bp, url_prefix='/api/portfolio')
app.register_blueprint(quant_advisor_bp, url_prefix='/api/quant-advisor')

register_websocket_routes(app)
register_automation_routes(app)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
