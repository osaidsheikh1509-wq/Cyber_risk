import React from 'react';
import { AlertOctagon, AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react';
import { ThreatStats, RiskLevel } from '../types/threat';

interface SummaryCardsProps {
  stats: ThreatStats | null;
  selectedLevel: RiskLevel | 'All';
  onSelectLevel: (level: RiskLevel | 'All') => void;
  loading?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  selectedLevel,
  onSelectLevel,
  loading = false,
}) => {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-2.5 w-32 bg-slate-200/70 dark:bg-slate-800/60 rounded" />
            <div className="h-1.5 w-full bg-slate-200/50 dark:bg-slate-800/40 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const total = stats?.total_threats || 0;
  const critical = stats?.by_level?.Critical || 0;
  const high = stats?.by_level?.High || 0;
  const medium = stats?.by_level?.Medium || 0;
  const low = stats?.by_level?.Low || 0;

  const cards = [
    {
      level: 'Critical' as RiskLevel,
      label: 'Critical Threats',
      count: critical,
      percentage: total ? Math.round((critical / total) * 100) : 0,
      description: 'Immediate action required',
      icon: AlertOctagon,
      badgeColor: 'text-[var(--risk-critical-text)] bg-[var(--risk-critical-bg)] border-[var(--risk-critical-border)]',
      activeRing: 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.25)]',
      barColor: 'bg-[var(--risk-critical-bar)]',
      textColor: 'text-[var(--risk-critical-text)]',
    },
    {
      level: 'High' as RiskLevel,
      label: 'High Threats',
      count: high,
      percentage: total ? Math.round((high / total) * 100) : 0,
      description: 'Severe operational exposure',
      icon: AlertTriangle,
      badgeColor: 'text-[var(--risk-high-text)] bg-[var(--risk-high-bg)] border-[var(--risk-high-border)]',
      activeRing: 'ring-2 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
      barColor: 'bg-[var(--risk-high-bar)]',
      textColor: 'text-[var(--risk-high-text)]',
    },
    {
      level: 'Medium' as RiskLevel,
      label: 'Medium Threats',
      count: medium,
      percentage: total ? Math.round((medium / total) * 100) : 0,
      description: 'Elevated risk posture',
      icon: AlertCircle,
      badgeColor: 'text-[var(--risk-medium-text)] bg-[var(--risk-medium-bg)] border-[var(--risk-medium-border)]',
      activeRing: 'ring-2 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.25)]',
      barColor: 'bg-[var(--risk-medium-bar)]',
      textColor: 'text-[var(--risk-medium-text)]',
    },
    {
      level: 'Low' as RiskLevel,
      label: 'Low Threats',
      count: low,
      percentage: total ? Math.round((low / total) * 100) : 0,
      description: 'Minor or informational',
      icon: ShieldCheck,
      badgeColor: 'text-[var(--risk-low-text)] bg-[var(--risk-low-bg)] border-[var(--risk-low-border)]',
      activeRing: 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
      barColor: 'bg-[var(--risk-low-bar)]',
      textColor: 'text-[var(--risk-low-text)]',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedLevel === card.level;

        return (
          <div
            key={card.level}
            onClick={() => onSelectLevel(isSelected ? 'All' : card.level)}
            className={`cursor-pointer transition-all duration-200 p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)] hover:border-[var(--border-subtle)] ${
              isSelected ? card.activeRing : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg border ${card.badgeColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">
                {card.count}
              </span>
              <span className={`text-xs font-mono font-medium ${card.textColor}`}>
                {card.percentage}% of total
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-1">{card.description}</p>

            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${card.barColor}`}
                style={{ width: `${card.percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryCards;
