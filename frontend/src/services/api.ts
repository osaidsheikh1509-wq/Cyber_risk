import { RiskItem, RiskItemCreate, RiskStats, HealthStatus } from '../types/risk';

const API_BASE = '/api/v1';

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchRisks(severity?: string, status?: string): Promise<RiskItem[]> {
  const params = new URLSearchParams();
  if (severity) params.append('severity', severity);
  if (status) params.append('status', status);

  const url = `${API_BASE}/risks${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch risks: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRiskStats(): Promise<RiskStats> {
  const response = await fetch(`${API_BASE}/risks/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch risk stats: ${response.statusText}`);
  }
  return response.json();
}

export async function createRisk(risk: RiskItemCreate): Promise<RiskItem> {
  const response = await fetch(`${API_BASE}/risks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(risk),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail || `Failed to create risk: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteRisk(riskId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/risks/${riskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete risk: ${response.statusText}`);
  }
}
