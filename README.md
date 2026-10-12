# SudokuMind AI

**Play Sudoku, explore how constraints shape a puzzle, and see an ML model estimate its difficulty.**

SudokuMind AI is a browser-based Sudoku game with a React and TypeScript frontend and a Python/Flask API. It combines a playable 9×9 board, recursive backtracking puzzle logic, a visual map of the effects of a move, and an educational Gaussian Naive Bayes difficulty-classification demo.

> **Scope note:** The solver is a constraint-based recursive backtracking search, not a machine-learning solver. The ML model classifies puzzle difficulty; it does not solve puzzles. Its demonstration training examples are synthetic, so predictions are illustrative rather than reliable difficulty ratings.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [How the Sudoku logic works](#how-the-sudoku-logic-works)
- [ML difficulty classifier](#ml-difficulty-classifier)
- [Getting started](#getting-started)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Validation](#validation)
- [Known limitations](#known-limitations)

## Features

### Playable Sudoku board

- 9×9 grid divided into nine 3×3 boxes.
- Easy, Medium, Hard, and Expert game options.
- Select cells and enter digits using the on-screen keypad or keyboard.
- Arrow-key navigation; Backspace, Delete, or `0` erases an entry.
- Related row and column, matching values, and conflicting entries are highlighted.
- Notes mode, undo, redo, erase, reset, pause/resume, timer, mistake count, and filled-cell progress.
- Current game and recent completed games are saved in browser `localStorage`.

### Move Impact Map

After a value is entered, the map shows the selected cell and the empty peer cells in the same row, column, or box where that value is no longer a legal candidate. It displays the candidate lists before and after the move, with links drawn between the placement and affected cells.

This is a visualization of the immediate Sudoku constraints. It is not a visualization of every step in the solver's recursive search.

### Puzzle generation

The backend creates a completed valid board by randomized recursive search, then attempts to remove clues. It retains a removal only when the resulting puzzle has exactly one solution. Clue targets are used as generation goals:

| Difficulty | Target clues |
| --- | ---: |
| Easy | 45 |
| Medium | 36 |
| Hard | 30 |
| Expert | 24 |

The exact clue count may be higher than the target if removing another clue would make the puzzle non-unique.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS, custom CSS |
| Animation and icons | Framer Motion, Lucide React |
| Charts | Recharts |
| Backend | Python, Flask |
| Browser persistence | `localStorage` |

## Architecture

The React application talks to Flask through JSON REST endpoints. During local development, Vite proxies requests from `/api` to Flask at `http://localhost:5001`, avoiding the need to configure CORS for the browser.

The frontend can also generate a puzzle locally as a fallback if the puzzle API request fails. The ML prediction, however, requires the Flask API.

## How the Sudoku logic works

The solver treats empty cells as variables whose possible values are constrained by Sudoku rules:

1. Find the first empty cell, scanning rows from top to bottom and columns from left to right.
2. Try candidate digits from 1 through 9.
3. Check that a candidate does not already occur in the cell's row, column, or 3×3 box.
4. Place a legal candidate temporarily and recursively solve the updated board.
5. If the recursive search reaches a dead end, clear the temporary value and try the next candidate. This is **backtracking**.
6. If there are no empty cells left, return the completed board.

In pseudocode:

```text
solve(board):
    cell = find_first_empty_cell(board)
    if there is no empty cell:
        return solved

    for value in 1..9:
        if value is valid in cell's row, column, and box:
            place value
            if solve(board):
                return solved
            clear cell  // backtrack

    return no solution on this path
```

The backend also uses a solution counter, stopping once it reaches two solutions. Puzzle generation uses it to distinguish a unique solution from multiple solutions. This is a basic backtracking solver: it does not currently use MRV, forward checking, or a full constraint-propagation strategy.

## ML difficulty classifier

The **Predict difficulty** card sends the original puzzle to `POST /api/classify`. The classifier is implemented separately in `backend/ml_difficulty.py` and uses a small **Gaussian Naive Bayes** model.

### Features

The model derives four numeric features from the board:

- `clue_count`: number of filled cells.
- `average_candidates`: average legal candidate count among empty cells.
- `single_candidate_cells`: count of empty cells with exactly one candidate.
- `wide_candidate_cells`: count of empty cells with four or more candidates.

The model estimates the probability of each label—Easy, Medium, Hard, or Expert—using per-class Gaussian feature distributions and class priors. The interface displays the predicted label, its model confidence, and the class probabilities.

### Important model caveat

The labeled examples currently built into the module are **synthetic profiles**, not a real, validated dataset of Sudoku puzzles. The probability output is not calibrated, and generated-puzzle checks have shown that the predicted difficulty can be inaccurate. Treat this component as a demonstration of a supervised classification pipeline, not as an authoritative difficulty evaluator.

## Getting started

### Requirements

- Node.js and npm. Vite 7 requires Node.js `20.19+` or `22.12+`.
- Python 3.9 or later.

### Install dependencies

Run these commands from the project root:

```powershell
npm install
py -m pip install -r backend\requirements.txt
```

### Start the app

Open two terminals in the project root and keep both processes running.

**Terminal 1 — Flask API**

```powershell
npm run backend
```

**Terminal 2 — Vite frontend**

```powershell
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). Port `4173` is configured for this app to avoid clashing with other common local Vite projects using port `5173`.

Check that Flask is available at [http://localhost:5001/api/health](http://localhost:5001/api/health); it should return:

```json
{"status":"ok"}
```

### Production frontend build

```powershell
npm run build
```

To serve the generated frontend bundle locally:

```powershell
npm run preview
```

The Flask API must still be started separately when using API-backed functionality.

## API reference

All endpoints use the `/api` prefix.

### `GET /api/health`

Health check.

**Response**

```json
{"status":"ok"}
```

### `GET /api/puzzle?difficulty=medium`

Generate a puzzle. Supported difficulty values: `easy`, `medium`, `hard`, `expert`.

**Response fields**

- `puzzle`: 9×9 integer grid; `0` represents an empty cell.
- `solution`: completed 9×9 solution grid.
- `clues`: number of given cells in the puzzle.
- `difficulty`: requested difficulty.

### `POST /api/solve`

Solve a board with basic recursive backtracking.

**Request**

```json
{
  "board": [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]
}
```

The response contains `solved` (a boolean) and `board` (a 9×9 integer grid). The example uses an empty board to illustrate the request shape; normal gameplay sends the puzzle currently being solved.

### `POST /api/classify`

Classify puzzle difficulty with Gaussian Naive Bayes. The board must be a 9×9 grid of integers from `0` to `9`.

**Response fields**

- `difficulty`: predicted label.
- `confidence`: probability assigned to the predicted label by this model.
- `probabilities`: probability for each difficulty label.
- `features`: extracted feature values.
- `model`: model name.
- `training_data`: indicates the current synthetic profile data.

Invalid board dimensions or values return HTTP `400`.

## Project structure

```text
.
├── backend/
│   ├── ml_difficulty.py   # Gaussian Naive Bayes classifier and feature extraction
│   ├── requirements.txt   # Python dependencies
│   ├── server.py          # Flask REST API
│   └── solver.py          # Sudoku validation, solving, and puzzle generation
├── public/                # Static public assets
├── src/
│   ├── App.tsx            # Dashboard and Sudoku game UI
│   ├── assets/            # Frontend assets
│   ├── lib/sudoku.ts      # Client-side Sudoku helpers and move impact logic
│   ├── services/api.ts    # Typed frontend API calls
│   ├── types.ts           # Shared frontend TypeScript types
│   ├── index.css          # Tailwind and app-level styles
│   └── main.tsx           # React entry point
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts         # Dev server configuration and API proxy
```

## Browser storage

The application uses these `localStorage` keys:

- `sudoku-mind-ai-game`: saved board, original clues, difficulty, notes, mistakes, timer, status, and selected cell.
- `sudoku-mind-ai-recent`: a short list of recently completed games.

Data is stored only in the current browser profile. There is no user account or database backend.

## Validation

Build and type-check the frontend:

```powershell
npm run build
```

Check Python syntax:

```powershell
py -m py_compile backend\server.py backend\solver.py backend\ml_difficulty.py
```

## Known limitations

- Difficulty generation aims for clue-count targets and uniqueness; it does not guarantee a standardized human difficulty rating.
- The ML classifier's synthetic training data makes predictions educational only. A real labeled corpus and held-out evaluation are needed before relying on it.
- Sudoku solving uses basic first-empty-cell backtracking; advanced heuristics and logical solving techniques are not currently implemented in the backend solver.
- Game progress and recent games are local to one browser; there is no account synchronization or database.
- The app must have the Flask process running for backend puzzle generation and ML classification. The frontend has a local puzzle-generation fallback, but classification requires Flask.
