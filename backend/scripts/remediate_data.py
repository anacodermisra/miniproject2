"""
Semantic clustering for MindPulse data remediation.
"""

import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import DBSCAN


def cluster_and_analyze_data(csv_path):
    """Apply semantic clustering to find data quality patterns."""
    print("Loading dataset...")
    df = pd.read_csv(csv_path)

    # Create semantic fingerprints
    print("Creating semantic fingerprints...")
    fingerprints = []
    for _, row in df.iterrows():
        wpm = row["typing_speed_wpm"]
        hold = row["hold_time_mean"]
        err = row["error_rate"]
        label = int(row["label"])
        mouse = row["mouse_speed_mean"]
        session = row["session_duration_min"]

        desc = f"Typing {wpm:.1f} WPM. Hold {hold:.1f}ms. Error {err:.3f}. Label {label}. Mouse {mouse:.1f}. Session {session:.1f}min."
        fingerprints.append(desc)

    # Embed
    print("Embedding...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(fingerprints, show_progress_bar=False)

    # Cluster
    print("Clustering...")
    clustering = DBSCAN(eps=0.3, min_samples=3).fit(embeddings)
    labels = clustering.labels_

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_outliers = list(labels).count(-1)

    print(f"\\nRESULTS:")
    print(
        f"Samples: {len(df)} | Clusters: {n_clusters} | Outliers: {n_outliers} ({n_outliers / len(df) * 100:.1f}%)"
    )

    # Find the problematic cluster (high hold times)
    for cid in sorted(set(labels)):
        if cid == -1:
            continue
        mask = labels == cid
        cluster = df[mask]
        avg_hold = cluster["hold_time_mean"].mean()
        print(f"Cluster {cid}: {len(cluster)} samples, avg hold={avg_hold:.1f}ms")

        if avg_hold > 1000:  # Suspicious cluster
            print(f"  ⚠️  ANOMALY CLUSTER DETECTED (hold time >1s)")
            return cluster.index.tolist()

    return []


if __name__ == "__main__":
    anomalous_indices = cluster_and_analyze_data(
        r"D:\Projects\Algoquest\mini\backend\app\ml\artifacts\real_dataset_balanced.csv"
    )
    print(f"\\nAnomalous indices to fix: {anomalous_indices[:10]}...")
