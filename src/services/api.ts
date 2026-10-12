import type { AlgorithmName, Board, Difficulty, DifficultyClassification, PuzzleResponse } from '../types';

const baseUrl = '/api';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn('[api]', error);
    return null;
  }
}

export async function fetchPuzzle(difficulty: Difficulty): Promise<PuzzleResponse | null> {
  const data = await fetchJson<PuzzleResponse>(`/puzzle?difficulty=${difficulty}`);
  return data;
}

export async function classifyPuzzle(board: Board): Promise<DifficultyClassification | null> {
  return fetchJson<DifficultyClassification>('/classify', {
    method: 'POST',
    body: JSON.stringify({ board }),
  });
}

export async function solveBoard(board: Board, algorithm: AlgorithmName): Promise<Board | null> {
  const response = await fetchJson<{ board: Board; solved: boolean }>(`/solve`, {
    method: 'POST',
    body: JSON.stringify({ board, algorithm }),
  });
  if (!response || !response.solved) {
    return null;
  }
  return response.board;
}
