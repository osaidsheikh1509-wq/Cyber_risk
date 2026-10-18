export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RiskStatus = 'open' | 'in_review' | 'mitigated';
export type RiskCategory = 'network' | 'endpoint' | 'cloud' | 'identity' | 'compliance' | 'application';

export interface RiskItem {
  id: number;
  title: string;
  description: string;
  severity: RiskSeverity;
  category: RiskCategory;
  status: RiskStatus;
  score: number;
  created_at: string;
}

export interface RiskItemCreate {
  title: string;
  description: string;
  severity: RiskSeverity;
  category: RiskCategory;
  status: RiskStatus;
  score: number;
}

export interface RiskStats {
  total_risks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open_count: number;
  mitigated_count: number;
  average_score: number;
}

export interface HealthStatus {
  status: string;
  app_name: string;
  version: string;
  environment: string;
}
