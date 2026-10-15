# 🫀 CardioPulse-K8s
> **Cloud-Native Microservices Architecture for Cardiovascular Risk Assessment**

[![Kubernetes](https://img.shields.io/badge/Kubernetes-v1.30+-326ce5.svg?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-Containers-2496ed.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-Pipeline-F7931E.svg?logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📌 Executive Summary
**CardioPulse-K8s** is an enterprise-grade, cloud-native machine learning system designed for real-time cardiovascular patient triage and clinical risk stratification. Built upon a decoupled **3-Tier Microservices Architecture** deployed on **Kubernetes**, the platform provides:

1. **Calibrated Machine Learning**: Random Forest ensemble equipped with probability calibration (`CalibratedClassifierCV`) achieving **0.9491 ROC-AUC** and **86.89% accuracy** on the Cleveland Heart Disease benchmark.
2. **Strict Medical Data Isolation**: The Core ML Inference Engine operates in a private, unexposed `ClusterIP` network zone. Only the API Gateway communicates with it via Kubernetes Internal DNS (`cardiopulse-ml-engine-svc:5000`).
3. **Interactive Clinical Decision Support Dashboard**: Modern React + TypeScript + Vite enterprise frontend with dynamic cardiovascular risk scoring, cohort batch screening with CSV upload, and live cluster observability diagnostics. Also supports legacy Streamlit deployment.

---

## 🏛️ System Architecture

```mermaid
graph TD
    Client[("👩‍⚕️ Clinical Practitioner / Browser")] -->|HTTP :30080 NodePort| UI["Tier 1: React Web Dashboard / Nginx\n(cardiopulse-web-dashboard-svc)"]
    
    subgraph "Kubernetes Cluster (Namespace: cardiopulse-prod)"
        UI -->|Internal DNS :5000 ClusterIP\n/api/v1/triage & /api/healthz| Gateway["Tier 2: API Gateway / Orchestrator\n(cardiopulse-gateway-svc)"]
        Gateway -->|Internal DNS :5000 ClusterIP\n/predict & /healthz| MLEngine["Tier 3: Core ML Inference Engine\n(cardiopulse-ml-engine-svc)"]
        
        MLEngine --> Artifacts[("Calibrated Pipeline Artifact\ncardiopulse_pipeline.joblib")]
    end
```

---

## 📊 Dataset & Model Metrics

- **Dataset**: UCI Cleveland Heart Disease Dataset (303 patient records, 13 clinical biomarkers).
- **Features Handled**:
  - Continuous: `age`, `trestbps` (resting blood pressure), `chol` (serum cholesterol), `thalach` (max heart rate), `oldpeak` (ST depression).
  - Categorical: `sex`, `cp` (chest pain type), `fbs` (fasting blood sugar), `restecg`, `exang`, `slope`, `ca`, `thal`.

| Metric | Score | Note |
| :--- | :--- | :--- |
| **ROC-AUC** | **0.9491** | Excellent discriminatory ability between high and low risk |
| **Accuracy** | **86.89%** | Evaluated on held-out 20% test partition |
| **F1-Score** | **0.8621** | Harmonic mean of precision and recall |

---

## 🚀 Quickstart Guide

### 1. Clone the Repository
```bash
git clone https://github.com/JayKalbi/CardioPulse-K8s.git
cd CardioPulse-K8s
```

### 2. Local Development (Without Docker or Kubernetes)

You can run the full 3-tier microservice stack locally using Python and Node.js:

```powershell
# Terminal 1: Core ML Inference Engine (Tier 3)
cd services/ml-inference-engine
$env:PORT="5001"
$env:MODEL_PATH="artifacts/cardiopulse_pipeline.joblib"
python app.py

# Terminal 2: API Gateway (Tier 2)
cd services/api-gateway
$env:PORT="5000"
$env:ML_ENGINE_URL="http://localhost:5001"
python app.py

# Terminal 3: React Web Dashboard (Tier 1)
cd services/web-dashboard
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

### 3. Run with Docker Compose (Single Command)

All 3 services can be built and orchestrated seamlessly using Docker Compose:

```powershell
# Build and run all microservices in the background
docker compose up -d

# View live aggregate logs
docker compose logs -f

# Stop and remove containers
docker compose down
```
Open **`http://localhost:8080`** in your browser.

---

### 4. Deploy to Kubernetes with Minikube

#### Step 4.1: Build Container Images
```powershell
docker build -t cardiopulse-ml-engine:v1 ./services/ml-inference-engine
docker build -t cardiopulse-gateway:v1 ./services/api-gateway
docker build -t cardiopulse-web-dashboard:v1 ./services/web-dashboard
```

#### Step 4.2: Start Minikube & Load Images
```powershell
# Start Minikube cluster using Docker driver
minikube start --driver=docker

# Load local Docker images into the Minikube cluster container cache
minikube image load cardiopulse-ml-engine:v1
minikube image load cardiopulse-gateway:v1
minikube image load cardiopulse-web-dashboard:v1
```

#### Step 4.3: Apply Kubernetes Manifests
Apply all manifests in sequence into the dedicated `cardiopulse-prod` namespace:
```powershell
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/03-ml-inference-deployment.yaml
kubectl apply -f k8s/04-api-gateway-deployment.yaml
kubectl apply -f k8s/05-web-dashboard-deployment.yaml
kubectl apply -f k8s/06-hpa.yaml
```

#### Step 4.4: Verify Deployment Status
```powershell
# Verify pods are in Running status
kubectl get pods -n cardiopulse-prod -w

# Check exposed services
kubectl get svc -n cardiopulse-prod
```

#### Step 4.5: Access the Dashboard
```powershell
# Automatically expose and open in your default browser:
minikube service cardiopulse-web-dashboard-svc -n cardiopulse-prod

# Or via port-forwarding to localhost:8080:
kubectl port-forward svc/cardiopulse-web-dashboard-svc 8080:80 -n cardiopulse-prod
```
The browser will open displaying the interactive CardioPulse Clinical Intelligence Dashboard!

---

## 🛡️ Microservices Justification & Viva Questions

- **Why separate the Gateway from the ML Engine?**  
  *Separation of concerns.* In clinical production environments, input validation, request throttling, authentication, and compliance logging should not consume model computing resources. The ML Inference Engine remains stateless, thread-safe, and private.
- **Why use ClusterIP for Tier 2 & Tier 3?**  
  *Zero-Trust Security.* Medical AI services must never be exposed publicly. They can only be reached by authorized internal services via Kubernetes internal DNS.
- **How does Horizontal Pod Autoscaling (HPA) work?**  
  When incoming triage requests or batch CSV processing cause CPU utilization on `cardiopulse-ml-engine` to exceed 70%, Kubernetes spins up additional inference pods automatically to distribute the load.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
