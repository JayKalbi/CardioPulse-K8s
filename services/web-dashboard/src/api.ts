import type { ClinicalFeatures, HealthResponse, TriageResponse } from './types';

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error || body?.message || body?.details || `Request failed (${response.status})`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return body as T;
}

export async function assessPatient(features: ClinicalFeatures): Promise<TriageResponse> {
  const response = await fetch('/api/v1/triage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }), signal: AbortSignal.timeout(15000),
  });
  return parseResponse<TriageResponse>(response);
}

export async function assessBatch(patients: ClinicalFeatures[]): Promise<TriageResponse> {
  const response = await fetch('/api/v1/triage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patients }), signal: AbortSignal.timeout(30000),
  });
  return parseResponse<TriageResponse>(response);
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/healthz', { signal: AbortSignal.timeout(6000) });
  return parseResponse<HealthResponse>(response);
}
