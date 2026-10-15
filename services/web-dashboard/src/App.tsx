import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Check,
  CircleHelp, Clock3, Cloud, Download, FileSpreadsheet, HeartPulse, LayoutDashboard, Menu,
  MoreHorizontal, Network, RefreshCw, Search, ShieldCheck, Stethoscope,
  Upload, Users, X, Zap,
} from 'lucide-react';
import Papa from 'papaparse';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { assessBatch, assessPatient, getHealth } from './api';
import { FEATURE_COLUMNS, type ClinicalFeatures, type HealthResponse, type PredictionResult } from './types';

const initialFeatures: ClinicalFeatures = {
  age: 55, sex: 1, cp: 3, trestbps: 130, chol: 240, fbs: 0, restecg: 0,
  thalach: 150, exang: 0, oldpeak: 1.2, slope: 2, ca: 0, thal: 3,
};
const fieldLabels: Record<keyof ClinicalFeatures, string> = {
  age: 'Age', sex: 'Sex', cp: 'Chest pain type', trestbps: 'Resting blood pressure', chol: 'Serum cholesterol',
  fbs: 'Fasting blood sugar > 120', restecg: 'Resting ECG', thalach: 'Maximum heart rate', exang: 'Exercise-induced angina',
  oldpeak: 'ST depression (oldpeak)', slope: 'Peak exercise ST slope', ca: 'Major vessels (fluoroscopy)', thal: 'Thalassemia',
};
const enumOptions: Partial<Record<keyof ClinicalFeatures, { label: string; value: number }[]>> = {
  sex: [{ label: 'Female', value: 0 }, { label: 'Male', value: 1 }],
  cp: [{ label: 'Typical angina · 1', value: 1 }, { label: 'Atypical angina · 2', value: 2 }, { label: 'Non-anginal pain · 3', value: 3 }, { label: 'Asymptomatic · 4', value: 4 }],
  fbs: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }],
  restecg: [{ label: 'Normal', value: 0 }, { label: 'ST-T abnormality', value: 1 }, { label: 'LV hypertrophy', value: 2 }],
  exang: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }],
  slope: [{ label: 'Upsloping · 1', value: 1 }, { label: 'Flat · 2', value: 2 }, { label: 'Downsloping · 3', value: 3 }],
  ca: [0, 1, 2, 3].map(value => ({ label: String(value), value })),
  thal: [{ label: 'Normal · 3', value: 3 }, { label: 'Fixed defect · 6', value: 6 }, { label: 'Reversible defect · 7', value: 7 }],
};
type Page = 'overview' | 'assessment' | 'batch' | 'operations';
type BatchRow = ClinicalFeatures & { risk_probability?: number; triage_category?: string; prediction_label?: number; clinical_recommendation?: string };
const demoTrend = [{ day: 'Mon', assessments: 28 }, { day: 'Tue', assessments: 34 }, { day: 'Wed', assessments: 31 }, { day: 'Thu', assessments: 45 }, { day: 'Fri', assessments: 39 }, { day: 'Sat', assessments: 52 }, { day: 'Sun', assessments: 48 }];

function riskClass(category?: string) {
  if (category === 'High Risk') return 'high';
  if (category === 'Moderate Risk') return 'moderate';
  return 'low';
}
function formatPercent(value: number) { return `${Number(value).toFixed(1)}%`; }
function normalizeResults(result: PredictionResult | PredictionResult[]): PredictionResult[] { return Array.isArray(result) ? result : [result]; }
function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8;') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
function RiskBadge({ category }: { category?: string }) { return <span className={`risk-badge ${riskClass(category)}`}><span />{category || 'Not assessed'}</span>; }
function MetricCard({ label, value, note, icon, trend }: { label: string; value: string; note: string; icon: React.ReactNode; trend?: 'up' | 'down' }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}</div><div className="metric-note">{trend === 'up' ? <ArrowUpRight size={14} /> : trend === 'down' ? <ArrowDownRight size={14} /> : <span className="metric-dot" />}{note}</div></article>;
}

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [features, setFeatures] = useState<ClinicalFeatures>(initialFeatures);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchResults, setBatchResults] = useState<BatchRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [fileName, setFileName] = useState('');
  const [toast, setToast] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true); setHealthError('');
    try { setHealth(await getHealth()); } catch (error) { setHealth(null); setHealthError(error instanceof Error ? error.message : 'Unable to reach API gateway.'); }
    finally { setHealthLoading(false); }
  }, []);
  useEffect(() => { void refreshHealth(); }, [refreshHealth]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const riskCounts = useMemo(() => {
    const rows = batchResults.length ? batchResults : [];
    return [
      { name: 'Low risk', value: rows.filter(row => row.triage_category === 'Low Risk').length, color: '#169b83' },
      { name: 'Moderate', value: rows.filter(row => row.triage_category === 'Moderate Risk').length, color: '#e9a23b' },
      { name: 'High risk', value: rows.filter(row => row.triage_category === 'High Risk').length, color: '#e05b65' },
    ];
  }, [batchResults]);
  const filteredBatch = useMemo(() => batchResults.filter(row => {
    const text = `${row.age} ${row.triage_category || ''} ${row.risk_probability ?? ''}`.toLowerCase(); return text.includes(batchSearch.toLowerCase());
  }), [batchResults, batchSearch]);
  const highRiskCount = batchResults.filter(row => row.triage_category === 'High Risk').length;
  const avgRisk = batchResults.length ? batchResults.reduce((sum, row) => sum + (row.risk_probability || 0), 0) / batchResults.length : null;

  async function runAssessment(event: FormEvent) {
    event.preventDefault(); setAssessmentLoading(true); setAssessmentError('');
    try { const response = await assessPatient(features); const result = normalizeResults(response.payload.results)[0]; setPrediction(result); setToast('Risk assessment completed'); }
    catch (error) { setAssessmentError(error instanceof Error ? error.message : 'Assessment failed. Check the API gateway.'); }
    finally { setAssessmentLoading(false); }
  }
  function updateFeature(key: keyof ClinicalFeatures, value: number) { setFeatures(previous => ({ ...previous, [key]: value })); }
  function handleFile(file?: File) {
    if (!file) return;
    setBatchError(''); setBatchResults([]); setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: result => {
        if (result.errors.length) { setBatchError(`Could not parse CSV: ${result.errors[0].message}`); return; }
        const rows = result.data;
        if (!rows.length) { setBatchError('The CSV has no patient rows.'); return; }
        const missing = FEATURE_COLUMNS.filter(column => !Object.prototype.hasOwnProperty.call(rows[0], column));
        if (missing.length) { setBatchError(`Missing required columns: ${missing.join(', ')}`); return; }
        const parsed: BatchRow[] = [];
        for (let index = 0; index < rows.length; index++) {
          const raw = rows[index]; const values = {} as ClinicalFeatures;
          for (const column of FEATURE_COLUMNS) {
            const value = Number(raw[column]);
            if (raw[column] === undefined || raw[column].trim() === '' || !Number.isFinite(value)) { setBatchError(`Row ${index + 2}: ${column} must be a valid number.`); return; }
            values[column] = value;
          }
          parsed.push(values);
        }
        if (parsed.length > 500) { setBatchError('Please upload 500 patients or fewer per request.'); return; }
        setBatchRows(parsed); setToast(`${parsed.length} patient records loaded`);
      }, error: error => setBatchError(error.message),
    });
  }
  async function scoreBatch() {
    if (!batchRows.length) { setBatchError('Upload a valid patient CSV first.'); return; }
    setBatchLoading(true); setBatchError('');
    try {
      const response = await assessBatch(batchRows); const results = normalizeResults(response.payload.results);
      if (results.length !== batchRows.length) throw new Error(`Expected ${batchRows.length} results but received ${results.length}.`);
      const merged = batchRows.map((row, index) => ({ ...row, ...results[index] })); setBatchResults(merged); setToast(`Scored ${merged.length} patient records`);
    } catch (error) { setBatchError(error instanceof Error ? error.message : 'Batch scoring failed.'); }
    finally { setBatchLoading(false); }
  }
  function exportBatch() {
    if (!batchResults.length) return;
    downloadFile('cardiopulse-assessment-results.csv', Papa.unparse(batchResults));
  }

  const pageTitle: Record<Page, string> = { overview: 'Overview', assessment: 'Patient assessment', batch: 'Batch screening', operations: 'System operations' };
  const gatewayHealthy = health?.status === 'healthy';
  const engineHealthy = health?.upstream_ml_engine?.status === 'healthy';

  return <div className="app-shell">
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><HeartPulse size={23} strokeWidth={2.4} /></div><div><strong>CardioPulse</strong><span>CLINICAL INTELLIGENCE</span></div><IconButton label="Close menu" onClick={() => setMobileNav(false)}><X size={18}/></IconButton></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={page === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => { setPage('overview'); setMobileNav(false); }}><LayoutDashboard size={18}/><span>Overview</span></button>
        <button className={page === 'assessment' ? 'nav-item active' : 'nav-item'} onClick={() => { setPage('assessment'); setMobileNav(false); }}><Stethoscope size={18}/><span>Patient assessment</span><span className="nav-count">01</span></button>
        <button className={page === 'batch' ? 'nav-item active' : 'nav-item'} onClick={() => { setPage('batch'); setMobileNav(false); }}><FileSpreadsheet size={18}/><span>Batch screening</span></button>
        <button className={page === 'operations' ? 'nav-item active' : 'nav-item'} onClick={() => { setPage('operations'); setMobileNav(false); }}><Network size={18}/><span>System operations</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status"><div className="status-title"><span className={`status-dot ${gatewayHealthy ? 'online' : 'offline'}`} />Platform status <span className="status-value">{gatewayHealthy ? 'Operational' : 'Check'}</span></div><p>{engineHealthy ? 'All services are responding normally.' : 'Verify gateway and inference connectivity.'}</p><button onClick={() => { setPage('operations'); void refreshHealth(); }}>View system health <ArrowRight size={14}/></button></div>
      <div className="profile"><div className="avatar">CP</div><div className="profile-text"><strong>Clinical workspace</strong><span>Local environment</span></div><MoreHorizontal size={19} className="profile-more"/></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><IconButton label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></IconButton><div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>{pageTitle[page]}</strong></div></div><div className="topbar-right"><div className={`environment-pill ${gatewayHealthy ? 'env-ok' : 'env-warn'}`}><span className="status-dot"/>{gatewayHealthy ? 'API connected' : 'API unavailable'}</div><IconButton label="Refresh service health" onClick={() => void refreshHealth()}><RefreshCw size={17} className={healthLoading ? 'spin' : ''}/></IconButton><IconButton label="Notifications" onClick={() => setToast('No new notifications')}><Bell size={18}/></IconButton><div className="top-avatar">JD</div></div></header>
      <div className="page-content">
        {page === 'overview' && <>
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>CARDIOVASCULAR RISK INTELLIGENCE</div><h1>Good day. <span>Let’s review the data.</span></h1><p>A clear view of assessment activity, model performance and platform health.</p></div><button className="button button-primary" onClick={() => setPage('assessment')}><Stethoscope size={17}/> New assessment <ArrowRight size={16}/></button></section>
          <section className="metric-grid">
            <MetricCard label="Cohort assessed" value={batchResults.length ? batchResults.length.toLocaleString() : '—'} note={batchResults.length ? 'Latest uploaded cohort' : 'Run a batch assessment'} icon={<Users size={19}/>} />
            <MetricCard label="Average predicted risk" value={avgRisk === null ? '—' : formatPercent(avgRisk)} note={avgRisk === null ? 'Awaiting assessment data' : 'Across latest cohort'} icon={<Activity size={19}/>} />
            <MetricCard label="High-risk patients" value={batchResults.length ? String(highRiskCount) : '—'} note={batchResults.length ? `${((highRiskCount / batchResults.length) * 100).toFixed(1)}% of cohort` : 'No cohort scored yet'} icon={<HeartPulse size={19}/>} />
            <MetricCard label="Model ROC-AUC" value="0.9491" note="Reported held-out test result" icon={<BadgeCheck size={19}/>} />
          </section>
          <section className="overview-grid">
            <article className="panel activity-panel"><div className="panel-heading"><div><h2>Assessment activity</h2><p>Weekly activity preview</p></div><span className="subtle-pill"><Clock3 size={13}/> Illustrative data</span></div><div className="chart-summary"><strong>Assessment volume</strong><span>Example trend · not live telemetry</span></div><div className="activity-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={demoTrend} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#168c83" stopOpacity={0.22}/><stop offset="95%" stopColor="#168c83" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid stroke="#edf0f4" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b95a5', fontSize: 12 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b95a5', fontSize: 12 }}/><Tooltip contentStyle={{ border: '1px solid #e5eaf0', borderRadius: 12, boxShadow: '0 8px 24px #1e293b12' }}/><Area type="monotone" dataKey="assessments" stroke="#168c83" strokeWidth={2.5} fill="url(#activityFill)" activeDot={{ r: 5, fill: '#168c83', stroke: '#fff', strokeWidth: 2 }}/></AreaChart></ResponsiveContainer></div><div className="chart-footer"><span><span className="legend-dot teal"/> Assessments</span><span>Replace with persisted backend metrics when available</span></div></article>
            <article className="panel risk-panel"><div className="panel-heading"><div><h2>Latest cohort risk</h2><p>Risk stratification</p></div><span className="panel-icon"><ShieldCheck size={18}/></span></div>{batchResults.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={riskCounts} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={4} stroke="none">{riskCounts.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{batchResults.length}</strong><span>patients</span></div></div><div className="risk-legend">{riskCounts.map(item => <div key={item.name}><span className="legend-left"><span className="legend-dot" style={{ background: item.color }}/>{item.name}</span><strong>{item.value}</strong></div>)}</div></> : <div className="empty-chart"><div className="empty-icon"><Activity size={22}/></div><strong>Your cohort summary appears here</strong><p>Score a patient batch to see its risk distribution.</p><button className="text-button" onClick={() => setPage('batch')}>Go to batch screening <ArrowRight size={14}/></button></div>}</article>
          </section>
          <section className="bottom-grid"><article className="panel model-panel"><div className="panel-heading"><div><h2>Model performance</h2><p>Reported evaluation metrics</p></div><span className="subtle-pill">Held-out test set</span></div><div className="model-metrics"><div><span>ROC-AUC</span><strong>0.9491</strong><div className="mini-track"><span style={{ width: '94.91%' }}/></div></div><div><span>Accuracy</span><strong>86.89%</strong><div className="mini-track"><span style={{ width: '86.89%' }}/></div></div><div><span>F1 score</span><strong>0.8621</strong><div className="mini-track"><span style={{ width: '86.21%' }}/></div></div></div><p className="fine-print"><CircleHelp size={13}/> Values are from the repository's evaluation_metrics.json, not a live model benchmark.</p></article>
            <article className="panel service-panel"><div className="panel-heading"><div><h2>Service health</h2><p>Last checked on demand</p></div><IconButton label="Refresh service health" onClick={() => void refreshHealth()}><RefreshCw size={16} className={healthLoading ? 'spin' : ''}/></IconButton></div><ServiceRow title="Web dashboard" subtitle="React · Nginx" status="healthy"/><ServiceRow title="API gateway" subtitle="Orchestration layer" status={gatewayHealthy ? 'healthy' : 'unavailable'}/><ServiceRow title="ML inference engine" subtitle="Calibrated Random Forest" status={engineHealthy ? 'healthy' : healthLoading ? 'checking' : 'unavailable'}/>{healthError && <p className="service-error">{healthError}</p>}<button className="text-button" onClick={() => setPage('operations')}>Open diagnostics <ArrowRight size={14}/></button></article></section>
          <div className="disclaimer"><ShieldCheck size={16}/><p><strong>Clinical decision support only.</strong> This model output is an estimate, not a diagnosis. It must not replace professional clinical assessment or emergency care.</p></div>
        </>}

        {page === 'assessment' && <>
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>INDIVIDUAL SCREENING</div><h1>Patient assessment</h1><p>Enter the 13 clinical features expected by the deployed inference pipeline.</p></div><span className="subtle-pill"><ShieldCheck size={14}/> Validated input schema</span></section>
          <form onSubmit={runAssessment} className="assessment-layout"><div className="panel form-panel"><div className="panel-heading"><div><h2>Clinical parameters</h2><p>Use recorded clinical measurements and coded categories.</p></div><span className="step-count">13 FEATURES</span></div><div className="form-section"><div className="form-section-title"><span>01</span><div><strong>Patient profile</strong><p>Demographic information</p></div></div><div className="fields-grid">{(['age', 'sex'] as (keyof ClinicalFeatures)[]).map(key => <Field key={key} field={key} value={features[key]} onChange={updateFeature}/>)}</div></div><div className="form-section"><div className="form-section-title"><span>02</span><div><strong>Vitals & laboratory</strong><p>Measurements from clinical examination</p></div></div><div className="fields-grid">{(['trestbps', 'chol', 'fbs', 'thalach'] as (keyof ClinicalFeatures)[]).map(key => <Field key={key} field={key} value={features[key]} onChange={updateFeature}/>)}</div></div><div className="form-section"><div className="form-section-title"><span>03</span><div><strong>Cardiac examination</strong><p>ECG and exercise-related indicators</p></div></div><div className="fields-grid">{(['cp', 'restecg', 'exang', 'oldpeak', 'slope', 'ca', 'thal'] as (keyof ClinicalFeatures)[]).map(key => <Field key={key} field={key} value={features[key]} onChange={updateFeature}/>)}</div></div><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => { setFeatures(initialFeatures); setPrediction(null); setAssessmentError(''); }}>Reset form</button><button type="submit" className="button button-primary" disabled={assessmentLoading}>{assessmentLoading ? <RefreshCw size={16} className="spin"/> : <Zap size={16}/>} {assessmentLoading ? 'Running assessment…' : 'Run risk assessment'} <ArrowRight size={15}/></button></div>{assessmentError && <div className="alert alert-error"><X size={17}/><span>{assessmentError}</span></div>}</div>
            <div className="result-column"><div className="panel result-panel"><div className="panel-heading"><div><h2>Assessment result</h2><p>Model-generated estimate</p></div><span className="result-icon"><HeartPulse size={18}/></span></div>{prediction ? <><div className={`result-ring ${riskClass(prediction.triage_category)}`}><div className="result-ring-inner"><strong>{formatPercent(prediction.risk_probability)}</strong><span>Predicted risk</span></div></div><div className="result-category"><RiskBadge category={prediction.triage_category}/><p>Model output for the entered clinical features.</p></div><div className="result-meter"><div><span>Estimated probability</span><strong>{formatPercent(prediction.risk_probability)}</strong></div><div className="meter-track"><span className={riskClass(prediction.triage_category)} style={{ width: `${Math.max(0, Math.min(100, prediction.risk_probability))}%` }}/></div><div className="meter-scale"><span>0%</span><span>35%</span><span>65%</span><span>100%</span></div></div><div className="recommendation"><div className="recommendation-title"><Stethoscope size={16}/> Model-provided next step</div><p>{prediction.clinical_recommendation}</p></div><div className="fine-print"><ShieldCheck size={14}/> Not a diagnosis. Clinical review is required.</div></> : <div className="result-empty"><div className="result-empty-icon"><Activity size={25}/></div><strong>Ready for assessment</strong><p>Complete the clinical parameters and run the model to see the estimated risk.</p><div className="result-empty-list"><span><Check size={14}/> 13 input features</span><span><Check size={14}/> Calibrated probability output</span><span><Check size={14}/> Gateway-routed inference</span></div></div>}</div><div className="info-card"><div><ShieldCheck size={18}/><strong>Data handling</strong></div><p>Inputs are sent to your configured CardioPulse API gateway for inference. Avoid entering direct identifiers unless your deployment is approved to process them.</p></div></div></form>
        </>}

        {page === 'batch' && <>
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>COHORT WORKFLOW</div><h1>Batch screening</h1><p>Score a cohort from CSV using the same deployed inference service.</p></div><button className="button button-secondary" onClick={() => window.open('/data/sample_patients.csv', '_blank')}><Download size={16}/> Sample CSV template</button></section>
          <section className="panel upload-panel"><div className="panel-heading"><div><h2>Upload patient cohort</h2><p>CSV must contain all 13 model features as numeric columns.</p></div><span className="subtle-pill"><FileSpreadsheet size={14}/> CSV format</span></div><input ref={fileInput} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={event => handleFile(event.target.files?.[0])}/><button className="dropzone" onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add('dragging'); }} onDragLeave={event => event.currentTarget.classList.remove('dragging')} onDrop={event => { event.preventDefault(); event.currentTarget.classList.remove('dragging'); handleFile(event.dataTransfer.files[0]); }}><span className="upload-icon"><Upload size={22}/></span><strong>{fileName || 'Choose a CSV file or drag it here'}</strong><span>CSV only · maximum 500 patient records per request</span><span className="button button-secondary choose-file">Browse files</span></button>{batchError && <div className="alert alert-error"><X size={17}/><span>{batchError}</span></div>}{batchRows.length > 0 && <div className="file-summary"><div className="file-summary-icon"><FileSpreadsheet size={20}/></div><div><strong>{fileName}</strong><span>{batchRows.length} patient records · {FEATURE_COLUMNS.length} expected features</span></div><button className="icon-button" aria-label="Remove uploaded file" onClick={() => { setBatchRows([]); setBatchResults([]); setFileName(''); setBatchError(''); if (fileInput.current) fileInput.current.value = ''; }}><X size={17}/></button></div>}<div className="upload-footer"><div className="upload-hint"><CircleHelp size={15}/><span>Required columns: <code>{FEATURE_COLUMNS.join(', ')}</code></span></div><button className="button button-primary" disabled={!batchRows.length || batchLoading} onClick={() => void scoreBatch()}>{batchLoading ? <RefreshCw size={16} className="spin"/> : <Zap size={16}/>} {batchLoading ? 'Scoring cohort…' : 'Score patient cohort'} <ArrowRight size={15}/></button></div></section>
          {batchResults.length > 0 && <><section className="metric-grid batch-metrics"><MetricCard label="Patients scored" value={String(batchResults.length)} note="Completed in this session" icon={<Users size={19}/>} /><MetricCard label="Average risk" value={formatPercent(avgRisk || 0)} note="Mean predicted probability" icon={<Activity size={19}/>} /><MetricCard label="High-risk cohort" value={String(highRiskCount)} note="Requires clinician review" icon={<HeartPulse size={19}/>} /><MetricCard label="Low-risk cohort" value={String(batchResults.filter(row => row.triage_category === 'Low Risk').length)} note="Model category only" icon={<ShieldCheck size={19}/>} /></section><section className="panel table-panel"><div className="panel-heading"><div><h2>Scored patient records</h2><p>Predictions returned by the inference engine.</p></div><div className="table-tools"><label className="search-box"><Search size={15}/><input value={batchSearch} onChange={event => setBatchSearch(event.target.value)} placeholder="Search results"/></label><button className="button button-secondary button-small" onClick={exportBatch}><Download size={15}/> Export CSV</button></div></div><div className="table-scroll"><table><thead><tr><th>Record</th><th>Age</th><th>Sex code</th><th>Risk probability</th><th>Risk category</th><th>Prediction</th></tr></thead><tbody>{filteredBatch.map((row, index) => <tr key={`${index}-${row.age}`}><td><span className="record-cell"><span className="record-avatar">{String(index + 1).padStart(2, '0')}</span>Patient {index + 1}</span></td><td>{row.age}</td><td>{row.sex}</td><td><strong>{formatPercent(row.risk_probability || 0)}</strong><div className="table-risk-track"><span className={riskClass(row.triage_category)} style={{ width: `${Math.max(0, Math.min(100, row.risk_probability || 0))}%` }}/></div></td><td><RiskBadge category={row.triage_category}/></td><td>{row.prediction_label}</td></tr>)}</tbody></table></div><div className="table-bottom"><span>Showing {filteredBatch.length} of {batchResults.length} records</span><span>Use clinical judgement for all follow-up decisions.</span></div></section></>}
          <div className="disclaimer"><ShieldCheck size={16}/><p><strong>Privacy and safety:</strong> Upload only data you are authorized to process. The model is a research/decision-support aid and is not a substitute for a clinician's diagnosis.</p></div>
        </>}

        {page === 'operations' && <>
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>PLATFORM OBSERVABILITY</div><h1>System operations</h1><p>Inspect the gateway's end-to-end health response and service topology.</p></div><button className="button button-primary" onClick={() => void refreshHealth()} disabled={healthLoading}><RefreshCw size={16} className={healthLoading ? 'spin' : ''}/> Refresh diagnostics</button></section>
          <section className="metric-grid"><MetricCard label="API gateway" value={gatewayHealthy ? 'Healthy' : 'Unknown'} note={health?.tier || 'Health endpoint not confirmed'} icon={<Network size={19}/>} /><MetricCard label="ML inference engine" value={engineHealthy ? 'Healthy' : 'Unknown'} note={health?.upstream_ml_engine?.status || 'Upstream status unavailable'} icon={<Zap size={19}/>} /><MetricCard label="Model version" value="v1.0.0" note="Calibrated Random Forest" icon={<BadgeCheck size={19}/>} /><MetricCard label="Last check" value={healthLoading ? 'Checking…' : health ? 'Complete' : 'Failed'} note="Manually refreshed from browser" icon={<Clock3 size={19}/>} /></section>
          <section className="panel topology-panel"><div className="panel-heading"><div><h2>Microservice topology</h2><p>Browser requests flow through the web tier to the private inference service.</p></div><span className="subtle-pill"><Cloud size={14}/> Kubernetes</span></div><div className="topology-flow"><TopologyNode title="React web dashboard" subtitle="Tier 1 · Nginx :80" status="healthy"/><div className="topology-link"><span>HTTP /api/*</span><div/></div><TopologyNode title="API gateway" subtitle="Tier 2 · ClusterIP :5000" status={gatewayHealthy ? 'healthy' : 'unavailable'}/><div className="topology-link"><span>Internal service DNS</span><div/></div><TopologyNode title="ML inference engine" subtitle="Tier 3 · ClusterIP :5000" status={engineHealthy ? 'healthy' : 'unavailable'}/></div>{healthError && <div className="alert alert-error"><X size={17}/><span>{healthError}</span></div>}{health && <div className="health-payload"><div className="panel-heading"><div><h2>Gateway health response</h2><p>Raw JSON returned by GET /api/healthz</p></div><button className="button button-secondary button-small" onClick={() => downloadFile('cardiopulse-health.json', JSON.stringify(health, null, 2), 'application/json')}><Download size={14}/> Export JSON</button></div><pre>{JSON.stringify(health, null, 2)}</pre></div>}</section>
          <div className="disclaimer"><CircleHelp size={16}/><p>Health status confirms endpoint reachability only. It does not validate model quality, data drift, security posture, or clinical suitability.</p></div>
        </>}
        <footer className="app-footer"><span>© 2026 CardioPulse · Clinical Intelligence</span><span><span className="footer-dot"/> Research decision-support prototype</span></footer>
      </div>
    </main>
    {toast && <div className="toast"><Check size={17}/>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
  </div>;
}

function Field({ field, value, onChange }: { field: keyof ClinicalFeatures; value: number; onChange: (field: keyof ClinicalFeatures, value: number) => void }) {
  const options = enumOptions[field];
  const constraints: Partial<Record<keyof ClinicalFeatures, { min: number; max: number; step?: number }>> = {
    age: { min: 18, max: 100 }, trestbps: { min: 80, max: 240 }, chol: { min: 100, max: 600 }, thalach: { min: 60, max: 220 }, oldpeak: { min: 0, max: 6.5, step: 0.1 },
  };
  const range = constraints[field];
  return <label className="field"><span>{fieldLabels[field]} <em>*</em></span>{options ? <select value={value} onChange={event => onChange(field, Number(event.target.value))}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <div className="input-wrap"><input type="number" required min={range?.min} max={range?.max} step={range?.step || 1} value={value} onChange={event => onChange(field, Number(event.target.value))}/>{field === 'trestbps' && <small>mm Hg</small>}{field === 'chol' && <small>mg/dL</small>}{field === 'thalach' && <small>bpm</small>}</div>}</label>;
}
function ServiceRow({ title, subtitle, status }: { title: string; subtitle: string; status: string }) {
  return <div className="service-row"><div className="service-symbol"><Activity size={17}/></div><div className="service-copy"><strong>{title}</strong><span>{subtitle}</span></div><span className={`service-state ${status === 'healthy' ? 'state-healthy' : status === 'checking' ? 'state-checking' : 'state-down'}`}><span className="status-dot"/>{status}</span></div>;
}
function TopologyNode({ title, subtitle, status }: { title: string; subtitle: string; status: string }) {
  return <div className="topology-node"><div className="topology-node-icon"><Activity size={20}/></div><div className="topology-node-copy"><strong>{title}</strong><span>{subtitle}</span></div><span className={`service-state ${status === 'healthy' ? 'state-healthy' : 'state-down'}`}><span className="status-dot"/>{status}</span></div>;
}
