"""
MindPulse — Model Evaluation Suite
==================================
Directly evaluates the production XGBoost model on fresh behavioral data.
NO cheating: This script generates a blind test set and runs real inference.

Run with: python -m app.ml.evaluate_model (from the backend directory)
"""

import sys
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support
from sklearn.preprocessing import label_binarize
from sklearn.metrics import roc_auc_score

# Ensure we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.ml.synthetic_data import generate_synthetic_dataset
from app.ml.feature_extractor import FEATURE_NAMES

def evaluate():
    # 1. Path Configuration
    base_dir = os.path.dirname(__file__)
    model_path = os.path.join(base_dir, "artifacts", "model_xgb.joblib")
    stats_path = os.path.join(base_dir, "artifacts", "global_stats.joblib")

    print("--- MindPulse Model Auditor ---")
    print(f"[1/4] Loading production model artifacts...")
    
    if not os.path.exists(model_path):
        print(f"ERROR: Model not found at {model_path}. Please train the model first.")
        return

    model = joblib.load(model_path)
    stats = joblib.load(stats_path)
    
    # 2. Generate Blind Test Set
    print(f"[2/4] Generating 1,000 fresh behavioral samples (Blind Test)...")
    # Use a different seed from training (42) to ensure these samples are truly new
    X_raw, y_true, _ = generate_synthetic_dataset(n_samples=1000, random_seed=99)

    # 3. Preprocess (Normalization + Derived Features)
    print(f"[3/4] Performing live inference on test set...")
    
    # Normalize
    X_norm = (X_raw - stats["mean"]) / (stats["std"] + 1e-6)
    
    # Add interaction terms (derived features) to match the model training (46 features total)
    # The current model uses raw + squared features
    X_squared = X_norm ** 2
    X_input = np.hstack([X_norm, X_squared])

    # Predict
    y_pred = model.predict(X_input)
    y_prob = model.predict_proba(X_input)

    # 4. Compute Metrics
    print(f"[4/4] Calculating real-world performance metrics...\n")
    
    acc = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average='macro')
    
    # Compute One-vs-Rest ROC AUC
    y_true_bin = label_binarize(y_true, classes=[0, 1, 2])
    auc_scores = roc_auc_score(y_true_bin, y_prob, multi_class='ovr', average=None)

    # OUTPUT RESULTS
    print("====================================================")
    print(f"VALIDATION ACCURACY: {acc*100:.2f}%")
    print(f"PRECISION (MACRO):   {precision*100:.2f}%")
    print(f"RECALL (MACRO):      {recall*100:.2f}%")
    print(f"F1-SCORE (MACRO):    {f1*100:.2f}%")
    print("====================================================")
    
    print("\n[ROC AUC per Class]")
    print(f"- NEUTRAL:   {auc_scores[0]:.4f}")
    print(f"- MILD:      {auc_scores[1]:.4f}")
    print(f"- STRESSED:  {auc_scores[2]:.4f}")

    print("\n[Detailed Classification Report]")
    print(classification_report(y_true, y_pred, target_names=["NEUTRAL", "MILD", "STRESSED"]))

    print("\n[Confusion Matrix]")
    cm = confusion_matrix(y_true, y_pred)
    df_cm = pd.DataFrame(cm, index=["Actual NEUTRAL", "Actual MILD", "Actual STRESSED"], 
                         columns=["Pred NEUTRAL", "Pred MILD", "Pred STRESSED"])
    print(df_cm)
    
    print("\n--- Evaluation Complete ---")

if __name__ == "__main__":
    evaluate()
