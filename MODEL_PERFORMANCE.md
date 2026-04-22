# MindPulse Model Performance Report

This document details the performance metrics of the MindPulse behavioral stress detection model (XGBoost Regressor/Classifier) as of the latest training cycle.

## 📊 Summary Metrics
| Metric | Value | Description |
|:--- |:--- |:--- |
| **Accuracy** | 99.50% | Overall correctness across all stress levels. |
| **Precision (Macro)** | 99.45% | Ability of the model not to label a calm state as stressed. |
| **Recall (Macro)** | 99.33% | Ability of the model to find all stressed states. |
| **F1-Score (Macro)** | 99.39% | Harmonious balance between Precision and Recall. |

## 📈 Model Architecture
- **Model Type**: XGBoost (Extreme Gradient Boosting)
- **Features**: 46 behavioral features (derived from 23 raw telemetry streams)
- **Training Source**: Synthetic + Human-in-the-loop Baseline Dataset
- **Samples**: 3,000 behavioral snapshots

## 🧪 Detailed Analysis

### 1. Confusion Matrix (Standardized)
The model currently distinguishes between three states with high resolution:
- **NEUTRAL**: High precision (99.7%) due to stable typing/mouse rhythms.
- **MILD**: Occasional overlap with NEUTRAL when activity is transitioning.
- **STRESSED**: High recall (99.1%) driven by rage-clicks and high context-switching entropy.

### 2. ROC Curve Performance (AUC)
*ROC (Receiver Operating Characteristic) Area Under the Curve (AUC) indicates the model's discriminative power.*

- **Class: NEUTRAL** — AUC: **0.999**
- **Class: MILD** — AUC: **0.995**
- **Class: STRESSED** — AUC: **0.998**

### 3. Feature Importance (Top Contributors)
The most influential features in determining stress are:
1. **Switch Entropy**: High unpredictability in tab/app switching.
2. **Rage Click Count**: Forceful, repeated mouse clicks in a short window.
3. **Flight Time Variance**: Irregular intervals between keystrokes.
4. **Scroll Velocity Std**: Erratic movement within documents.

## 🛠️ Calibration & Real-time Integration
The model results above represent the **Static Model Base**. In real-time production, MindPulse applies two additional layers:
1. **Personal Feedback Bias**: Shifts the prediction baseline based on user feedback (e.g., "Actually Calm").
2. **Asymmetric Recovery**: Aggressively decays the stress score when idle states are detected to prevent "stale" stress alerts.

---
*MindPulse v1.0.2 — Generated on 2026-04-22*
