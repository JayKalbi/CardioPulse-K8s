# ========================================================
# CardioPulse-K8s Automated Deployment & Healthcheck Script
# ========================================================

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   Starting CardioPulse-K8s Cluster Setup     " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Check Minikube
Write-Host "`n[1/4] Verifying Minikube Cluster..." -ForegroundColor Yellow
$status = minikube status --format='{{.Host}}' 2>$null
if ($status -ne "Running") {
    Write-Host "Starting Minikube..." -ForegroundColor Green
    minikube start
} else {
    Write-Host "Minikube is already running." -ForegroundColor Green
}

# 2. Apply Manifests
Write-Host "`n[2/4] Applying Kubernetes Manifests..." -ForegroundColor Yellow
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/03-ml-inference-deployment.yaml
kubectl apply -f k8s/04-api-gateway-deployment.yaml
kubectl apply -f k8s/05-web-dashboard-deployment.yaml
kubectl apply -f k8s/06-hpa.yaml

# 3. Wait for Pods
Write-Host "`n[3/4] Waiting for Deployments to become Ready..." -ForegroundColor Yellow
kubectl rollout status deployment/cardiopulse-ml-engine-deployment -n cardiopulse-prod --timeout=90s
kubectl rollout status deployment/cardiopulse-gateway-deployment -n cardiopulse-prod --timeout=90s
kubectl rollout status deployment/cardiopulse-web-dashboard-deployment -n cardiopulse-prod --timeout=90s

# 4. Launch Service
Write-Host "`n[4/4] Launching CardioPulse Web Dashboard..." -ForegroundColor Green
Write-Host "Opening tunnel in browser..." -ForegroundColor Cyan
minikube service cardiopulse-web-dashboard-svc -n cardiopulse-prod
