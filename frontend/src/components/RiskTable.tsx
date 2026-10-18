import React, { useState } from 'react';
import { Trash2, Cloud, Server, Lock, FileCheck, Layers } from 'lucide-react';
import { RiskItem, RiskSeverity } from '../types/risk';

interface RiskTableProps {
  risks: RiskItem[];
  loading: boolean;
  onDeleteRisk: (id: number) => void;
}

export const RiskTable: React.FC<RiskTableProps> = ({
  risks,
  loading,
  onDeleteRisk,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const filteredRisks = selectedSeverity === 'all'
    ? risks
    : risks.filter((r) => r.severity === selectedSeverity);

  const getSeverityBadge = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-950/80 text-rose-400 border-rose-800/60';
      case 'high':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
      case 'medium':
        return 'bg-yellow-950/80 text-yellow-400 border-yellow-800/60';
      case 'low':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'network':
        return <Server className="w-3.5 h-3.5 text-blue-400" />;
      case 'cloud':
        return <Cloud className="w-3.5 h-3.5 text-sky-400" />;
      case 'identity':
        return <Lock className="w-3.5 h-3.5 text-purple-400" />;
      case 'compliance':
        return <FileCheck className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'mitigated':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50';
      case 'in_review':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/50';
      default:
        return 'text-rose-400 bg-rose-950/60 border-rose-800/50';
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Table Filter Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Active Threat & Vulnerability Registry</h2>
          <p className="text-xs text-slate-400">Total detected entries: {filteredRisks.length}</p>
        </div>

        <div className="flex items-center space-x-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-lg">
          {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1 rounded text-xs font-medium uppercase tracking-wider transition ${
                selectedSeverity === sev
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-mono uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Risk Title & Description</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">CVSS Score</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-mono">
                  Loading registry records...
                </td>
              </tr>
            ) : filteredRisks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  No risk entries found matching the filter.
                </td>
              </tr>
            ) : (
              filteredRisks.map((risk) => (
                <tr key={risk.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getSeverityBadge(
                        risk.severity
                      )}`}
                    >
                      {risk.severity}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-100">{risk.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{risk.description}</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-mono capitalize">
                      {getCategoryIcon(risk.category)}
                      {risk.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-200">{risk.score.toFixed(1)}</span>
                      <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            risk.score >= 9
                              ? 'bg-rose-500'
                              : risk.score >= 7
                              ? 'bg-amber-500'
                              : risk.score >= 4
                              ? 'bg-yellow-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${(risk.score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase border ${getStatusBadge(
                        risk.status
                      )}`}
                    >
                      {risk.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => onDeleteRisk(risk.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                      title="Delete Risk"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
