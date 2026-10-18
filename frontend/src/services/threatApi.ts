import {
  Threat,
  ThreatStats,
  TimelineEvent,
  ThreatFilters,
  ThreatInput,
  AIAssessResponse,
  VoiceReportResponse,
  ThreatBriefingResponse,
  PaginatedThreats,
} from '../types/threat';

// Vite proxy routes /threats and /stats to http://127.0.0.1:8000
const API_BASE = '';

export async function fetchThreats(filters?: ThreatFilters): Promise<PaginatedThreats> {
  const params = new URLSearchParams();

  if (filters?.category && filters.category !== 'All') {
    params.append('category', filters.category);
  }
  if (filters?.risk_level && filters.risk_level !== 'All') {
    params.append('risk_level', filters.risk_level);
  }
  if (filters?.status && filters.status !== 'All') {
    params.append('status', filters.status);
  }
  const searchVal = (filters?.q || filters?.search || '').trim();
  if (searchVal) {
    params.append('search', searchVal);
    params.append('q', searchVal);
  }
  if (filters?.sort_by) {
    params.append('sort_by', filters.sort_by);
  }
  if (filters?.limit) {
    params.append('limit', filters.limit.toString());
  }
  if (filters?.page) {
    params.append('page', filters.page.toString());
  }

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/threats${queryStr}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch threats: ${response.statusText}`);
  }

  const headerTotal = response.headers.get('X-Total-Count') || response.headers.get('Total-Count');
  const data = await response.json();

  if (Array.isArray(data)) {
    return {
      items: data,
      total: headerTotal ? parseInt(headerTotal, 10) : data.length,
      page: filters?.page || 1,
      limit: filters?.limit || data.length,
    };
  }

  return {
    items: data.items || [],
    total: typeof data.total === 'number' ? data.total : (headerTotal ? parseInt(headerTotal, 10) : (data.items || []).length),
    skip: data.skip,
    limit: data.limit,
    page: data.page || filters?.page || 1,
  };
}

export async function fetchThreatById(threatId: number | string): Promise<Threat> {
  const response = await fetch(`${API_BASE}/threats/${threatId}`);
  if (!response.ok) {
    throw new Error(`Threat with ID ${threatId} not found`);
  }
  return response.json();
}

export async function fetchThreatStats(): Promise<ThreatStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch threat stats: ${response.statusText}`);
  }
  return response.json();
}

export async function createThreat(threat: ThreatInput): Promise<Threat> {
  const response = await fetch(`${API_BASE}/threats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(threat),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to create threat: ${response.statusText}`);
  }
  return response.json();
}

export async function updateThreat(threatId: number | string, threat: Partial<ThreatInput>): Promise<Threat> {
  const response = await fetch(`${API_BASE}/threats/${threatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(threat),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to update threat: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchThreatTimeline(threatId: number | string): Promise<TimelineEvent[]> {
  const response = await fetch(`${API_BASE}/threats/${threatId}/timeline`);
  if (!response.ok) {
    throw new Error(`Failed to fetch timeline for threat ${threatId}`);
  }
  return response.json();
}

export async function addTimelineNote(threatId: number | string, description: string): Promise<TimelineEvent> {
  const response = await fetch(`${API_BASE}/threats/${threatId}/timeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'NOTE', description }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add timeline note to threat ${threatId}`);
  }
  return response.json();
}

export async function updateThreatStatus(threatId: number | string, status: string): Promise<Threat> {
  const response = await fetch(`${API_BASE}/threats/${threatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update threat status: ${response.statusText}`);
  }
  return response.json();
}

export async function updateThreatAssessment(
  threatId: number | string,
  likelihood: number,
  impact: number
): Promise<Threat> {
  const response = await fetch(`${API_BASE}/threats/${threatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ likelihood, impact }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update threat assessment: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteThreat(threatId: number | string): Promise<void> {
  const response = await fetch(`${API_BASE}/threats/${threatId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete threat: ${response.statusText}`);
  }
}

export async function assessThreatWithAI(eventText: string): Promise<AIAssessResponse> {
  const response = await fetch(`${API_BASE}/ai/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_text: eventText }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `AI Assessment failed: ${response.statusText}`);
  }
  return response.json();
}

export async function reportThreatByVoice(
  audioBlob: Blob,
  languageCode: string = 'unknown'
): Promise<VoiceReportResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('language_code', languageCode);

  const response = await fetch(`${API_BASE}/voice/report`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Voice Report failed: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchThreatBriefing(
  threatId: number | string,
  languageCode: string = 'en-IN',
  bypassCache: boolean = false
): Promise<ThreatBriefingResponse> {
  const params = new URLSearchParams({
    lang: languageCode,
    bypass_cache: bypassCache ? 'true' : 'false',
  });
  const response = await fetch(`${API_BASE}/threats/${threatId}/briefing?${params.toString()}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to fetch threat briefing: ${response.statusText}`);
  }
  return response.json();
}
