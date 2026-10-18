import React from 'react';
import {
  ShieldAlert,
  Server,
  Clock,
  ExternalLink,
  ChevronRight,
  Edit2,
  Trash2,
  Mail,
  FileWarning,
  Database,
  Bug,
  Handshake,
  KeyRound,
  Cloud,
  UserX,
  WifiOff,
  Terminal,
} from 'lucide-react';
import { Threat, ThreatCategory, RiskLevel, ThreatStatus } from '../types/threat';

interface ThreatCardProps {
  threat: Threat;
  onOpenTimeline: (threat: Threat) => void;
  onSelectThreat: (threat: Threat) => void;
  onEdit?: (threat: Threat) => void;
  onDelete?: (threat: Threat) => void;
}

export const ThreatCard: React.FC<ThreatCardProps> = ({
  threat,
  onOpenTimeline,
  onSelectThreat,
  onEdit,
  onDelete,
}) => {
  const getCategoryIcon = (cat: ThreatCategory) => {
    switch (cat) {
      case 'Phishing':
        return <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />;
      case 'Ransomware':
        return <FileWarning className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />;
      case 'Data Breach':
        return <Database className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />;
      case 'Vulnerability':
        return <Bug className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;
      case 'Third-Party Risk':
        return <Handshake className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />;
      case 'Credential Attack':
        return <KeyRound className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />;
      case 'Cloud Misconfiguration':
        return <Cloud className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />;
      case 'Insider Threat':
        return <UserX className="w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-400" />;
      case 'DDoS':
        return <WifiOff className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />;
      case 'Malware':
        return <Terminal className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />;
      default:
        return <ShieldAlert className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />;
    }
  };

  const getLevelBadge = (level: RiskLevel) => {
    switch (level) {
      case 'Critical':
        return 'bg-[var(--risk-critical-bg)] text-[var(--risk-critical-text)] border-[var(--risk-critical-border)]';
      case 'High':
        return 'bg-[var(--risk-high-bg)] text-[var(--risk-high-text)] border-[var(--risk-high-border)]';
      case 'Medium':
        return 'bg-[var(--risk-medium-bg)] text-[var(--risk-medium-text)] border-[var(--risk-medium-border)]';
      case 'Low':
        return 'bg-[var(--risk-low-bg)] text-[var(--risk-low-text)] border-[var(--risk-low-border)]';
    }
  };

  const getStatusBadge = (status: ThreatStatus) => {
    switch (status) {
      case 'Open':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60';
      case 'Investigating':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 animate-pulse';
      case 'Mitigated':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60';
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 17) return 'bg-[var(--risk-critical-bar)]';
    if (score >= 10) return 'bg-[var(--risk-high-bar)]';
    if (score >= 5) return 'bg-[var(--risk-medium-bar)]';
    return 'bg-[var(--risk-low-bar)]';
  };

  const createdDate = new Date(threat.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col justify-between p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)] hover:border-[var(--border-subtle)] transition-all duration-200 group">
      <div>
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Category Tag */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)]">
            {getCategoryIcon(threat.category)}
            <span>{threat.category}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {/* Color-coded Level Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${getLevelBadge(
                threat.risk_level
              )}`}
            >
              {threat.risk_level}
            </span>

            {/* Status Pill */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold border ${getStatusBadge(
                threat.status
              )}`}
            >
              {threat.status}
            </span>
          </div>
        </div>

        {/* Threat Title & Description */}
        <h3
          onClick={() => onSelectThreat(threat)}
          className="text-base font-semibold text-[var(--text-primary)] tracking-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition line-clamp-2 mb-1.5 cursor-pointer"
        >
          {threat.title}
        </h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3 mb-4">
          {threat.description}
        </p>

        {/* Affected Asset Pill */}
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] p-2 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-color)] mb-4 overflow-hidden">
          <Server className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          <span className="truncate" title={threat.affected_asset}>
            {threat.affected_asset}
          </span>
        </div>
      </div>

      <div>
        {/* Risk Score & Matrix Breakdown */}
        <div className="pt-3 border-t border-[var(--border-color)] mb-3">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-[var(--text-muted)]">
              Risk Score:{' '}
              <strong className="text-[var(--text-primary)] text-sm">{threat.risk_score}</strong>
              <span className="text-[var(--text-muted)]">/25</span>
            </span>
            <span className="text-[var(--text-muted)]">
              L: <strong className="text-[var(--text-secondary)]">{threat.likelihood}</strong> × I:{' '}
              <strong className="text-[var(--text-secondary)]">{threat.impact}</strong>
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(
                threat.risk_score
              )}`}
              style={{ width: `${(threat.risk_score / 25) * 100}%` }}
            />
          </div>
        </div>

        {/* Card Footer: Date, Actions, and Inspect Details Button */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{createdDate}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Edit Quick Action */}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(threat);
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
                title="Edit Threat"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Quick Action */}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(threat);
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                title="Delete Threat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick Timeline Modal Button */}
            <button
              onClick={() => onOpenTimeline(threat)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-cyan-600 dark:hover:text-cyan-400 bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] transition cursor-pointer"
              title="Quick Timeline Preview"
            >
              <span>Timeline</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            {/* Full Details Page Button */}
            <button
              onClick={() => onSelectThreat(threat)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[var(--shadow-glow)] transition cursor-pointer"
            >
              <span>Details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatCard;
