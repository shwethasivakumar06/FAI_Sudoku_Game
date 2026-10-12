from flask import Flask, jsonify, request

from ml_difficulty import classify_puzzle, is_valid_board_shape
from solver import generate_puzzle, solve_basic

app = Flask(__name__)


@app.get('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.get('/api/puzzle')
def puzzle():
    difficulty = request.args.get('difficulty', 'medium')
    data = generate_puzzle(difficulty)
    return jsonify(data)


@app.post('/api/solve')
def solve():
    payload = request.get_json(force=True, silent=True) or {}
    board = payload.get('board', [])
    solved = solve_basic(board)
    return jsonify({'solved': solved[0], 'board': solved[1]})


@app.post('/api/classify')
def classify():
    payload = request.get_json(silent=True) or {}
    board = payload.get('board')
    if not is_valid_board_shape(board):
        return jsonify({'error': 'board must be a 9×9 grid of integers from 0 to 9'}), 400
    return jsonify(classify_puzzle(board))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
