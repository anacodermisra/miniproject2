"""
MindPulse — Temporal LSTM Model
=================================
LSTM processes sequences of 23-feature vectors to capture temporal patterns.

Input: [batch, sequence_length=12, features=23]  # 60 seconds of data
Output: [batch, 3] class probabilities

Captures:
- Trend (stress increasing/decreasing)
- Rhythm (regular vs erratic patterns)
- Context (after meeting, during deep work)

Use Case: Second opinion for borderline cases (MILD/STRESSED boundary)
Expected Impact: +5-8% F1 for sequence prediction
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional, Tuple

import numpy as np

from app.core.config import LABELS, FEATURE_NAMES

logger = logging.getLogger("mindpulse.temporal")

# Sequence configuration
SEQUENCE_LENGTH = 12  # 12 windows = 60 seconds (5-sec windows)
FEATURE_DIM = len(FEATURE_NAMES)  # 23


class StressLSTM:
    """
    LSTM model for temporal stress prediction.
    
    Processes sequences of feature vectors to detect trends and patterns
    that single-window models miss.
    """

    def __init__(
        self,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.dropout = dropout
        self._model = None
        self._is_trained = False
        self._model_path = None

    def _init_model(self):
        """Initialize PyTorch LSTM model."""
        try:
            import torch
            import torch.nn as nn

            class _LSTMModel(nn.Module):
                def __init__(self, input_size, hidden_size, num_layers, dropout, num_classes=3):
                    super().__init__()
                    self.lstm = nn.LSTM(
                        input_size,
                        hidden_size,
                        num_layers,
                        batch_first=True,
                        dropout=dropout if num_layers > 1 else 0.0,
                    )
                    self.dropout = nn.Dropout(dropout)
                    self.fc1 = nn.Linear(hidden_size, 32)
                    self.relu = nn.ReLU()
                    self.fc2 = nn.Linear(32, num_classes)

                def forward(self, x):
                    lstm_out, _ = self.lstm(x)
                    # Use last time step output
                    last_hidden = lstm_out[:, -1, :]
                    out = self.dropout(last_hidden)
                    out = self.fc1(out)
                    out = self.relu(out)
                    out = self.fc2(out)
                    return out

            self._model = _LSTMModel(
                input_size=FEATURE_DIM,
                hidden_size=self.hidden_size,
                num_layers=self.num_layers,
                dropout=self.dropout,
            )
            return True
        except ImportError:
            logger.warning("PyTorch not installed, LSTM unavailable")
            return False

    def train(
        self,
        sequences: np.ndarray,
        labels: np.ndarray,
        epochs: int = 50,
        batch_size: int = 32,
        learning_rate: float = 0.001,
        model_dir: Optional[str] = None,
    ) -> dict:
        """
        Train LSTM on sequences of feature vectors.
        
        Args:
            sequences: np.ndarray of shape [n_samples, sequence_length, features]
            labels: np.ndarray of shape [n_samples] with class indices (0, 1, 2)
            epochs: Number of training epochs
            batch_size: Training batch size
            learning_rate: Learning rate for optimizer
            model_dir: Directory to save model
        
        Returns:
            Training metrics dict
        """
        if not self._init_model():
            return {"error": "PyTorch not available"}

        import torch
        import torch.nn as nn
        from torch.utils.data import TensorDataset, DataLoader

        # Convert to tensors
        X_tensor = torch.FloatTensor(sequences)
        y_tensor = torch.LongTensor(labels)

        dataset = TensorDataset(X_tensor, y_tensor)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.Adam(self._model.parameters(), lr=learning_rate)

        # Training loop
        self._model.train()
        history = {"loss": [], "accuracy": []}

        for epoch in range(epochs):
            epoch_loss = 0.0
            correct = 0
            total = 0

            for batch_X, batch_y in dataloader:
                optimizer.zero_grad()
                outputs = self._model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()

                epoch_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                total += batch_y.size(0)
                correct += (predicted == batch_y).sum().item()

            avg_loss = epoch_loss / len(dataloader)
            accuracy = correct / total if total > 0 else 0.0
            history["loss"].append(avg_loss)
            history["accuracy"].append(accuracy)

            if (epoch + 1) % 10 == 0:
                logger.info(
                    f"LSTM Epoch [{epoch+1}/{epochs}], "
                    f"Loss: {avg_loss:.4f}, Accuracy: {accuracy:.4f}"
                )

        self._is_trained = True

        # Save model
        if model_dir:
            os.makedirs(model_dir, exist_ok=True)
            self._model_path = os.path.join(model_dir, "lstm_model.pt")
            torch.save({
                "model_state_dict": self._model.state_dict(),
                "hidden_size": self.hidden_size,
                "num_layers": self.num_layers,
                "dropout": self.dropout,
            }, self._model_path)
            logger.info(f"LSTM model saved to {self._model_path}")

        return {
            "final_loss": history["loss"][-1],
            "final_accuracy": history["accuracy"][-1],
            "epochs": epochs,
        }

    def load(self, model_dir: Optional[str] = None) -> bool:
        """Load trained LSTM model."""
        if model_dir:
            self._model_dir = model_dir
        else:
            self._model_dir = os.path.join(
                os.path.dirname(__file__), "artifacts"
            )

        self._model_path = os.path.join(self._model_dir, "lstm_model.pt")

        if not os.path.exists(self._model_path):
            logger.warning(f"LSTM model not found at {self._model_path}")
            return False

        if not self._init_model():
            return False

        import torch

        checkpoint = torch.load(self._model_path, weights_only=False)
        self._model.load_state_dict(checkpoint["model_state_dict"])
        self._model.eval()
        self._is_trained = True
        logger.info("LSTM model loaded successfully")
        return True

    @property
    def is_ready(self) -> bool:
        return self._is_trained and self._model is not None

    def predict_sequence(self, sequence: np.ndarray) -> dict:
        """
        Predict stress level from a sequence of feature vectors.
        
        Args:
            sequence: np.ndarray of shape [sequence_length, features] or [1, sequence_length, features]
        
        Returns:
            dict with probabilities, prediction, confidence
        """
        import torch

        if not self.is_ready:
            return self._fallback_result()

        # Ensure correct shape
        if sequence.ndim == 2:
            sequence = sequence.reshape(1, sequence.shape[0], sequence.shape[1])

        self._model.eval()
        with torch.no_grad():
            X_tensor = torch.FloatTensor(sequence)
            outputs = self._model(X_tensor)
            probs = torch.softmax(outputs, dim=1).numpy()[0]

        prediction_idx = int(np.argmax(probs))
        confidence = float(np.max(probs))

        return {
            "probabilities": {
                LABELS[i]: round(float(probs[i]), 3) for i in range(3)
            },
            "prediction": LABELS[prediction_idx],
            "confidence": round(confidence, 3),
            "model_type": "lstm_temporal",
        }

    def _fallback_result(self) -> dict:
        """Return when model is not ready."""
        return {
            "probabilities": {"NEUTRAL": 0.33, "MILD": 0.33, "STRESSED": 0.34},
            "prediction": "NEUTRAL",
            "confidence": 0.34,
            "model_type": "lstm_temporal",
        }

    def generate_synthetic_sequences(
        self,
        n_samples: int = 1000,
        n_per_class: Optional[int] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate synthetic training sequences for initial LSTM training.
        
        Creates sequences with temporal patterns:
        - NEUTRAL: Stable, low variance features
        - MILD: Moderate increase in stress indicators
        - STRESSED: Clear upward trend in stress features
        """
        from app.ml.synthetic_data import generate_synthetic_dataset

        # Generate base samples
        X_base, y_base, _ = generate_synthetic_dataset(n_samples=n_samples)

        sequences = []
        labels = []

        for i in range(n_samples):
            # Create a sequence by adding temporal trend to base features
            base = X_base[i]
            sequence = []

            for t in range(SEQUENCE_LENGTH):
                # Add temporal component
                trend_factor = t / SEQUENCE_LENGTH  # 0 to 1

                if y_base[i] == 0:  # NEUTRAL: stable
                    noise = np.random.normal(0, 0.1, FEATURE_DIM)
                    features = base + noise
                elif y_base[i] == 1:  # MILD: moderate increase
                    noise = np.random.normal(0, 0.15, FEATURE_DIM)
                    trend = trend_factor * 0.3 * (base * 0.1)
                    features = base + noise + trend
                else:  # STRESSED: clear upward trend
                    noise = np.random.normal(0, 0.2, FEATURE_DIM)
                    trend = trend_factor * 0.5 * (base * 0.15)
                    features = base + noise + trend

                sequence.append(features)

            sequences.append(sequence)
            labels.append(y_base[i])

        return np.array(sequences, dtype=np.float32), np.array(labels, dtype=np.int64)


# Global singleton
lstm_model = StressLSTM()
