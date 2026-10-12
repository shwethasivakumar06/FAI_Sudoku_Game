export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type AlgorithmName =
  | 'Backtracking'
  | 'MRV Heuristic'
  | 'MRV + Forward Checking'
  | 'Constraint Propagation';

export type Board = number[][];

export interface PuzzleResponse {
  puzzle: Board;
  solution: Board;
  clues: number;
  difficulty: Difficulty;
}

export interface DifficultyClassification {
  difficulty: Difficulty;
  confidence: number;
  probabilities: Record<Difficulty, number>;
  features: {
    clue_count: number;
    average_candidates: number;
    single_candidate_cells: number;
    wide_candidate_cells: number;
  };
  model: string;
  training_data: string;
}

export interface SolverEvent {
  type: string;
  row: number;
  col: number;
  value?: number;
  candidates?: number[];
  explanation: string;
  depth: number;
}

export interface RecentGame {
  id: string;
  difficulty: Difficulty;
  title: string;
  time: number;
  status: 'completed' | 'in-progress';
  date: string;
}
