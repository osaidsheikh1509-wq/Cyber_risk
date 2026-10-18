import React, { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { RiskItemCreate, RiskSeverity, RiskCategory, RiskStatus } from '../types/risk';

interface CreateRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (risk: RiskItemCreate) => Promise<void>;
}

export const CreateRiskModal: React.FC<CreateRiskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<RiskSeverity>('high');
  const [category, setCategory] = useState<RiskCategory>('network');
  const [status, setStatus] = useState<RiskStatus>('open');
  const [score, setScore] = useState<number>(7.5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    if (!description.trim() || description.length < 5) {
      setError('Description must be at least 5 characters.');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        title,
        description,
        severity,
        category,
        status,
        score: Number(score),
      });
      // reset
      setTitle('');
      setDescription('');
      setScore(7.5);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to register risk.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0b1329] border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-cyan-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-base font-bold text-white">Register Cyber Threat / Vulnerability</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Vulnerability Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unauthenticated RCE in Spring Boot API"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Description & Impact Analysis
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail root cause, affected services, and CVSS vector..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as RiskSeverity)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RiskCategory)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="network">Network</option>
                <option value="cloud">Cloud</option>
                <option value="identity">Identity</option>
                <option value="endpoint">Endpoint</option>
                <option value="application">Application</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RiskStatus)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="open">Open</option>
                <option value="in_review">In Review</option>
                <option value="mitigated">Mitigated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                CVSS Score: <span className="font-bold text-cyan-400">{score.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={score}
                onChange={(e) => setScore(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-2"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[0_0_12px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Save Risk Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
