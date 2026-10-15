"""
CardioPulse API Gateway (Tier 2 Microservice)
Handles request orchestration, schema validation, metrics logging,
and invokes the ML Inference Engine via Kubernetes Service Discovery.
"""

import os
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

# Kubernetes internal DNS endpoint for the ML Inference Engine service
ML_ENGINE_URL = os.environ.get("ML_ENGINE_URL", "http://cardiopulse-ml-engine-svc:5000")

@app.route("/", methods=["GET"])
@app.route("/healthz", methods=["GET"])
def health_check():
    # Probe upstream ML Engine to evaluate end-to-end cluster health
    upstream_status = "unreachable"
    try:
        resp = requests.get(f"{ML_ENGINE_URL}/healthz", timeout=3)
        if resp.status_code == 200:
            upstream_status = "healthy"
    except Exception:
        upstream_status = "offline/timeout"

    return jsonify({
        "service": "CardioPulse API Gateway",
        "status": "healthy",
        "tier": "Tier-2 (Orchestration & Gateway)",
        "upstream_ml_engine": {
            "endpoint": ML_ENGINE_URL,
            "status": upstream_status
        }
    }), 200

@app.route("/api/v1/triage", methods=["POST"])
def triage():
    """
    Receives triage requests from the Streamlit UI, forwards to ML Engine,
    and returns an enriched clinical risk assessment payload.
    """
    try:
        incoming_data = request.get_json(force=True)
        if not incoming_data:
            return jsonify({"error": "No input payload provided"}), 400

        # Call Tier-3 ML Inference Engine via internal K8s DNS
        target_url = f"{ML_ENGINE_URL}/predict"
        response = requests.post(target_url, json=incoming_data, timeout=8)
        
        if response.status_code != 200:
            return jsonify({
                "error": "Upstream ML engine reported error",
                "details": response.text
            }), response.status_code

        data = response.json()
        return jsonify({
            "gateway_status": "success",
            "routed_via": "cardiopulse-gateway",
            "payload": data
        }), 200

    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": "Failed to communicate with internal ML engine",
            "target": ML_ENGINE_URL,
            "message": str(e)
        }), 502
    except Exception as e:
        return jsonify({"error": f"Internal gateway error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
