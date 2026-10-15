# CardioPulse React Web Dashboard

React + TypeScript + Vite dashboard served by Nginx. Streamlit is no longer required for the UI.

## Local development

Requirements: Node.js 20+ and npm.

```powershell
cd services/web-dashboard
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:5173. The Vite development proxy sends `/api/*` requests to `CARDIOPULSE_GATEWAY_URL` (default `http://localhost:5000`). The API gateway must be running and able to reach the ML inference service. If the gateway is reachable only through Kubernetes, use `kubectl port-forward svc/cardiopulse-gateway-svc 5000:5000 -n cardiopulse-prod` in a separate terminal.

To create a production bundle:

```powershell
npm run build
npm run preview
```

## Docker

Build from the repository root:

```powershell
docker build -t cardiopulse-web-dashboard:v1 ./services/web-dashboard
```

The image serves the compiled app on port 80. Nginx proxies `/api/v1/triage` and `/api/healthz` to `cardiopulse-gateway-svc:5000` over the cluster network. Do not expose the ML inference engine directly to the browser.

## API contracts used

- `POST /api/v1/triage` with `{ "features": { ...13 features... } }` for a single assessment.
- `POST /api/v1/triage` with `{ "patients": [{ ...13 features... }] }` for a batch.
- `GET /api/healthz` for gateway and upstream inference-engine status.

Batch CSV headers must be: `age,sex,cp,trestbps,chol,fbs,restecg,thalach,exang,oldpeak,slope,ca,thal`.

## Important clinical note

This project is a research/decision-support prototype, not a medical device or diagnostic service. Model output must not replace clinician judgement or emergency care. Do not upload identifiable patient data unless the deployment is authorized and appropriately secured.
