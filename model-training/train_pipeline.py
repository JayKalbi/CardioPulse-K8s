"""
CardioPulse End-to-End ML Training & Evaluation Pipeline
Constructs a Scikit-Learn Pipeline with ColumnTransformer, trains an ensemble model with probability calibration,
evaluates on a held-out test split, and exports the production artifact and metrics.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

DATA_PATH = "data/heart.csv"
ARTIFACTS_DIR = "model-training/artifacts"
PROD_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "cardiopulse_pipeline.joblib")
METRICS_PATH = os.path.join(ARTIFACTS_DIR, "evaluation_metrics.json")

# Feature definitions
NUMERICAL_FEATURES = ["age", "trestbps", "chol", "thalach", "oldpeak"]
CATEGORICAL_FEATURES = ["sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"]

def train_and_export_pipeline():
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    
    print(f"Loading heart disease dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    
    X = df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES]
    y = df["target"]
    
    # Train / Test split (stratified to preserve class distribution)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    print(f"Dataset split: Train={len(X_train)} samples, Test={len(X_test)} samples.")
    
    # Preprocessing Pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES)
        ]
    )
    
    # Base Classifier: Tuned Random Forest
    base_clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        min_samples_split=4,
        random_state=42,
        class_weight="balanced"
    )
    
    # Calibrated Classifier: ensures predict_proba maps to authentic probability
    calibrated_clf = CalibratedClassifierCV(estimator=base_clf, method="sigmoid", cv=3)
    
    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", calibrated_clf)
    ])
    
    print("Fitting model pipeline with probability calibration...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate on held-out test data
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_proba)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred).tolist()
    
    metrics = {
        "accuracy": round(float(accuracy), 4),
        "roc_auc": round(float(roc_auc), 4),
        "f1_score": round(float(f1), 4),
        "confusion_matrix": cm,
        "classification_report": classification_report(y_test, y_pred, output_dict=True)
    }
    
    print(f"Evaluation Results -> Accuracy: {accuracy:.4f} | ROC-AUC: {roc_auc:.4f} | F1: {f1:.4f}")
    
    # Export artifacts
    joblib.dump(pipeline, PROD_MODEL_PATH)
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=4)
        
    # Also copy model artifact to the ml-inference-engine directory
    inf_engine_artifact_dir = "services/ml-inference-engine/artifacts"
    os.makedirs(inf_engine_artifact_dir, exist_ok=True)
    joblib.dump(pipeline, os.path.join(inf_engine_artifact_dir, "cardiopulse_pipeline.joblib"))
    
    print(f"Artifacts saved:\n - Model: {PROD_MODEL_PATH}\n - Metrics: {METRICS_PATH}\n - Inference Service Copy: {inf_engine_artifact_dir}")

if __name__ == "__main__":
    train_and_export_pipeline()
