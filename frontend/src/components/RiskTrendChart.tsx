import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DailyScoreTrend } from '../types/threat';
import { TrendingUp, Activity, ShieldAlert } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface RiskTrendChartProps {
  trendData: DailyScoreTrend[];
  averageScore: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  isLight?: boolean;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, isLight }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DailyScoreTrend;
    return (
      <div
        className={`rounded-xl p-3 shadow-xl text-xs font-mono backdrop-blur-md border ${
          isLight
            ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-300/50'
            : 'bg-slate-950/95 border-cyan-800/80 text-slate-100 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
        }`}
      >
        <p className={`font-semibold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className={isLight ? 'text-cyan-600 font-medium' : 'text-cyan-400'}>Mean Risk Score:</span>
          <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{data.avg_score.toFixed(1)} / 25</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>New Threats:</span>
          <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{data.threat_count}</span>
        </div>
        {data.critical_count > 0 && (
          <div className="flex items-center justify-between gap-4 py-0.5 text-rose-600 dark:text-rose-400 font-semibold">
            <span>Critical Events:</span>
            <span className="font-bold">{data.critical_count}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const RiskTrendChart: React.FC<RiskTrendChartProps> = ({ trendData, averageScore }) => {
  const { isLight } = useTheme();

  // Format dates for X-Axis e.g. "Oct 12"
  const formattedData = trendData.map((item) => {
    const parts = item.date.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
    const day = parseInt(parts[2], 10);
    return {
      ...item,
      displayDate: `${month} ${day}`,
    };
  });

  const peakScore = trendData.length
    ? Math.max(...trendData.map((d) => d.avg_score))
    : 0;

  const gridStroke = isLight ? '#e2e8f0' : '#1e293b';
  const axisLineStroke = isLight ? '#cbd5e1' : '#1e293b';
  const axisTextStroke = isLight ? '#64748b' : '#64748b';
  const areaStroke = isLight ? '#0891b2' : '#06b6d4';
  const activeDotFill = isLight ? '#0891b2' : '#06b6d4';
  const activeDotStroke = isLight ? '#e0f2fe' : '#083344';

  return (
    <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)] mb-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-color)] gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 dark:bg-cyan-950/70 border border-cyan-500/30 dark:border-cyan-800/50 text-cyan-600 dark:text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              30-Day Risk Exposure & Vulnerability Velocity
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Chronological enterprise risk score index (Likelihood × Impact)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-[var(--text-muted)]">Current Mean:</span>
            <span className="text-[var(--text-primary)] font-bold">{averageScore.toFixed(1)}/25</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span className="text-[var(--text-muted)]">Peak Window Score:</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">{peakScore.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="w-full h-72 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cyberRiskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={areaStroke} stopOpacity={isLight ? 0.35 : 0.4} />
                <stop offset="95%" stopColor={areaStroke} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />

            <XAxis
              dataKey="displayDate"
              stroke={axisTextStroke}
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: axisLineStroke }}
              interval="preserveStartEnd"
              minTickGap={20}
            />

            <YAxis
              domain={[0, 25]}
              stroke={axisTextStroke}
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: axisLineStroke }}
              ticks={[0, 5, 10, 16, 25]}
            />

            <Tooltip content={<CustomTooltip isLight={isLight} />} />

            <Area
              type="monotone"
              dataKey="avg_score"
              stroke={areaStroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#cyberRiskGradient)"
              activeDot={{
                r: 6,
                fill: activeDotFill,
                stroke: activeDotStroke,
                strokeWidth: 3,
                className: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Score reference guide */}
      <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between text-[11px] text-[var(--text-muted)] font-mono gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Mean Daily Risk
          </span>
          <span className="text-[var(--text-muted)]">Scale: 1-25 (L×I)</span>
        </div>

        <div className="flex items-center gap-3 font-semibold">
          <span className="text-emerald-600 dark:text-cyan-400">Low (1-4)</span>
          <span className="text-yellow-600 dark:text-yellow-400">Med (5-9)</span>
          <span className="text-amber-600 dark:text-amber-400">High (10-16)</span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">Crit (17-25)</span>
        </div>
      </div>
    </div>
  );
};

export default RiskTrendChart;
