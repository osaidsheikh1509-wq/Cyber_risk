import React from 'react';
import { AlertOctagon, AlertTriangle, AlertCircle, Gauge } from 'lucide-react';
import { RiskStats } from '../types/risk';

interface RiskSummaryProps {
  stats: RiskStats | null;
}

export const RiskSummary: React.FC<RiskSummaryProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Critical Risks */}
      <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/60 border border-rose-900/40 backdrop-blur-sm shadow-[0_4px_20px_rgba(244,63,94,0.06)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Critical Risks</span>
          <div className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400 border border-rose-900/40">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white font-mono">{stats?.critical ?? 0}</span>
          <span className="text-xs text-rose-300 font-medium">Requires immediate action</span>
        </div>
        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-rose-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats?.total_risks ? (stats.critical / stats.total_risks) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* High Risks */}
      <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/60 border border-amber-900/40 backdrop-blur-sm shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">High Risks</span>
          <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-900/40">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white font-mono">{stats?.high ?? 0}</span>
          <span className="text-xs text-amber-300 font-medium">High exposure</span>
        </div>
        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats?.total_risks ? (stats.high / stats.total_risks) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Medium & Low */}
      <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/60 border border-cyan-900/40 backdrop-blur-sm shadow-[0_4px_20px_rgba(6,182,212,0.06)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Medium / Low</span>
          <div className="p-1.5 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-900/40">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white font-mono">
            {(stats?.medium ?? 0) + (stats?.low ?? 0)}
          </span>
          <span className="text-xs text-slate-400 font-medium">Under active review</span>
        </div>
        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-cyan-500 h-full rounded-full transition-all duration-500"
            style={{
              width: `${
                stats?.total_risks ? (((stats.medium ?? 0) + (stats.low ?? 0)) / stats.total_risks) * 100 : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Average Score / Posture */}
      <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mean Risk Score</span>
          <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white font-mono">{stats?.average_score?.toFixed(1) ?? '0.0'}</span>
          <span className="text-xs text-slate-400 font-medium">/ 10.0 CVSS</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Total: {stats?.total_risks ?? 0}</span>
          <span className="text-emerald-400">Mitigated: {stats?.mitigated_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
};
