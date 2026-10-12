from __future__ import annotations

import random
from typing import List, Optional, Tuple

Board = List[List[int]]


def clone_board(board: Board) -> Board:
    return [row[:] for row in board]


def is_valid_placement(board: Board, row: int, col: int, value: int) -> bool:
    for idx in range(9):
        if board[row][idx] == value and idx != col:
            return False
        if board[idx][col] == value and idx != row:
            return False

    box_row = (row // 3) * 3
    box_col = (col // 3) * 3
    for r in range(box_row, box_row + 3):
        for c in range(box_col, box_col + 3):
            if board[r][c] == value and (r != row or c != col):
                return False
    return True


def find_empty(board: Board) -> Optional[Tuple[int, int]]:
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                return r, c
    return None


def candidates(board: Board, row: int, col: int) -> List[int]:
    if board[row][col] != 0:
        return []
    items = []
    for num in range(1, 10):
        if is_valid_placement(board, row, col, num):
            items.append(num)
    return items


def solve_basic(board: Board) -> Tuple[bool, Board]:
    if solve_recursive(board):
        return True, board
    return False, board


def solve_recursive(board: Board) -> bool:
    empty = find_empty(board)
    if not empty:
        return True
    row, col = empty
    for value in range(1, 10):
        if is_valid_placement(board, row, col, value):
            board[row][col] = value
            if solve_recursive(board):
                return True
            board[row][col] = 0
    return False


def count_solutions(board: Board, limit: int = 2) -> int:
    empty = find_empty(board)
    if not empty:
        return 1

    row, col = empty
    total = 0
    for value in range(1, 10):
        if is_valid_placement(board, row, col, value):
            board[row][col] = value
            total += count_solutions(board, limit - total if limit > 0 else 0)
            board[row][col] = 0
            if total >= limit:
                break
    return total


def generate_solved_board() -> Board:
    board = [[0 for _ in range(9)] for _ in range(9)]

    def fill_board() -> bool:
        empty = find_empty(board)
        if not empty:
            return True
        row, col = empty
        values = list(range(1, 10))
        random.shuffle(values)
        for value in values:
            if is_valid_placement(board, row, col, value):
                board[row][col] = value
                if fill_board():
                    return True
                board[row][col] = 0
        return False

    fill_board()
    return board


def generate_puzzle(difficulty: str) -> dict:
    target_clues = {
        'easy': 45,
        'medium': 36,
        'hard': 30,
        'expert': 24,
    }
    clue_target = target_clues.get(difficulty, 36)
    solved = generate_solved_board()
    puzzle = clone_board(solved)
    positions = list(range(81))
    random.shuffle(positions)

    for index in positions:
        if sum(1 for row in puzzle for cell in row if cell != 0) <= clue_target:
            break
        row = index // 9
        col = index % 9
        current = puzzle[row][col]
        puzzle[row][col] = 0
        if count_solutions(puzzle, 2) != 1:
            puzzle[row][col] = current

    return {
        'puzzle': puzzle,
        'solution': solved,
        'clues': sum(1 for row in puzzle for cell in row if cell != 0),
        'difficulty': difficulty,
    }
