from flask import Blueprint, jsonify

from db import get_cursor

holdings_bp = Blueprint('holdings', __name__)


@holdings_bp.route('/summary')
def list_holdings():
    cursor = get_cursor()
    cursor.execute("SELECT * FROM user_assets")
    rows = cursor.fetchall()
    return jsonify(rows)
