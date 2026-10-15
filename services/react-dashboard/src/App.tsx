import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  Users, 
  Server, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  RefreshCw, 
  FileSpreadsheet,
  Stethoscope,
  BarChart3,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';
import './App.css';

interface PatientData {
  age: number;
  sex: number;
  cp: number;
  trestbps: number;
  chol: number;
  fbs: number;
  restecg: number;
  thalach: number;
  exang: number;
  oldpeak: number;
  slope: number;
  ca: number;
  thal: number;
}

interface TriageResult {
  risk_probability: number;
  prediction_label: number;
  triage_category: string;
  clinical_recommendation: string;
}

interface BatchRecord extends PatientData {
  id: number;
  risk_probability?: number;
  triage_category?: string;
  clinical_recommendation?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'triage' | 'batch' | 'cluster'>('triage');
  const [loading, setLoading] = useState(false);

  // Patient Input Form State
  const [patient, setPatient] = useState<PatientData>({
    age: 55,
    sex: 1,
    cp: 4,
    trestbps: 130,
    chol: 240,
    fbs: 0,
    restecg: 0,
    thalach: 150,
    exang: 0,
    oldpeak: 1.2,
    slope: 2,
    ca: 0,
    thal: 3
  });

  // Triage Outcome
  const [result, setResult] = useState<TriageResult>({
    risk_probability: 28.4,
    prediction_label: 0,
    triage_category: 'Low Risk',
    clinical_recommendation: 'Maintain regular cardiovascular exercise and routine annual screening.'
  });

  // Batch State
  const [batchList, setBatchList] = useState<BatchRecord[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Diagnostics State
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Run initial prediction on load
  useEffect(() => {
    fetchClusterHealth();
  }, []);

  const handleInputChange = (field: keyof PatientData, value: number) => {
    setPatient(prev => ({ ...prev, [field]: value }));
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resp = await fetch('/api/v1/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: patient })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const outcome = data.payload.results;
      setResult(outcome);

      if (outcome.risk_probability < 35) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      }
    } catch (err: any) {
      alert(`API Error: ${err.message}. Please check cluster health.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterHealth = async () => {
    try {
      const start = performance.now();
      const resp = await fetch('/api/healthz');
      const latency = Math.round(performance.now() - start);
      setPingLatency(latency);
      if (resp.ok) {
        const data = await resp.json();
        setClusterInfo(data);
      }
    } catch {
      setPingLatency(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim());
      const records: BatchRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => parseFloat(v.trim()));
        const obj: any = { id: i };
        headers.forEach((h, idx) => {
          obj[h] = vals[idx];
        });
        records.push(obj);
      }

      setBatchLoading(true);
      try {
        const resp = await fetch('/api/v1/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patients: records })
        });
        const data = await resp.json();
        const results = data.payload.results;

        const merged = records.map((r, idx) => ({
          ...r,
          risk_probability: results[idx]?.risk_probability || 0,
          triage_category: results[idx]?.triage_category || 'N/A',
          clinical_recommendation: results[idx]?.clinical_recommendation || 'N/A'
        }));
        setBatchList(merged);
      } catch (err: any) {
        alert(`Batch scoring failed: ${err.message}`);
      } finally {
        setBatchLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // SVG Gauge calculations
  const circumference = 283;
  const strokeOffset = circumference - ((result.risk_probability / 100) * circumference);

  const getRiskColor = (prob: number) => {
    if (prob >= 65) return '#f43f5e';
    if (prob >= 35) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div className="brand-header">
            <div className="brand-icon-box">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <div className="brand-title">Cardio<span>Pulse</span></div>
              <div className="brand-subtitle">AI CLINICAL TRIAGE</div>
            </div>
          </div>

          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'triage' ? 'active' : ''}`}
              onClick={() => setActiveTab('triage')}
            >
              <Activity className="w-4 h-4" />
              Patient Triage
            </button>
            <button 
              className={`nav-item ${activeTab === 'batch' ? 'active' : ''}`}
              onClick={() => setActiveTab('batch')}
            >
              <Users className="w-4 h-4" />
              Batch Screening
            </button>
            <button 
              className={`nav-item ${activeTab === 'cluster' ? 'active' : ''}`}
              onClick={() => setActiveTab('cluster')}
            >
              <Server className="w-4 h-4" />
              Cluster Diagnostics
            </button>
          </nav>
        </div>

        {/* Sidebar Patient Profile Card */}
        <div className="sidebar-patient-card">
          <div className="patient-header">
            <div className="patient-avatar">CP</div>
            <div className="patient-meta">
              <h4>Dr. J. Kalbi (Lead)</h4>
              <p>Cardiology Ward 4B</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="main-viewport">
        {/* Top App Bar */}
        <header className="top-bar">
          <div className="top-bar-title">
            <h2>Cardiovascular Clinical Risk Platform</h2>
            <p>Cloud-Native Kubernetes Microservices • Calibrated Ensemble Engine</p>
          </div>

          <div className="top-bar-stats">
            <div className="health-badge">
              <span className="pulse-dot"></span>
              K8S CLUSTER: LIVE
            </div>
          </div>
        </header>

        {/* Body Container */}
        <main className="content-body">

          {/* Quick Metrics Cards */}
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-info">
                <h5>Blood Pressure</h5>
                <p>{patient.trestbps} <span style={{fontSize:'0.8rem'}}>mmHg</span></p>
                <span>Systolic Resting</span>
              </div>
              <div className="metric-icon-box" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <Stethoscope className="w-5 h-5" />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <h5>Cholesterol</h5>
                <p>{patient.chol} <span style={{fontSize:'0.8rem'}}>mg/dL</span></p>
                <span>Serum Total</span>
              </div>
              <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <h5>Max Heart Rate</h5>
                <p>{patient.thalach} <span style={{fontSize:'0.8rem'}}>bpm</span></p>
                <span>Achieved Cardiac</span>
              </div>
              <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <Heart className="w-5 h-5" />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <h5>ST Depression</h5>
                <p>{patient.oldpeak.toFixed(1)} <span style={{fontSize:'0.8rem'}}>mm</span></p>
                <span>Exercise Induced</span>
              </div>
              <div className="metric-icon-box" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Tab 1: Single Patient Triage */}
          {activeTab === 'triage' && (
            <div className="triage-layout">
              {/* Form Card */}
              <div className="card-panel">
                <div className="card-panel-header">
                  <div className="card-panel-title">
                    <Stethoscope className="w-4 h-4 text-rose-500" />
                    Patient Biomarker Parameters
                  </div>
                  <span className="field-badge">UCI DATASET</span>
                </div>

                <div className="card-panel-body">
                  <form onSubmit={handleTriageSubmit}>
                    
                    <div className="form-section-header">01 • Demographics & Baseline</div>
                    <div className="form-grid-3">
                      <div className="field-wrapper">
                        <div className="field-top-row">
                          <span>Patient Age</span>
                          <span className="field-badge">{patient.age} yrs</span>
                        </div>
                        <input 
                          type="range" min="20" max="85" value={patient.age}
                          onChange={(e) => handleInputChange('age', parseInt(e.target.value))}
                        />
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">Biological Sex</div>
                        <select 
                          className="form-control-select" 
                          value={patient.sex}
                          onChange={(e) => handleInputChange('sex', parseInt(e.target.value))}
                        >
                          <option value="1">Male</option>
                          <option value="0">Female</option>
                        </select>
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">Chest Pain Type</div>
                        <select 
                          className="form-control-select"
                          value={patient.cp}
                          onChange={(e) => handleInputChange('cp', parseInt(e.target.value))}
                        >
                          <option value="3">Typical Angina (Type 1)</option>
                          <option value="1">Atypical Angina (Type 2)</option>
                          <option value="2">Non-Anginal Discomfort (Type 3)</option>
                          <option value="4">Asymptomatic (Type 4)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-section-header">02 • Hemodynamics & Stress Scan</div>
                    <div className="form-grid-3">
                      <div className="field-wrapper">
                        <div className="field-top-row">
                          <span>Resting BP</span>
                          <span className="field-badge">{patient.trestbps} mm Hg</span>
                        </div>
                        <input 
                          type="range" min="90" max="200" value={patient.trestbps}
                          onChange={(e) => handleInputChange('trestbps', parseInt(e.target.value))}
                        />
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">
                          <span>Serum Cholesterol</span>
                          <span className="field-badge">{patient.chol} mg/dL</span>
                        </div>
                        <input 
                          type="range" min="120" max="420" value={patient.chol}
                          onChange={(e) => handleInputChange('chol', parseInt(e.target.value))}
                        />
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">
                          <span>Max Heart Rate</span>
                          <span className="field-badge">{patient.thalach} bpm</span>
                        </div>
                        <input 
                          type="range" min="70" max="210" value={patient.thalach}
                          onChange={(e) => handleInputChange('thalach', parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="form-section-header">03 • Fluoroscopy & Diagnostics</div>
                    <div className="form-grid-3">
                      <div className="field-wrapper">
                        <div className="field-top-row">
                          <span>ST Depression</span>
                          <span className="field-badge">{patient.oldpeak.toFixed(1)} mm</span>
                        </div>
                        <input 
                          type="range" min="0.0" max="6.2" step="0.1" value={patient.oldpeak}
                          onChange={(e) => handleInputChange('oldpeak', parseFloat(e.target.value))}
                        />
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">Exercise Angina</div>
                        <select 
                          className="form-control-select"
                          value={patient.exang}
                          onChange={(e) => handleInputChange('exang', parseInt(e.target.value))}
                        >
                          <option value="0">Negative (No)</option>
                          <option value="1">Positive (Yes)</option>
                        </select>
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">Fasting Blood Sugar &gt; 120</div>
                        <select 
                          className="form-control-select"
                          value={patient.fbs}
                          onChange={(e) => handleInputChange('fbs', parseInt(e.target.value))}
                        >
                          <option value="0">Normal (≤ 120 mg/dL)</option>
                          <option value="1">Elevated (&gt; 120 mg/dL)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-grid-3" style={{ marginTop: '1.2rem' }}>
                      <div className="field-wrapper">
                        <div className="field-top-row">Resting ECG</div>
                        <select 
                          className="form-control-select"
                          value={patient.restecg}
                          onChange={(e) => handleInputChange('restecg', parseInt(e.target.value))}
                        >
                          <option value="0">Normal</option>
                          <option value="1">ST-T Wave Abnormality</option>
                          <option value="2">Left Ventricular Hypertrophy</option>
                        </select>
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">ST Segment Slope</div>
                        <select 
                          className="form-control-select"
                          value={patient.slope}
                          onChange={(e) => handleInputChange('slope', parseInt(e.target.value))}
                        >
                          <option value="1">Upsloping</option>
                          <option value="2">Flat</option>
                          <option value="3">Downsloping</option>
                        </select>
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">Major Vessels (0-3)</div>
                        <select 
                          className="form-control-select"
                          value={patient.ca}
                          onChange={(e) => handleInputChange('ca', parseInt(e.target.value))}
                        >
                          <option value="0">0 Vessels</option>
                          <option value="1">1 Vessel</option>
                          <option value="2">2 Vessels</option>
                          <option value="3">3 Vessels</option>
                        </select>
                      </div>

                      <div className="field-wrapper">
                        <div className="field-top-row">Thallium Defect</div>
                        <select 
                          className="form-control-select"
                          value={patient.thal}
                          onChange={(e) => handleInputChange('thal', parseInt(e.target.value))}
                        >
                          <option value="3">Normal Perfusion</option>
                          <option value="6">Fixed Defect</option>
                          <option value="7">Reversible Defect</option>
                        </select>
                      </div>
                    </div>

                    <button type="submit" className="btn-submit-triage" disabled={loading}>
                      <ChevronRight className="w-5 h-5" />
                      {loading ? 'Evaluating via Kubernetes...' : 'Calculate Cardiovascular Risk Stratification'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Prediction Card */}
              <div className="card-panel">
                <div className="card-panel-header">
                  <div className="card-panel-title">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    AI Triage Stratification
                  </div>
                  <span className="field-badge" style={{ color: '#10b981' }}>CALIBRATED RF</span>
                </div>

                <div className="card-panel-body" style={{ textAlign: 'center' }}>
                  {/* Dribbble Radial Arc Meter */}
                  <div className="radial-dial-box">
                    <svg className="radial-svg" viewBox="0 0 200 110">
                      <path className="radial-track" d="M 20 100 A 80 80 0 0 1 180 100"></path>
                      <path 
                        className="radial-progress" 
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        style={{
                          strokeDashoffset: strokeOffset,
                          stroke: getRiskColor(result.risk_probability)
                        }}
                      ></path>
                    </svg>

                    <div className="radial-center">
                      <div className="radial-value" style={{ color: getRiskColor(result.risk_probability) }}>
                        {result.risk_probability.toFixed(1)}%
                      </div>
                      <div className="radial-caption">Calculated Probability</div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className={`risk-pill ${
                    result.risk_probability >= 65 ? 'risk-pill-high' : 
                    result.risk_probability >= 35 ? 'risk-pill-mod' : 'risk-pill-low'
                  }`}>
                    {result.risk_probability >= 65 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {result.triage_category.toUpperCase()}
                  </div>

                  {/* Recommendation Panel */}
                  <div className="recommendation-panel">
                    <h6>Recommended Clinical Action</h6>
                    <p>{result.clinical_recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Batch Screening */}
          {activeTab === 'batch' && (
            <div className="card-panel">
              <div className="card-panel-header">
                <div className="card-panel-title">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  Cohort Screening (Batch CSV Upload)
                </div>
                <a href="/data/sample_patients.csv" download className="field-badge" style={{ textDecoration: 'none' }}>
                  📥 Download Sample CSV
                </a>
              </div>

              <div className="card-panel-body">
                <label className="upload-dropzone">
                  <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  <Upload className="upload-icon" />
                  <h4>Drag & Drop Patient CSV Cohort</h4>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                    Automatically scored by the Kubernetes ML Inference Engine
                  </p>
                </label>

                {batchLoading && (
                  <p style={{ textAlign: 'center', margin: '2rem', color: '#38bdf8' }}>
                    ⚡ Scoring patient cohort in Kubernetes cluster...
                  </p>
                )}

                {batchList.length > 0 && (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>DEMOGRAPHICS</th>
                          <th>HEMODYNAMICS</th>
                          <th>RISK PROBABILITY</th>
                          <th>TRIAGE STATUS</th>
                          <th>RECOMMENDATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchList.map((p) => {
                          const prob = p.risk_probability || 0;
                          const color = getRiskColor(prob);
                          return (
                            <tr key={p.id}>
                              <td><strong>#{p.id}</strong></td>
                              <td>{p.age} yrs ({p.sex === 1 ? 'Male' : 'Female'})</td>
                              <td>{p.trestbps} / {p.chol} mmHg</td>
                              <td style={{ color: color, fontWeight: 700 }}>{prob.toFixed(1)}%</td>
                              <td>
                                <span className="field-badge" style={{ color: color, borderColor: color }}>
                                  {p.triage_category}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                {p.clinical_recommendation}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Cluster Diagnostics */}
          {activeTab === 'cluster' && (
            <div>
              <div className="cluster-cards-grid">
                <div className="cluster-card">
                  <div className="cluster-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="cluster-details">
                    <h6>Gateway Ping Latency</h6>
                    <p style={{ color: '#10b981' }}>{pingLatency ? `${pingLatency} ms` : 'Offline'}</p>
                  </div>
                </div>

                <div className="cluster-card">
                  <div className="cluster-icon" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div className="cluster-details">
                    <h6>Core ML Engine</h6>
                    <p style={{ color: '#f43f5e' }}>ONLINE (2x)</p>
                  </div>
                </div>

                <div className="cluster-card">
                  <div className="cluster-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <Server className="w-5 h-5" />
                  </div>
                  <div className="cluster-details">
                    <h6>Kubernetes Pods</h6>
                    <p style={{ color: '#3b82f6' }}>5 REPLICAS</p>
                  </div>
                </div>
              </div>

              <div className="card-panel">
                <div className="card-panel-header">
                  <div className="card-panel-title">
                    <Server className="w-4 h-4 text-blue-400" />
                    Live Cluster Telemetry
                  </div>
                  <button onClick={fetchClusterHealth} className="field-badge" style={{ cursor: 'pointer', background: 'transparent' }}>
                    <RefreshCw className="w-3 h-3 inline mr-1" /> Re-probe
                  </button>
                </div>
                <div className="card-panel-body">
                  <pre className="terminal-telemetry">
                    {clusterInfo ? JSON.stringify(clusterInfo, null, 2) : 'Connecting to cluster gateway...'}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
