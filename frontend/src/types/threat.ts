export type ThreatCategory =
  | 'Phishing'
  | 'Ransomware'
  | 'Data Breach'
  | 'Vulnerability'
  | 'Third-Party Risk'
  | 'Credential Attack'
  | 'Cloud Misconfiguration'
  | 'Insider Threat'
  | 'DDoS'
  | 'Malware';

export type ThreatStatus = 'Open' | 'Investigating' | 'Mitigated' | 'Closed';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Threat {
  id: number | string;
  title: string;
  description: string;
  category: ThreatCategory;
  likelihood: number; // 1-5
  impact: number;     // 1-5
  risk_score: number; // 1-25
  risk_level: RiskLevel;
  status: ThreatStatus;
  affected_asset: string;
  created_at: string;
  updated_at: string;
}

export interface ThreatInput {
  title: string;
  description: string;
  category: ThreatCategory;
  likelihood: number;
  impact: number;
  status: ThreatStatus;
  affected_asset: string;
}

export interface TimelineEvent {
  id: number | string;
  threat_id: number | string;
  event_type: string;
  description: string;
  created_at: string;
}

export interface DailyScoreTrend {
  date: string;
  avg_score: number;
  threat_count: number;
  critical_count: number;
}

export interface ThreatStats {
  total_threats: number;
  by_level: Record<RiskLevel, number>;
  by_status: Record<ThreatStatus, number>;
  by_category: Record<string, number>;
  average_risk_score: number;
  trend_30d: DailyScoreTrend[];
}

export interface ThreatFilters {
  category?: ThreatCategory | 'All';
  risk_level?: RiskLevel | 'All';
  status?: ThreatStatus | 'All';
  search?: string;
  q?: string;
  sort_by?: 'newest' | 'highest_risk' | 'lowest_risk' | 'oldest';
  page?: number;
  limit?: number;
}

export interface PaginatedThreats {
  items: Threat[];
  total: number;
  skip?: number;
  limit?: number;
  page?: number;
}

export interface AIAssessResponse {
  category: ThreatCategory;
  likelihood: number;
  impact: number;
  risk_score: number;
  risk_level: RiskLevel;
  response_timeline_hours: number;
  reasoning: string;
  recommended_actions: string[];
  fallback: boolean;
  backend_used: string;
}

export interface VoiceReportResponse {
  transcript_original: string;
  transcript_english: string;
  language_code: string;
  assessment: AIAssessResponse;
}

export interface ThreatBriefingResponse {
  threat_id: number | string;
  language_code: string;
  original_english: string;
  briefing_text: string;
  audio_base64: string;
  cached: boolean;
}


