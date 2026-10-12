import type { AlgorithmName, Board, Difficulty, SolverEvent } from '../types';

export const BOARD_SIZE = 9;
export const EMPTY = 0;

export const difficultyMeta: Record<Difficulty, { label: string; clues: number; accent: string }> = {
  easy: { label: 'Easy', clues: 45, accent: 'emerald' },
  medium: { label: 'Medium', clues: 36, accent: 'sky' },
  hard: { label: 'Hard', clues: 30, accent: 'amber' },
  expert: { label: 'Expert', clues: 24, accent: 'rose' },
};

export const algorithmLabels: AlgorithmName[] = [
  'Backtracking',
  'MRV Heuristic',
  'MRV + Forward Checking',
  'Constraint Propagation',
];

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function createEmptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function isValidPlacement(board: Board, row: number, col: number, value: number): boolean {
  for (let idx = 0; idx < 9; idx += 1) {
    if (idx !== col && board[row][idx] === value) return false;
    if (idx !== row && board[idx][col] === value) return false;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if ((r !== row || c !== col) && board[r][c] === value) return false;
    }
  }

  return true;
}

export function getCandidates(board: Board, row: number, col: number): number[] {
  if (board[row][col] !== 0) return [];
  const values: number[] = [];
  for (let value = 1; value <= 9; value += 1) {
    if (isValidPlacement(board, row, col, value)) values.push(value);
  }
  return values;
}

export function findEmptyCell(board: Board): [number, number] | null {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (board[row][col] === 0) return [row, col];
    }
  }
  return null;
}

export function isBoardComplete(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let index = arr.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [arr[index], arr[randomIndex]] = [arr[randomIndex], arr[index]];
  }
  return arr;
}

function countSolutions(board: Board, limit = 2): number {
  const empty = findEmptyCell(board);
  if (!empty) return 1;

  const [row, col] = empty;
  let solutions = 0;

  for (let value = 1; value <= 9; value += 1) {
    if (!isValidPlacement(board, row, col, value)) continue;
    board[row][col] = value;
    solutions += countSolutions(board, limit - solutions);
    board[row][col] = 0;
    if (solutions >= limit) return solutions;
  }

  return solutions;
}

export function generateSolvedBoard(): Board {
  const board = createEmptyBoard();

  const fillBoard = (): boolean => {
    const empty = findEmptyCell(board);
    if (!empty) return true;

    const [row, col] = empty;
    for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!isValidPlacement(board, row, col, value)) continue;
      board[row][col] = value;
      if (fillBoard()) return true;
      board[row][col] = 0;
    }
    return false;
  };

  fillBoard();
  return board;
}

export function generatePuzzle(difficulty: Difficulty): { puzzle: Board; solution: Board; clues: number } {
  const solution = generateSolvedBoard();
  const puzzle = cloneBoard(solution);
  const clueTarget = difficultyMeta[difficulty].clues;
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));

  for (const index of positions) {
    if (countNonZeroCells(puzzle) <= clueTarget) break;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const previous = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[row][col] = previous;
    }
  }

  return {
    puzzle,
    solution,
    clues: countNonZeroCells(puzzle),
  };
}

export function countNonZeroCells(board: Board): number {
  return board.reduce((count, row) => count + row.filter((cell) => cell !== 0).length, 0);
}

export function getBoardHash(board: Board): string {
  return board.flat().join('');
}

export function isSameBoard(a: Board, b: Board): boolean {
  return a.every((row, rowIndex) => row.every((value, colIndex) => value === b[rowIndex][colIndex]));
}

export function getConflicts(board: Board): Set<string> {
  const conflictSet = new Set<string>();

  for (let row = 0; row < 9; row += 1) {
    const seen = new Map<number, number[]>();
    for (let col = 0; col < 9; col += 1) {
      const value = board[row][col];
      if (!value) continue;
      const positions = seen.get(value) ?? [];
      positions.push(col);
      seen.set(value, positions);
    }
    seen.forEach((positions) => {
      if (positions.length > 1) {
        positions.forEach((col) => conflictSet.add(`${row}-${col}`));
      }
    });
  }

  for (let col = 0; col < 9; col += 1) {
    const seen = new Map<number, number[]>();
    for (let row = 0; row < 9; row += 1) {
      const value = board[row][col];
      if (!value) continue;
      const positions = seen.get(value) ?? [];
      positions.push(row);
      seen.set(value, positions);
    }
    seen.forEach((positions) => {
      if (positions.length > 1) {
        positions.forEach((row) => conflictSet.add(`${row}-${col}`));
      }
    });
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const seen = new Map<number, { row: number; col: number }[]>();
      for (let row = boxRow * 3; row < boxRow * 3 + 3; row += 1) {
        for (let col = boxCol * 3; col < boxCol * 3 + 3; col += 1) {
          const value = board[row][col];
          if (!value) continue;
          const positions = seen.get(value) ?? [];
          positions.push({ row, col });
          seen.set(value, positions);
        }
      }
      seen.forEach((positions) => {
        if (positions.length > 1) {
          positions.forEach(({ row, col }) => conflictSet.add(`${row}-${col}`));
        }
      });
    }
  }

  return conflictSet;
}

export function solveForVisualization(board: Board, algorithm: AlgorithmName): { solution: Board; events: SolverEvent[] } {
  const events: SolverEvent[] = [];
  const working = cloneBoard(board);

  const backtrack = (current: Board, depth: number): boolean => {
    const empty = findEmptyCell(current);
    if (!empty) {
      events.push({
        type: 'SOLUTION_FOUND',
        row: -1,
        col: -1,
        explanation: 'Board is complete and satisfies Sudoku constraints.',
        depth,
      });
      return true;
    }

    const [row, col] = empty;
    const candidates = getCandidates(current, row, col);
    events.push({
      type: 'COMPUTE_CANDIDATES',
      row,
      col,
      candidates,
      explanation: `Evaluating options for row ${row + 1}, col ${col + 1}.`,
      depth,
    });

    for (const value of candidates) {
      events.push({
        type: algorithm === 'Backtracking' ? 'TRY_VALUE' : 'VALID_ASSIGNMENT',
        row,
        col,
        value,
        explanation: `Testing ${value} in row ${row + 1}, column ${col + 1}.`,
        depth,
      });

      current[row][col] = value;
      if (backtrack(current, depth + 1)) {
        return true;
      }
      current[row][col] = 0;
      events.push({
        type: 'BACKTRACK',
        row,
        col,
        value,
        explanation: `Backtracking from ${value} after contradiction.`,
        depth,
      });
    }

    return false;
  };

  return {
    solution: backtrack(working, 0) ? working : cloneBoard(board),
    events,
  };
}

export function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
