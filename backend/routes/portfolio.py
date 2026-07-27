from flask import Blueprint, jsonify

from db import get_cursor

portfolio_bp = Blueprint('portfolio', __name__)


@portfolio_bp.route('/summary')
def summary():
    cursor = get_cursor()
    cursor.execute("SELECT * FROM portfolio_history")
    row = cursor.fetchall()
    return jsonify(row)
