from flask import Flask
from flask_cors import CORS

from routes.holdings import holdings_bp
from routes.portfolio import portfolio_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(holdings_bp, url_prefix='/api/holdings')
app.register_blueprint(portfolio_bp, url_prefix='/api/portfolio')

if __name__ == '__main__':
    app.run(debug=True, port=5001)
