"""A small supervised Gaussian Naive Bayes model for puzzle difficulty."""

from __future__ import annotations

from math import exp, log, pi
from typing import Dict, List, Sequence, Tuple

from solver import Board, candidates

FEATURE_NAMES = (
    'clue_count',
    'average_candidates',
    'single_candidate_cells',
    'wide_candidate_cells',
)
LABELS = ('easy', 'medium', 'hard', 'expert')

# Synthetic feature profiles provide an immediately usable educational model.
# Replace these with measured features from a labeled puzzle corpus for production use.
TRAINING_SAMPLES: Tuple[Tuple[str, Tuple[float, ...]], ...] = (
    ('easy', (52, 1.7, 30, 2)),
    ('easy', (48, 2.0, 25, 4)),
    ('easy', (45, 2.1, 23, 5)),
    ('easy', (50, 1.8, 28, 3)),
    ('easy', (46, 2.2, 20, 6)),
    ('easy', (53, 1.6, 32, 1)),
    ('medium', (42, 2.2, 19, 6)),
    ('medium', (39, 2.5, 16, 8)),
    ('medium', (36, 2.7, 13, 10)),
    ('medium', (41, 2.3, 18, 7)),
    ('medium', (37, 2.8, 12, 11)),
    ('medium', (43, 2.1, 20, 5)),
    ('hard', (35, 2.8, 12, 11)),
    ('hard', (32, 3.1, 9, 14)),
    ('hard', (30, 3.3, 7, 16)),
    ('hard', (34, 3.0, 10, 13)),
    ('hard', (29, 3.5, 6, 18)),
    ('hard', (33, 3.2, 8, 15)),
    ('expert', (28, 3.4, 7, 17)),
    ('expert', (25, 3.8, 4, 21)),
    ('expert', (23, 4.0, 3, 23)),
    ('expert', (27, 3.6, 5, 19)),
    ('expert', (22, 4.2, 2, 25)),
    ('expert', (26, 3.9, 4, 22)),
)


def extract_features(board: Board) -> Tuple[float, ...]:
    clue_count = sum(value != 0 for row in board for value in row)
    candidate_counts = [
        len(candidates(board, row, col))
        for row in range(9)
        for col in range(9)
        if board[row][col] == 0
    ]

    if not candidate_counts:
        return float(clue_count), 0.0, 0.0, 0.0

    empty_cells = len(candidate_counts)
    average_candidates = sum(candidate_counts) / empty_cells
    single_candidate_cells = sum(count == 1 for count in candidate_counts)
    wide_candidate_cells = sum(count >= 4 for count in candidate_counts)
    return (
        float(clue_count),
        average_candidates,
        float(single_candidate_cells),
        float(wide_candidate_cells),
    )


class GaussianNaiveBayes:
    def __init__(self, samples: Sequence[Tuple[str, Tuple[float, ...]]]) -> None:
        self._statistics: Dict[str, Tuple[Tuple[float, ...], Tuple[float, ...]]] = {}
        self._priors: Dict[str, float] = {}
        total_samples = len(samples)

        for label in LABELS:
            rows = [features for sample_label, features in samples if sample_label == label]
            if not rows:
                raise ValueError(f'Missing training samples for {label}')
            means = tuple(sum(row[index] for row in rows) / len(rows) for index in range(len(FEATURE_NAMES)))
            variances = tuple(
                max(
                    sum((row[index] - means[index]) ** 2 for row in rows) / len(rows),
                    1e-6,
                )
                for index in range(len(FEATURE_NAMES))
            )
            self._statistics[label] = means, variances
            self._priors[label] = len(rows) / total_samples

    def predict_proba(self, features: Tuple[float, ...]) -> Dict[str, float]:
        log_likelihoods: Dict[str, float] = {}
        for label, (means, variances) in self._statistics.items():
            score = log(self._priors[label])
            for index, value in enumerate(features):
                variance = variances[index]
                score -= 0.5 * log(2 * pi * variance)
                score -= ((value - means[index]) ** 2) / (2 * variance)
            log_likelihoods[label] = score

        maximum = max(log_likelihoods.values())
        probabilities = {label: (log_score - maximum) for label, log_score in log_likelihoods.items()}
        exponentials = {label: exp(score) for label, score in probabilities.items()}
        total = sum(exponentials.values())
        return {label: probability / total for label, probability in exponentials.items()}

    def classify(self, features: Tuple[float, ...]) -> Tuple[str, Dict[str, float]]:
        probabilities = self.predict_proba(features)
        label = max(probabilities, key=probabilities.get)
        return label, probabilities


MODEL = GaussianNaiveBayes(TRAINING_SAMPLES)


def classify_puzzle(board: Board) -> dict:
    features = extract_features(board)
    label, probabilities = MODEL.classify(features)
    return {
        'difficulty': label,
        'confidence': probabilities[label],
        'probabilities': probabilities,
        'features': dict(zip(FEATURE_NAMES, features)),
        'model': 'Gaussian Naive Bayes',
        'training_data': 'synthetic feature profiles',
    }


def is_valid_board_shape(board: object) -> bool:
    return (
        isinstance(board, list)
        and len(board) == 9
        and all(
            isinstance(row, list)
            and len(row) == 9
            and all(isinstance(value, int) and 0 <= value <= 9 for value in row)
            for row in board
        )
    )
