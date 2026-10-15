// CardioPulse-K8s Interactive Application Engine

let biomarkerChart = null;
const GATEWAY_URL = "/api"; // Proxied via Nginx to http://cardiopulse-gateway-svc:5000

document.addEventListener("DOMContentLoaded", () => {
    initECGAnimation();
    initSliders();
    initTabs();
    initForm();
    initBatchUpload();
    initDiagnostics();
    initBiomarkerChart();
});

// ==========================================
// 1. Live Animated ECG Heartbeat Canvas
// ==========================================
function initECGAnimation() {
    const canvas = document.getElementById("ecgCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    window.addEventListener("resize", () => {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    });

    const points = [];
    const maxPoints = Math.floor(width / 2);
    let step = 0;

    function getEcgY(t) {
        const cycle = t % 100;
        const mid = height / 2;
        if (cycle > 35 && cycle < 40) return mid - 12; // P wave
        if (cycle > 45 && cycle < 48) return mid + 8;  // Q wave
        if (cycle >= 48 && cycle <= 52) return mid - 32; // R peak
        if (cycle > 52 && cycle < 55) return mid + 16;  // S wave
        if (cycle > 65 && cycle < 75) return mid - 14; // T wave
        return mid + (Math.sin(t * 0.1) * 2);          // Baseline jitter
    }

    function animate() {
        ctx.fillStyle = "rgba(7, 10, 18, 0.2)";
        ctx.fillRect(0, 0, width, height);

        step += 1;
        const newY = getEcgY(step);
        points.push(newY);

        if (points.length > maxPoints) {
            points.shift();
        }

        ctx.strokeStyle = "#e63946";
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(230, 57, 70, 0.8)";
        ctx.beginPath();

        for (let i = 0; i < points.length; i++) {
            const x = i * 2;
            const y = points[i];
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Pulsing leading dot
        if (points.length > 0) {
            const headX = (points.length - 1) * 2;
            const headY = points[points.length - 1];
            ctx.fillStyle = "#ffffff";
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#e63946";
            ctx.beginPath();
            ctx.arc(headX, headY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    animate();
}

// ==========================================
// 2. Synchronized Live Slider Values
// ==========================================
function initSliders() {
    const sliders = [
        { id: "age", valId: "val-age", unit: " yrs" },
        { id: "trestbps", valId: "val-trestbps", unit: " mm Hg" },
        { id: "chol", valId: "val-chol", unit: " mg/dl" },
        { id: "thalach", valId: "val-thalach", unit: " bpm" },
        { id: "oldpeak", valId: "val-oldpeak", unit: " mm" }
    ];

    sliders.forEach(s => {
        const input = document.getElementById(s.id);
        const tag = document.getElementById(s.valId);
        if (input && tag) {
            input.addEventListener("input", (e) => {
                tag.textContent = e.target.value + s.unit;
                updateBiomarkerChartLive();
            });
        }
    });

    document.querySelectorAll(".form-select").forEach(sel => {
        sel.addEventListener("change", updateBiomarkerChartLive);
    });
}

// ==========================================
// 3. Navigation Tabs
// ==========================================
function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    const views = document.querySelectorAll(".tab-view");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            views.forEach(v => v.classList.remove("active"));

            tab.classList.add("active");
            const targetView = document.getElementById(tab.dataset.tab);
            if (targetView) targetView.classList.add("active");
        });
    });
}

// ==========================================
// 4. Radar Chart for Biometrics
// ==========================================
function initBiomarkerChart() {
    const ctx = document.getElementById("biomarkerChart");
    if (!ctx) return;

    biomarkerChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Age Ratio', 'Resting BP', 'Cholesterol', 'Max HR', 'ST Depression', 'Vessels'],
            datasets: [{
                label: 'Patient Biomarker Indices',
                data: [55, 65, 60, 75, 40, 30],
                backgroundColor: 'rgba(230, 57, 70, 0.25)',
                borderColor: '#e63946',
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#e63946',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: {
                        color: '#94a3b8',
                        font: { size: 10, family: 'Plus Jakarta Sans' }
                    },
                    ticks: { display: false, max: 100, min: 0 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateBiomarkerChartLive() {
    if (!biomarkerChart) return;
    const age = (parseFloat(document.getElementById("age")?.value || 55) / 80) * 100;
    const bp = (parseFloat(document.getElementById("trestbps")?.value || 130) / 200) * 100;
    const chol = (parseFloat(document.getElementById("chol")?.value || 240) / 400) * 100;
    const hr = (parseFloat(document.getElementById("thalach")?.value || 150) / 220) * 100;
    const oldpeak = (parseFloat(document.getElementById("oldpeak")?.value || 1.2) / 6.0) * 100;
    const ca = ((parseFloat(document.getElementById("ca")?.value || 0) + 1) / 4) * 100;

    biomarkerChart.data.datasets[0].data = [
        Math.min(100, age),
        Math.min(100, bp),
        Math.min(100, chol),
        Math.min(100, hr),
        Math.min(100, oldpeak),
        Math.min(100, ca)
    ];
    biomarkerChart.update();
}

// ==========================================
// 5. Patient Triage Form Submission
// ==========================================
function initForm() {
    const form = document.getElementById("triageForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const btn = document.getElementById("submitBtn");
        const btnText = document.getElementById("btnText");
        btn.disabled = true;
        btnText.textContent = "Dispatching via K8s Gateway...";

        const payload = {
            features: {
                age: parseFloat(document.getElementById("age").value),
                sex: parseFloat(document.getElementById("sex").value),
                cp: parseFloat(document.getElementById("cp").value),
                trestbps: parseFloat(document.getElementById("trestbps").value),
                chol: parseFloat(document.getElementById("chol").value),
                fbs: parseFloat(document.getElementById("fbs").value),
                restecg: parseFloat(document.getElementById("restecg").value),
                thalach: parseFloat(document.getElementById("thalach").value),
                exang: parseFloat(document.getElementById("exang").value),
                oldpeak: parseFloat(document.getElementById("oldpeak").value),
                slope: parseFloat(document.getElementById("slope").value),
                ca: parseFloat(document.getElementById("ca").value),
                thal: parseFloat(document.getElementById("thal").value)
            }
        };

        try {
            const resp = await fetch(`${GATEWAY_URL}/v1/triage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) throw new Error(`Gateway returned HTTP ${resp.status}`);

            const data = await resp.json();
            renderTriageResults(data.payload.results);
        } catch (err) {
            console.error(err);
            alert(`Inference failed: ${err.message}. Ensure Kubernetes cluster is running.`);
        } finally {
            btn.disabled = false;
            btnText.textContent = "Run Clinical Risk Assessment";
        }
    });
}

function renderTriageResults(res) {
    const risk = res.risk_probability;
    const cat = res.triage_category;
    const rec = res.clinical_recommendation;

    // 1. Update Gauge Number
    const numDisplay = document.getElementById("gaugeScore");
    numDisplay.textContent = `${risk.toFixed(1)}%`;

    // 2. Animate SVG Arc
    const circle = document.getElementById("gaugeBar");
    const circumference = 283;
    const offset = circumference - ((risk / 100) * circumference);
    circle.style.strokeDashoffset = offset;

    // Color coordination
    const badge = document.getElementById("triageBadge");
    badge.className = "triage-badge-pill";

    if (risk >= 65) {
        circle.style.stroke = "#ef233c";
        numDisplay.style.color = "#ef233c";
        badge.classList.add("triage-high");
        badge.innerHTML = `<span class="pulse-dot" style="background:#ef233c; box-shadow:0 0 10px #ef233c;"></span> CRITICAL ALERT: ${cat}`;
    } else if (risk >= 35) {
        circle.style.stroke = "#ffb703";
        numDisplay.style.color = "#ffb703";
        badge.classList.add("triage-mod");
        badge.innerHTML = `<span class="pulse-dot" style="background:#ffb703; box-shadow:0 0 10px #ffb703;"></span> MODERATE RISK: ${cat}`;
    } else {
        circle.style.stroke = "#06d6a0";
        numDisplay.style.color = "#06d6a0";
        badge.classList.add("triage-low");
        badge.innerHTML = `<span class="pulse-dot"></span> LOW RISK: ${cat}`;
    }

    // 3. Clinical Recommendation Card
    document.getElementById("recText").textContent = rec;
}

// ==========================================
// 6. Batch Screening Upload
// ==========================================
function initBatchUpload() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("csvFile");
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", () => fileInput.click());

    ["dragenter", "dragover"].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length) handleCsvFile(files[0]);
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) handleCsvFile(e.target.files[0]);
    });
}

function handleCsvFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const rows = text.trim().split("\n").map(r => r.split(","));
        if (rows.length < 2) return alert("CSV must have headers and records!");

        const headers = rows[0].map(h => h.trim());
        const records = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].map(v => parseFloat(v.trim()));
            const obj = {};
            headers.forEach((h, idx) => obj[h] = vals[idx]);
            records.push(obj);
        }

        const tableBody = document.getElementById("batchTableBody");
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">⚡ Evaluating ${records.length} patients in Kubernetes cluster...</td></tr>`;

        try {
            const resp = await fetch(`${GATEWAY_URL}/v1/triage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patients: records })
            });

            const data = await resp.json();
            const results = data.payload.results;

            tableBody.innerHTML = "";
            results.forEach((r, idx) => {
                const recColor = r.risk_probability >= 65 ? "#ef233c" : (r.risk_probability >= 35 ? "#ffb703" : "#06d6a0");
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>#${idx + 1}</strong></td>
                    <td>${records[idx].age}y (${records[idx].sex === 1 ? 'M' : 'F'})</td>
                    <td>${records[idx].trestbps} / ${records[idx].chol}</td>
                    <td style="color:${recColor}; font-weight:700;">${r.risk_probability.toFixed(1)}%</td>
                    <td><span class="triage-badge-pill" style="padding:2px 10px; font-size:0.75rem; border:1px solid ${recColor}; color:${recColor};">${r.triage_category}</span></td>
                    <td style="font-size:0.8rem; color:#94a3b8;">${r.clinical_recommendation}</td>
                `;
                tableBody.appendChild(tr);
            });
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="6" style="color:#ef233c; text-align:center;">Failed to process batch: ${err.message}</td></tr>`;
        }
    };
    reader.readAsText(file);
}

// ==========================================
// 7. Cluster Health Diagnostics
// ==========================================
function initDiagnostics() {
    const btn = document.getElementById("refreshDiagBtn");
    if (!btn) return;

    btn.addEventListener("click", fetchClusterDiagnostics);
    fetchClusterDiagnostics(); // Initial check
}

async function fetchClusterDiagnostics() {
    const rawPre = document.getElementById("rawDiagnosticsJson");
    const pingTag = document.getElementById("gatewayPing");
    const mlStatusTag = document.getElementById("mlEngineStatus");

    try {
        const start = performance.now();
        const resp = await fetch(`/api/healthz`);
        const latency = Math.round(performance.now() - start);

        if (resp.ok) {
            const data = await resp.json();
            rawPre.textContent = JSON.stringify(data, null, 2);
            pingTag.textContent = `${latency} ms`;
            mlStatusTag.textContent = data.upstream_ml_engine.status.toUpperCase();
            mlStatusTag.style.color = data.upstream_ml_engine.status === "healthy" ? "#06d6a0" : "#ef233c";
        } else {
            throw new Error(`HTTP ${resp.status}`);
        }
    } catch (err) {
        rawPre.textContent = `Diagnostic ping failed: ${err.message}`;
        pingTag.textContent = "OFFLINE";
        mlStatusTag.textContent = "UNREACHABLE";
    }
}
