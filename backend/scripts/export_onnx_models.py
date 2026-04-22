"""
MindPulse — ONNX Model Export Pipeline
========================================
Exports trained models to ONNX format for browser-based inference.

Models exported:
1. XGBoost (primary stress classifier)
2. LSTM (temporal sequence model)
3. Ensemble metadata (for browser-side weighted voting)

Usage:
    python scripts/export_onnx_models.py --output-dir frontend/public/models

This enables:
- Zero server inference cost (runs in browser via ONNX Runtime Web)
- Better privacy (model never leaves user device)
- WebGPU acceleration for 10x faster inference
- Offline capability once model is cached
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys

import numpy as np

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import FEATURE_NAMES, LABELS
from app.ml.synthetic_data import generate_synthetic_dataset

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mindpulse.onnx_export")


def export_xgboost_onnx(output_dir: str) -> dict:
    """Export XGBoost model to ONNX format."""
    import xgboost as xgb
    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType

    logger.info("Training XGBoost model for ONNX export...")
    
    X, y, _ = generate_synthetic_dataset(n_samples=3000)
    
    model = xgb.XGBClassifier(
        n_estimators=350,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        objective="multi:softprob",
        num_class=3,
        random_state=42,
    )
    model.fit(X, y)
    
    # Calculate accuracy on held-out data
    X_test, y_test, _ = generate_synthetic_dataset(n_samples=500)
    accuracy = model.score(X_test, y_test)
    logger.info(f"XGBoost accuracy: {accuracy:.4f}")
    
    # Convert to ONNX
    logger.info("Converting XGBoost to ONNX...")
    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_NAMES)]))]
    
    onnx_model = onnxmltools.convert_xgboost(
        model,
        initial_types=initial_type,
        target_opset=15,
    )
    
    # Verify ONNX model
    import onnx
    import onnxruntime as ort
    
    onnx.checker.check_model(onnx_model)
    logger.info("ONNX model validation passed")
    
    # Save ONNX model
    os.makedirs(output_dir, exist_ok=True)
    onnx_path = os.path.join(output_dir, "xgb_model.onnx")
    onnx.save_model(onnx_model, onnx_path)
    logger.info(f"Saved XGBoost ONNX model to {onnx_path}")
    
    # Verify ONNX inference matches Python
    logger.info("Verifying ONNX inference matches Python...")
    ort_session = ort.InferenceSession(onnx_path)
    input_name = ort_session.get_inputs()[0].name
    
    sample = X[:5].astype(np.float32)
    
    # Python prediction
    py_probs = model.predict_proba(sample)
    
    # ONNX prediction
    onnx_result = ort_session.run(None, {input_name: sample})
    onnx_probs = onnx_result[1]  # Second output is probabilities
    
    # Compare
    max_diff = np.max(np.abs(py_probs - onnx_probs))
    logger.info(f"Max probability difference: {max_diff:.6f}")
    
    if max_diff > 1e-4:
        logger.warning(f"WARNING: Probability difference exceeds threshold: {max_diff}")
    else:
        logger.info("✅ ONNX inference matches Python exactly")
    
    # Save Python model too (for fallback)
    model_path = os.path.join(output_dir, "xgb_model.json")
    model.save_model(model_path)
    
    return {
        "model_type": "xgboost",
        "onnx_path": "xgb_model.onnx",
        "python_path": "xgb_model.json",
        "input_shape": [1, len(FEATURE_NAMES)],
        "output_names": ["label", "probabilities"],
        "accuracy": round(float(accuracy), 4),
        "max_prob_diff": round(float(max_diff), 6),
        "n_estimators": 350,
        "max_depth": 5,
    }


def export_lstm_onnx(output_dir: str) -> dict:
    """Export LSTM model to ONNX format."""
    import torch
    import torch.nn as nn
    
    from app.ml.temporal_model import StressLSTM, SEQUENCE_LENGTH, FEATURE_DIM
    
    logger.info("Training LSTM model for ONNX export...")
    
    lstm = StressLSTM(hidden_size=64, num_layers=2, dropout=0.2)
    
    # Generate synthetic sequences
    sequences, labels = lstm.generate_synthetic_sequences(n_samples=2000)
    
    # Train
    result = lstm.train(
        sequences=sequences,
        labels=labels,
        epochs=30,
        batch_size=32,
        learning_rate=0.001,
    )
    logger.info(f"LSTM training complete: accuracy={result['final_accuracy']:.4f}")
    
    # Export to ONNX
    logger.info("Converting LSTM to ONNX...")
    lstm._model.eval()
    
    dummy_input = torch.randn(1, SEQUENCE_LENGTH, FEATURE_DIM)
    onnx_path = os.path.join(output_dir, "lstm_model.onnx")
    
    torch.onnx.export(
        lstm._model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=15,
        do_constant_folding=True,
        input_names=["sequence"],
        output_names=["logits"],
        dynamic_axes={
            "sequence": {0: "batch_size"},
            "logits": {0: "batch_size"},
        },
    )
    
    # Verify ONNX model
    import onnx
    import onnxruntime as ort
    
    onnx.checker.check_model(onnx_path)
    logger.info("LSTM ONNX model validation passed")
    
    # Verify ONNX inference matches PyTorch
    logger.info("Verifying ONNX inference matches PyTorch...")
    ort_session = ort.InferenceSession(onnx_path)
    
    with torch.no_grad():
        py_logits = lstm._model(dummy_input).numpy()
    
    onnx_logits = ort_session.run(None, {"sequence": dummy_input.numpy()})[0]
    
    max_diff = np.max(np.abs(py_logits - onnx_logits))
    logger.info(f"Max logit difference: {max_diff:.6f}")
    
    if max_diff > 1e-4:
        logger.warning(f"WARNING: Logit difference exceeds threshold: {max_diff}")
    else:
        logger.info("✅ ONNX inference matches PyTorch exactly")
    
    # Also save PyTorch model
    pt_path = os.path.join(output_dir, "lstm_model.pt")
    torch.save({
        "model_state_dict": lstm._model.state_dict(),
        "hidden_size": lstm.hidden_size,
        "num_layers": lstm.num_layers,
        "dropout": lstm.dropout,
    }, pt_path)
    
    return {
        "model_type": "lstm",
        "onnx_path": "lstm_model.onnx",
        "pytorch_path": "lstm_model.pt",
        "input_shape": [1, SEQUENCE_LENGTH, FEATURE_DIM],
        "output_shape": [1, 3],
        "final_accuracy": round(result["final_accuracy"], 4),
        "max_logit_diff": round(float(max_diff), 6),
        "hidden_size": 64,
        "num_layers": 2,
    }


def export_ensemble_metadata(output_dir: str, xgb_info: dict, lstm_info: dict) -> dict:
    """Export ensemble configuration for browser-side voting."""
    models = [
        {
            "name": "xgboost",
            "file": xgb_info["onnx_path"],
            "weight": 0.5,
            "input_shape": xgb_info["input_shape"],
            "output_names": xgb_info["output_names"],
        },
    ]
    
    if not lstm_info.get("skipped"):
        models.append({
            "name": "lstm",
            "file": lstm_info["onnx_path"],
            "weight": 0.25,
            "input_shape": lstm_info["input_shape"],
            "output_shape": lstm_info["output_shape"],
            "sequence_length": 12,
        })
    
    metadata = {
        "ensemble": {
            "models": models,
            "labels": LABELS,
            "feature_names": FEATURE_NAMES,
            "num_features": len(FEATURE_NAMES),
            "thresholds": {
                "MILD": 40,
                "STRESSED": 70,
            },
            "version": "1.0.0",
            "export_date": __import__("datetime").datetime.now().isoformat(),
        }
    }
    
    metadata_path = os.path.join(output_dir, "ensemble_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Saved ensemble metadata to {metadata_path}")
    return metadata


def main():
    parser = argparse.ArgumentParser(description="Export MindPulse models to ONNX")
    parser.add_argument(
        "--output-dir",
        default="frontend/public/models",
        help="Output directory for ONNX models",
    )
    parser.add_argument(
        "--skip-lstm",
        action="store_true",
        help="Skip LSTM export (requires PyTorch)",
    )
    args = parser.parse_args()
    
    output_dir = os.path.abspath(args.output_dir)
    logger.info(f"Exporting models to: {output_dir}")
    
    # Check dependencies
    try:
        import onnx
        import onnxmltools
        import onnxruntime
        import skl2onnx
    except ImportError as e:
        logger.error(f"Missing dependencies: {e}")
        logger.error("Install with: pip install onnx onnxmltools onnxruntime skl2onnx")
        sys.exit(1)
    
    # Export XGBoost
    xgb_info = export_xgboost_onnx(output_dir)
    
    # Export LSTM (optional)
    if not args.skip_lstm:
        try:
            import torch
            lstm_info = export_lstm_onnx(output_dir)
        except ImportError:
            logger.warning("PyTorch not installed, skipping LSTM export")
            lstm_info = {"model_type": "lstm", "skipped": True}
    else:
        lstm_info = {"model_type": "lstm", "skipped": True}
    
    # Export ensemble metadata
    metadata = export_ensemble_metadata(output_dir, xgb_info, lstm_info)
    
    # Summary
    print("\n" + "=" * 60)
    print("ONNX Export Summary")
    print("=" * 60)
    print(f"Output directory: {output_dir}")
    print(f"XGBoost ONNX: {xgb_info.get('onnx_path', 'N/A')}")
    print(f"  Accuracy: {xgb_info.get('accuracy', 'N/A')}")
    print(f"  Max diff vs Python: {xgb_info.get('max_prob_diff', 'N/A')}")
    if not lstm_info.get("skipped"):
        print(f"LSTM ONNX: {lstm_info.get('onnx_path', 'N/A')}")
        print(f"  Final accuracy: {lstm_info.get('final_accuracy', 'N/A')}")
        print(f"  Max diff vs PyTorch: {lstm_info.get('max_logit_diff', 'N/A')}")
    print(f"Ensemble metadata: ensemble_metadata.json")
    print("=" * 60)
    
    # Verify all files exist
    required_files = [
        os.path.join(output_dir, "xgb_model.onnx"),
        os.path.join(output_dir, "xgb_model.json"),
        os.path.join(output_dir, "ensemble_metadata.json"),
    ]
    if not lstm_info.get("skipped"):
        required_files.append(os.path.join(output_dir, "lstm_model.onnx"))
        required_files.append(os.path.join(output_dir, "lstm_model.pt"))
    
    all_exist = all(os.path.exists(f) for f in required_files)
    if all_exist:
        print("[OK] All model files exported successfully")
    else:
        print("[FAIL] Some model files missing!")
        for f in required_files:
            if not os.path.exists(f):
                print(f"  Missing: {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
