"""
CardioPulse ML Inference Engine (Tier 3 Microservice)
High-throughput REST API that hosts the calibrated model pipeline.
Provides health checks, single prediction, and batch inference endpoints.
"""

import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)

MODEL_PATH = os.environ.get("MODEL_PATH", "artifacts/cardiopulse_pipeline.joblib")

print(f"Loading pipeline from {MODEL_PATH}...")
model_pipeline = joblib.load(MODEL_PATH)
print("Pipeline loaded successfully into inference engine memory.")

FEATURE_NAMES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", 
    "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]

@app.route("/", methods=["GET"])
@app.route("/healthz", methods=["GET"])
def health_check():
    return jsonify({
        "service": "CardioPulse ML Inference Engine",
        "status": "healthy",
        "tier": "Tier-3 (Core Inference)",
        "model_version": "v1.0.0-calibrated-rf"
    }), 200

@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({"error": "Missing JSON body"}), 400
        
        # Check if single or batch
        if "patients" in payload:
            records = payload["patients"]
        elif "features" in payload:
            records = [payload["features"]]
        else:
            records = [payload]

        input_df = pd.DataFrame(records)
        
        # Ensure correct column ordering and types
        for col in FEATURE_NAMES:
            if col not in input_df.columns:
                return jsonify({"error": f"Missing required clinical feature: '{col}'"}), 400
            input_df[col] = pd.to_numeric(input_df[col])

        ordered_df = input_df[FEATURE_NAMES]
        
        # Inference: calibrated probabilities and binary class
        probabilities = model_pipeline.predict_proba(ordered_df)[:, 1]
        predictions = model_pipeline.predict(ordered_df)

        results = []
        for i, (prob, pred) in enumerate(zip(probabilities, predictions)):
            risk_pct = round(float(prob) * 100, 2)
            if risk_pct >= 65.0:
                triage_cat = "High Risk"
                recommendation = "Immediate referral to cardiology specialist and stress echocardiogram advised."
            elif risk_pct >= 35.0:
                triage_cat = "Moderate Risk"
                recommendation = "Lifestyle modifications, regular lipid panel screening, and follow-up in 30 days."
            else:
                triage_cat = "Low Risk"
                recommendation = "Maintain regular cardiovascular exercise and routine annual screening."

            results.append({
                "patient_index": i,
                "risk_probability": risk_pct,
                "prediction_label": int(pred),
                "triage_category": triage_cat,
                "clinical_recommendation": recommendation
            })

        return jsonify({
            "service": "ml-inference-engine",
            "count": len(results),
            "results": results if len(results) > 1 else results[0]
        }), 200

    except Exception as e:
        return jsonify({"error": f"Inference failure: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
