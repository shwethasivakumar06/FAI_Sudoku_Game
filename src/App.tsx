import { motion } from 'framer-motion';
import {
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Eraser,
  Flame,
  Gauge,
  GitBranch,
  Grid3x3,
  Keyboard,
  NotebookPen,
  Pause,
  Play,
  Redo2,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cloneBoard, difficultyMeta, formatElapsedTime, generatePuzzle, getCandidates, getConflicts, isSameBoard, isValidPlacement } from './lib/sudoku';
import { classifyPuzzle, fetchPuzzle } from './services/api';
import type { Board, Difficulty, DifficultyClassification, RecentGame } from './types';

const STORAGE_KEY = 'sudoku-mind-ai-game';
const RECENT_KEY = 'sudoku-mind-ai-recent';
const defaultBoard = Array.from({ length: 9 }, () => Array(9).fill(0));

interface ImpactCell {
  row: number;
  col: number;
  candidatesBefore: number[];
  candidatesAfter: number[];
  removed: number[];
}

interface MoveImpact {
  row: number;
  col: number;
  value: number;
  valid: boolean;
  affected: ImpactCell[];
}

function getMoveImpact(boardBeforeMove: Board, row: number, col: number, value: number): MoveImpact {
  const candidateBoard = cloneBoard(boardBeforeMove);
  candidateBoard[row][col] = 0;
  const boardAfterMove = cloneBoard(candidateBoard);
  boardAfterMove[row][col] = value;
  const affected: ImpactCell[] = [];

  for (let targetRow = 0; targetRow < 9; targetRow += 1) {
    for (let targetCol = 0; targetCol < 9; targetCol += 1) {
      if (boardAfterMove[targetRow][targetCol] !== 0) continue;
      const sharesConstraint =
        targetRow === row ||
        targetCol === col ||
        (Math.floor(targetRow / 3) === Math.floor(row / 3) &&
          Math.floor(targetCol / 3) === Math.floor(col / 3));
      if (!sharesConstraint) continue;

      const candidatesBefore = getCandidates(candidateBoard, targetRow, targetCol);
      const candidatesAfter = getCandidates(boardAfterMove, targetRow, targetCol);
      const removed = candidatesBefore.filter((candidate) => !candidatesAfter.includes(candidate));
      if (removed.length > 0) {
        affected.push({ row: targetRow, col: targetCol, candidatesBefore, candidatesAfter, removed });
      }
    }
  }

  return {
    row,
    col,
    value,
    valid: isValidPlacement(boardAfterMove, row, col, value),
    affected,
  };
}

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<Board>(defaultBoard);
  const [originalBoard, setOriginalBoard] = useState<Board>(defaultBoard);
  const [notes, setNotes] = useState<Record<string, number[]>>({});
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<'playing' | 'paused' | 'won'>('playing');
  const [timer, setTimer] = useState(0);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [mlClassification, setMlClassification] = useState<DifficultyClassification | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState('');
  const [moveImpact, setMoveImpact] = useState<MoveImpact | null>(null);
  const [history, setHistory] = useState<Board[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const impactMapRef = useRef<HTMLDivElement | null>(null);

  const formatter = useMemo(() => ({
    avgTime: '14:32',
    streak: 6,
    solved: 28,
    best: '08:43',
  }), []);

  const completion = useMemo(() => {
    const filled = board.flat().filter((value) => value !== 0).length;
    return Math.round((filled / 81) * 100);
  }, [board]);

  const conflicts = useMemo(() => getConflicts(board), [board]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedRecent = localStorage.getItem(RECENT_KEY);
    if (storedRecent) {
      setRecentGames(JSON.parse(storedRecent));
    }
    if (!stored) {
      void startNewGame('medium');
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        board: Board;
        originalBoard: Board;
        difficulty: Difficulty;
        notes: Record<string, number[]>;
        mistakes: number;
        timer: number;
        status: 'playing' | 'paused' | 'won';
        selectedCell: { row: number; col: number } | null;
      };
      setBoard(parsed.board);
      setOriginalBoard(parsed.originalBoard);
      setDifficulty(parsed.difficulty);
      setNotes(parsed.notes ?? {});
      setMistakes(parsed.mistakes ?? 0);
      setTimer(parsed.timer ?? 0);
      setStatus(parsed.status ?? 'playing');
      setSelectedCell(parsed.selectedCell ?? null);
    } catch { void startNewGame('medium'); }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isPaused && status !== 'won') setTimer((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPaused, status]);

  useEffect(() => {
    if (status === 'won') return;
    const stateToStore = {
      board,
      originalBoard,
      difficulty,
      notes,
      mistakes,
      timer,
      status,
      selectedCell,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToStore));
  }, [board, difficulty, isPaused, mistakes, notes, originalBoard, selectedCell, status, timer]);

  useEffect(() => {
    if (board.flat().every((value) => value !== 0) && isSameBoard(board, originalBoard) === false) {
      setStatus('won');
      const nextEntry: RecentGame = {
        id: Date.now().toString(),
        difficulty,
        title: `Puzzle cleared • ${difficultyMeta[difficulty].label}`,
        time: timer,
        status: 'completed',
        date: new Date().toLocaleDateString(),
      };
      setRecentGames((current) => [nextEntry, ...current].slice(0, 4));
      localStorage.setItem(RECENT_KEY, JSON.stringify([nextEntry, ...recentGames].slice(0, 4)));
    }
  }, [board, difficulty, originalBoard, recentGames, timer]);

  useEffect(() => {
    if (selectedCell) {
      const next = getCandidates(board, selectedCell.row, selectedCell.col);
      if (next.length > 0) {
        boardRef.current?.focus();
      }
    }
  }, [selectedCell, board]);

  const startNewGame = async (nextDifficulty: Difficulty) => {
    setStatus('playing');
    setIsPaused(false);
    setTimer(0);
    setMistakes(0);
    setNotes({});
    setSelectedCell(null);
    setMoveImpact(null);
    setMlClassification(null);
    setClassificationError('');
    setHistory([]);
    setHistoryIndex(-1);

    const remote = await fetchPuzzle(nextDifficulty);
    const puzzleSource = remote ?? generatePuzzle(nextDifficulty);
    setBoard(cloneBoard(puzzleSource.puzzle));
    setOriginalBoard(cloneBoard(puzzleSource.puzzle));
    setDifficulty(nextDifficulty);
  };

  const pushHistory = (nextBoard: Board) => {
    setHistory((current) => {
      const trimmed = current.slice(0, historyIndex + 1);
      const snapshot = cloneBoard(nextBoard);
      const last = trimmed[trimmed.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(snapshot)) {
        return current;
      }
      return [...trimmed, snapshot];
    });
    setHistoryIndex((current) => current + 1);
  };

  const applyBoardChange = (nextBoard: Board) => {
    setBoard(nextBoard);
    pushHistory(nextBoard);
  };

  const handleCellSelection = (row: number, col: number) => {
    setSelectedCell({ row, col });
  };

  const handleValueInput = (value: number) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    if (originalBoard[row][col] !== 0) return;

    const nextBoard = cloneBoard(board);
    if (notesMode) {
      const key = `${row}-${col}`;
      const currentList = notes[key] ?? [];
      const updated = currentList.includes(value)
        ? currentList.filter((item) => item !== value)
        : [...currentList, value].sort((a, b) => a - b);
      setNotes((previous) => ({ ...previous, [key]: updated }));
      return;
    }

    setMoveImpact(getMoveImpact(board, row, col, value));
    nextBoard[row][col] = value;
    if (value !== 0 && !isValidPlacement(nextBoard, row, col, value)) {
      setMistakes((current) => current + 1);
    }
    applyBoardChange(nextBoard);
  };

  const handleErase = () => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    if (originalBoard[row][col] !== 0) return;
    const nextBoard = cloneBoard(board);
    nextBoard[row][col] = 0;
    setMoveImpact(null);
    const key = `${row}-${col}`;
    setNotes((previous) => ({ ...previous, [key]: [] }));
    applyBoardChange(nextBoard);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const previous = history[historyIndex - 1];
    setHistoryIndex((current) => current - 1);
    setBoard(cloneBoard(previous));
    setMoveImpact(null);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setHistoryIndex((current) => current + 1);
    setBoard(cloneBoard(next));
    setMoveImpact(null);
  };

  const handleKeyInput = (event: ReactKeyboardEvent) => {
    if (!selectedCell) return;
    const key = event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const nextCell = { ...selectedCell };
      if (key === 'ArrowUp') nextCell.row = Math.max(0, selectedCell.row - 1);
      if (key === 'ArrowDown') nextCell.row = Math.min(8, selectedCell.row + 1);
      if (key === 'ArrowLeft') nextCell.col = Math.max(0, selectedCell.col - 1);
      if (key === 'ArrowRight') nextCell.col = Math.min(8, selectedCell.col + 1);
      setSelectedCell(nextCell);
      return;
    }

    if (/^[1-9]$/.test(key)) {
      handleValueInput(Number(key));
    }
    if (key === 'Backspace' || key === 'Delete' || key === '0') {
      handleErase();
    }
  };

  const resetBoard = () => {
    setBoard(cloneBoard(originalBoard));
    setNotes({});
    setMistakes(0);
    setStatus('playing');
    setIsPaused(false);
    setMoveImpact(null);
  };

  const classifyCurrentPuzzle = async () => {
    setIsClassifying(true);
    setClassificationError('');
    try {
      const result = await classifyPuzzle(originalBoard);
      if (!result) {
        setClassificationError('The ML service did not return a prediction. Check that the Flask backend is running.');
        return;
      }
      setMlClassification(result);
    } catch (error) {
      console.error('Unable to classify puzzle difficulty', error);
      setClassificationError('Could not classify this puzzle. Check the backend connection and try again.');
    } finally {
      setIsClassifying(false);
    }
  };

  const chartData = [
    { name: 'Completed', value: 28 },
    { name: 'Streak', value: 6 },
    { name: 'Avg', value: 14 },
    { name: 'Best', value: 8 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 antialiased">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-glow backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
              <Grid3x3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/80">SudokuMind AI</p>
              <h1 className="text-lg font-semibold text-white">AI-powered puzzle intelligence</h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button className="rounded-full border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">Dashboard</button>
            <button className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">Visualizer</button>
          </div>
        </header>

        <main className="space-y-8">
          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-slate-900 to-slate-900 p-6 shadow-glow"
            >
              <div className="mb-5 flex items-center gap-2 text-sm text-indigo-200">
                <Sparkles className="h-4 w-4" />
                Interactive learning puzzle studio
              </div>
              <h2 className="max-w-xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                Don&apos;t Just Solve Sudoku. Understand How AI Thinks.
              </h2>
              <p className="mt-4 max-w-xl text-base text-slate-300">
                Explore backtracking, constraint propagation, and heuristic search through a premium Sudoku experience built for learners and puzzle enthusiasts.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => void startNewGame(difficulty)}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:scale-[1.02]"
                >
                  Start Playing
                </button>
                <button
                  onClick={() => impactMapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Explore Move Map
                </button>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Puzzles Completed', value: formatter.solved, icon: Trophy },
                  { label: 'Avg Solving Time', value: formatter.avgTime, icon: Clock3 },
                  { label: 'Current Streak', value: `${formatter.streak} days`, icon: Flame },
                  { label: 'Best Time', value: formatter.best, icon: Target },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-200">Daily challenge</p>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Live
                </span>
              </div>
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Challenge ID</p>
                <p className="mt-3 text-3xl font-bold text-white">#184</p>
                <p className="mt-2 text-sm text-slate-300">Medium • 36 clues • Completion 62%</p>
              </div>
              <div className="space-y-3">
                {[{ label: 'Difficulty', value: difficultyMeta[difficulty].label }, { label: 'Clues', value: `${originalBoard.flat().filter(Boolean).length}` }, { label: 'Status', value: status === 'won' ? 'Solved' : 'Live' }].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Game board</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Puzzle arena</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  <Gauge className="h-4 w-4 text-cyan-300" />
                  {completion}% complete
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => void startNewGame(level)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      difficulty === level
                        ? 'bg-gradient-to-r from-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-500/20'
                        : 'border border-white/10 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {difficultyMeta[level].label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                <button onClick={handleUndo} className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-200"><Undo2 className="h-4 w-4" /></button>
                <button onClick={handleRedo} className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-200"><Redo2 className="h-4 w-4" /></button>
                <button onClick={() => setNotesMode((current) => !current)} className={`rounded-xl px-3 py-2 text-sm font-medium ${notesMode ? 'bg-cyan-500/15 text-cyan-200' : 'bg-slate-900 text-slate-200'} border border-white/10`}>
                  {notesMode ? 'Notes On' : 'Notes Off'}
                </button>
                <button onClick={handleErase} className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-200"><Eraser className="h-4 w-4" /></button>
                <button onClick={resetBoard} className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-200"><RefreshCw className="h-4 w-4" /></button>
                <button onClick={() => setIsPaused((current) => !current)} className="ml-auto rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-sm font-medium text-white">
                  {isPaused ? <><Play className="mr-2 inline h-4 w-4" />Resume</> : <><Pause className="mr-2 inline h-4 w-4" />Pause</>}
                </button>
              </div>

              <div
                ref={boardRef}
                onKeyDown={handleKeyInput}
                tabIndex={0}
                className="mt-6 grid aspect-square w-full max-w-[560px] grid-cols-9 gap-0 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-indigo-950/30 outline-none"
              >
                {board.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const key = `${rowIndex}-${colIndex}`;
                    const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                    const isSameNumber = value !== 0 && selectedCell && board[selectedCell.row][selectedCell.col] !== 0 && board[selectedCell.row][selectedCell.col] === value && !(selectedCell.row === rowIndex && selectedCell.col === colIndex);
                    const sameRowColumn = selectedCell && (selectedCell.row === rowIndex || selectedCell.col === colIndex);
                    const isConflict = conflicts.has(key);
                    const isFixed = originalBoard[rowIndex][colIndex] !== 0;
                    const noteValues = notes[key] ?? [];
                    const cellClasses = [
                      'relative flex aspect-square items-center justify-center border border-slate-700 text-lg font-semibold transition-all duration-150 select-none',
                      value === 0 ? 'text-slate-200' : isFixed ? 'text-cyan-100' : 'text-violet-200',
                      isSelected ? 'bg-indigo-500/25 ring-2 ring-cyan-300 ring-inset' : '',
                      isSameNumber ? 'bg-violet-500/15' : '',
                      sameRowColumn && !isSelected ? 'bg-slate-800/80' : '',
                      isConflict ? 'bg-rose-500/25 text-red-200' : '',
                    ].join(' ');

                    return (
                      <button
                        key={key}
                        onClick={() => handleCellSelection(rowIndex, colIndex)}
                        className={cellClasses}
                        aria-label={`Cell ${rowIndex + 1} ${colIndex + 1}`}
                      >
                        {value !== 0 ? (
                          <span className="z-10">{value}</span>
                        ) : noteValues.length > 0 ? (
                          <div className="grid grid-cols-3 gap-0.5 text-[10px] font-medium text-slate-300">
                            {Array.from({ length: 9 }, (_, i) => i + 1).map((noteValue) => (
                              <span key={noteValue} className={noteValues.includes(noteValue) ? 'block' : 'invisible'}>{noteValue}</span>
                            ))}
                          </div>
                        ) : null}
                        {rowIndex % 3 === 2 && rowIndex !== 8 ? <span className="absolute bottom-[-1px] right-[-1px] h-0.5 w-full bg-slate-700" /> : null}
                        {colIndex % 3 === 2 && colIndex !== 8 ? <span className="absolute bottom-[-1px] right-[-1px] h-full w-0.5 bg-slate-700" /> : null}
                      </button>
                    );
                  }),
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleValueInput(digit)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950 text-lg font-semibold text-white shadow-sm shadow-slate-900 transition hover:border-indigo-400/50 hover:bg-slate-800"
                  >
                    {digit}
                  </button>
                ))}
                <button onClick={handleErase} className="ml-2 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950 text-sm font-semibold text-slate-200">
                  Clear
                </button>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Session</p>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-200">{status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Timer</p>
                    <p className="mt-2 text-2xl font-bold text-white">{formatElapsedTime(timer)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mistakes</p>
                    <p className="mt-2 text-2xl font-bold text-white">{mistakes}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Progress</p>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400" style={{ width: `${completion}%` }} />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">ML difficulty classifier</p>
                  <BrainCircuit className="h-4 w-4 text-violet-300" />
                </div>
                <p className="mb-3 text-sm leading-relaxed text-slate-300">
                  A Gaussian Naive Bayes model estimates puzzle difficulty from clue and candidate patterns.
                </p>
                <button
                  onClick={() => void classifyCurrentPuzzle()}
                  disabled={isClassifying || originalBoard.flat().every((value) => value === 0)}
                  className="w-full rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClassifying ? 'Classifying puzzle…' : 'Predict difficulty'}
                </button>
                {classificationError && <p role="alert" className="mt-3 text-sm text-rose-300">{classificationError}</p>}
                {mlClassification && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-400">Predicted level</p>
                        <p className="mt-1 text-xl font-bold capitalize text-white">{mlClassification.difficulty}</p>
                      </div>
                      <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-200">
                        {(mlClassification.confidence * 100).toFixed(1)}% model confidence
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((level) => (
                        <div key={level} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                          <span className="capitalize text-slate-400">{level}</span>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${mlClassification.probabilities[level] * 100}%` }} />
                          </div>
                          <span className="text-right text-slate-300">{(mlClassification.probabilities[level] * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Educational demo trained on synthetic feature profiles. Confidence is not calibrated against a real puzzle corpus.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Solver model</p>
                  <GitBranch className="h-4 w-4 text-violet-300" />
                </div>
                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4">
                  <p className="font-semibold text-violet-100">Recursive backtracking</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    The solver tries a legal candidate, explores the resulting board, and backtracks if it reaches a contradiction. The move map below shows the immediate rule-based impact of your own entries.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <p className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Metric pulse</p>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#7c3aed" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </aside>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div ref={impactMapRef} className="min-w-0 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Move impact map</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">See how a placement changes the board</h3>
                </div>
                <GitBranch className="h-5 w-5 shrink-0 text-cyan-300" />
              </div>

              {!moveImpact ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center">
                  <Grid3x3 className="mb-3 h-8 w-8 text-cyan-300/70" />
                  <p className="font-medium text-slate-200">Make a move to build the map</p>
                  <p className="mt-2 max-w-sm text-sm text-slate-400">
                    Select an empty cell and enter a number. The map will connect it to peer cells where that number is removed from the candidates.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="text-sm text-slate-200">
                      Placed <span className="font-bold text-cyan-200">{moveImpact.value}</span> at{' '}
                      <span className="font-semibold text-white">R{moveImpact.row + 1}, C{moveImpact.col + 1}</span>
                    </p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${moveImpact.valid ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
                      {moveImpact.valid ? 'Valid placement' : 'Conflicts with a rule'}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <div>
                      <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1">
                        <svg className="pointer-events-none absolute inset-1 z-10 h-[calc(100%-8px)] w-[calc(100%-8px)]" viewBox="0 0 900 900" preserveAspectRatio="none" aria-hidden="true">
                          {moveImpact.affected.map((cell) => (
                            <line
                              key={`edge-${cell.row}-${cell.col}`}
                              x1={(moveImpact.col + 0.5) * 100}
                              y1={(moveImpact.row + 0.5) * 100}
                              x2={(cell.col + 0.5) * 100}
                              y2={(cell.row + 0.5) * 100}
                              stroke="rgba(34, 211, 238, 0.68)"
                              strokeWidth="5"
                              strokeDasharray="12 12"
                            />
                          ))}
                        </svg>
                        <div className="relative z-20 grid h-full grid-cols-9 grid-rows-9">
                          {board.map((row, rowIndex) =>
                            row.map((cellValue, colIndex) => {
                              const isOrigin = moveImpact.row === rowIndex && moveImpact.col === colIndex;
                              const isAffected = moveImpact.affected.some((cell) => cell.row === rowIndex && cell.col === colIndex);
                              const isBoxBorder = (rowIndex % 3 === 2 && rowIndex !== 8) || (colIndex % 3 === 2 && colIndex !== 8);
                              return (
                                <div
                                  key={`map-${rowIndex}-${colIndex}`}
                                  className={`relative flex items-center justify-center border border-slate-800 text-[10px] font-semibold sm:text-xs ${
                                    isOrigin ? 'z-30 rounded-sm bg-violet-500 text-white ring-2 ring-violet-200' :
                                    isAffected ? 'rounded-sm bg-cyan-400/25 text-cyan-100 ring-1 ring-cyan-300/70' :
                                    cellValue ? 'text-slate-500' : 'text-slate-700'
                                  } ${isBoxBorder && !isOrigin && !isAffected ? 'border-slate-600' : ''}`}
                                  title={isOrigin ? `Placed ${moveImpact.value}` : isAffected ? `Candidate ${moveImpact.value} removed` : undefined}
                                >
                                  {cellValue || ''}
                                </div>
                              );
                            }),
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />Placed value</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-400/60" />Candidate removed</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-cyan-300" />Constraint link</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <p className="text-xs text-slate-400">Peer cells affected</p>
                          <p className="mt-1 text-2xl font-bold text-cyan-200">{moveImpact.affected.length}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <p className="text-xs text-slate-400">Candidates removed</p>
                          <p className="mt-1 text-2xl font-bold text-violet-200">{moveImpact.affected.reduce((total, cell) => total + cell.removed.length, 0)}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Candidate changes</p>
                        {moveImpact.affected.length === 0 ? (
                          <p className="text-sm text-slate-400">No empty peer cell had this number as a candidate.</p>
                        ) : (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {moveImpact.affected.map((cell) => (
                              <div key={`impact-${cell.row}-${cell.col}`} className="flex items-start justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-xs">
                                <span className="shrink-0 font-medium text-slate-300">R{cell.row + 1}, C{cell.col + 1}</span>
                                <span className="text-right text-slate-400">
                                  {'{'}{cell.candidatesBefore.join(', ')}{'}'} <span className="text-cyan-300">→</span> {'{'}{cell.candidatesAfter.join(', ') || 'none'}{'}'}
                                  <span className="ml-1 text-cyan-200">−{cell.removed.join(', ')}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">
                        Each link marks an empty cell in the same row, column, or 3×3 box. Its candidate set is recalculated after the placement.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Recent games</p>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="space-y-3">
                {recentGames.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                    Your most recent puzzles will appear here.
                  </div>
                ) : (
                  recentGames.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                      <div>
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="text-xs text-slate-400">{item.date} • {difficultyMeta[item.difficulty].label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-cyan-200">{formatElapsedTime(item.time)}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.status}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Platform features</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Built for understanding, not just speed</h3>
              </div>
              <div className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">Premium AI classroom</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: 'Logic-first progression', desc: 'Move from obvious singles to search-heavy solving with human-friendly explanations.', icon: NotebookPen },
                { title: 'Interactive visualization', desc: 'Watch candidates, contradictions, and search branches unfold as the algorithm decides.', icon: Keyboard },
                { title: 'Puzzle validation', desc: 'Every generated grid is checked for a unique valid solution before it reaches the board.', icon: CheckCircle2 },
              ].map(({ title, desc, icon: Icon }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">{title}</h4>
                  <p className="mt-2 text-sm text-slate-300">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
