# SudokuMind AI

## Run locally

Install the frontend dependencies once:

```powershell
npm install
py -m pip install -r backend\requirements.txt
```

Start the Flask API and Vite frontend in separate terminals from this directory:

```powershell
npm run backend
```

```powershell
npm run dev
```

Open **http://localhost:4173**. This project uses port `4173` because port `5173` may be occupied by another local app. Vite proxies `/api` requests to the Flask API on port `5001`.

Check the API directly at http://localhost:5001/api/health. It should return `{"status":"ok"}`. Keep both terminal processes running while using the app.

## ML difficulty demo

The **Predict difficulty** card sends the puzzle to `POST /api/classify`. The separate `backend/ml_difficulty.py` module extracts clue/candidate features and classifies them with a supervised Gaussian Naive Bayes model. Its built-in labeled training profiles are synthetic and intended for demonstrating the ML workflow; predictions are not calibrated against a real puzzle corpus.
