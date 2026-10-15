export type ClinicalFeatures = {
  age: number; sex: number; cp: number; trestbps: number; chol: number; fbs: number;
  restecg: number; thalach: number; exang: number; oldpeak: number; slope: number; ca: number; thal: number;
};

export type PredictionResult = {
  patient_index?: number;
  risk_probability: number;
  prediction_label: number;
  triage_category: 'Low Risk' | 'Moderate Risk' | 'High Risk' | string;
  clinical_recommendation: string;
};

export type TriageResponse = {
  gateway_status: string;
  routed_via: string;
  payload: { service?: string; count?: number; results: PredictionResult | PredictionResult[] };
};

export type HealthResponse = {
  service?: string;
  status?: string;
  tier?: string;
  upstream_ml_engine?: { endpoint?: string; status?: string };
};

export const FEATURE_COLUMNS: (keyof ClinicalFeatures)[] = [
  'age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal',
];
