import React from 'react';
import { RiskLevel } from '../types/threat';
import { useTheme } from '../context/ThemeContext';

interface RiskScoreGaugeProps {
  score: number;       // 1 - 25
  level: RiskLevel;
  likelihood: number;  // 1 - 5
  impact: number;      // 1 - 5
}

export const RiskScoreGauge: React.FC<RiskScoreGaugeProps> = ({
  score,
  level,
  likelihood,
  impact,
}) => {
  const { isLight } = useTheme();

  // Max score is 25
  const normalizedScore = Math.min(Math.max(score, 1), 25);
  const percentage = (normalizedScore / 25) * 100;

  // Arc calculation for semi-circle gauge (radius 80, stroke 14)
  const radius = 80;
  const circumference = Math.PI * radius; // 180 degree arc
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColorConfig = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'Critical':
        return {
          stroke: isLight ? '#e11d48' : '#f43f5e',
          text: 'text-[var(--risk-critical-text)]',
          bg: 'bg-[var(--risk-critical-bg)] border-[var(--risk-critical-border)]',
          glow: isLight ? 'drop-shadow-[0_0_8px_rgba(225,29,72,0.3)]' : 'drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]',
        };
      case 'High':
        return {
          stroke: isLight ? '#d97706' : '#f59e0b',
          text: 'text-[var(--risk-high-text)]',
          bg: 'bg-[var(--risk-high-bg)] border-[var(--risk-high-border)]',
          glow: isLight ? 'drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]' : 'drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]',
        };
      case 'Medium':
        return {
          stroke: isLight ? '#ca8a04' : '#eab308',
          text: 'text-[var(--risk-medium-text)]',
          bg: 'bg-[var(--risk-medium-bg)] border-[var(--risk-medium-border)]',
          glow: isLight ? 'drop-shadow-[0_0_8px_rgba(202,138,4,0.3)]' : 'drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]',
        };
      case 'Low':
        return {
          stroke: isLight ? '#059669' : '#06b6d4',
          text: 'text-[var(--risk-low-text)]',
          bg: 'bg-[var(--risk-low-bg)] border-[var(--risk-low-border)]',
          glow: isLight ? 'drop-shadow-[0_0_8px_rgba(5,150,105,0.3)]' : 'drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]',
        };
    }
  };

  const config = getColorConfig(level);
  const bgArcStroke = isLight ? '#e2e8f0' : '#1e293b';

  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
      <div className="relative w-56 h-36 flex items-center justify-center">
        <svg className="w-56 h-36 overflow-visible" viewBox="0 0 200 120">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="35%" stopColor="#eab308" />
              <stop offset="65%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>

          {/* Background Arc */}
          <path
            d="M 20 105 A 80 80 0 0 1 180 105"
            fill="none"
            stroke={bgArcStroke}
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Value Arc */}
          <path
            d="M 20 105 A 80 80 0 0 1 180 105"
            fill="none"
            stroke={config.stroke}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-700 ease-out ${config.glow}`}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute top-12 flex flex-col items-center text-center">
          <div className="flex items-baseline">
            <span className="text-4xl font-extrabold font-mono text-[var(--text-primary)] tracking-tight">
              {score}
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)] ml-1">/ 25</span>
          </div>

          <span
            className={`mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${config.bg} ${config.text}`}
          >
            {level} Risk
          </span>
        </div>
      </div>

      {/* Formula & Breakdown footer */}
      <div className="mt-2 text-center">
        <p className="text-xs font-mono text-[var(--text-muted)]">
          Risk Equation:{' '}
          <span className="text-[var(--text-secondary)] font-semibold">
            Likelihood ({likelihood}) × Impact ({impact}) = {score}
          </span>
        </p>
        <div className="flex items-center justify-center gap-3 text-[10px] font-mono text-[var(--text-muted)] mt-2 font-medium">
          <span className="text-emerald-600 dark:text-cyan-400">Low: 1-4</span>
          <span>•</span>
          <span className="text-yellow-600 dark:text-yellow-400">Med: 5-9</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400">High: 10-16</span>
          <span>•</span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">Crit: 17-25</span>
        </div>
      </div>
    </div>
  );
};

export default RiskScoreGauge;
