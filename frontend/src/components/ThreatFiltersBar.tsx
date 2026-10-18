import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { ThreatCategory, ThreatStatus, RiskLevel, ThreatFilters } from '../types/threat';
import { ThemedFolderFloat } from './FolderFloat';
import { useTheme } from '../context/ThemeContext';

interface ThreatFiltersBarProps {
  filters: ThreatFilters;
  onFilterChange: (newFilters: ThreatFilters) => void;
  onReset: () => void;
  totalFiltered: number;
}

const CATEGORIES: ThreatCategory[] = [
  'Phishing',
  'Ransomware',
  'Data Breach',
  'Vulnerability',
  'Third-Party Risk',
  'Credential Attack',
  'Cloud Misconfiguration',
  'Insider Threat',
  'DDoS',
  'Malware',
];

const STATUSES: ThreatStatus[] = ['Open', 'Investigating', 'Mitigated', 'Closed'];

const LEVELS: RiskLevel[] = ['Critical', 'High', 'Medium', 'Low'];

export const ThreatFiltersBar: React.FC<ThreatFiltersBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  totalFiltered,
}) => {
  const { isLight } = useTheme();

  const activeFiltersCount =
    (filters.category && filters.category !== 'All' ? 1 : 0) +
    (filters.risk_level && filters.risk_level !== 'All' ? 1 : 0) +
    (filters.status && filters.status !== 'All' ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)] mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search threats, CVEs, or affected assets..."
            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
          />
        </div>

        {/* Reset Filters Button */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-medium bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition cursor-pointer shrink-0"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Filter Stats Bar & Active Filter Chips */}
      <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
          <span>
            Showing <strong className="text-[var(--text-primary)]">{totalFiltered}</strong> matching threats
          </span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/10 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 dark:border-cyan-800/60 font-semibold">
              {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Removable Chips for Active Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {filters.risk_level && filters.risk_level !== 'All' && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[var(--risk-high-bg)] text-[var(--risk-high-text)] border border-[var(--risk-high-border)] shadow-sm animate-fadeIn">
              <span>Level: {filters.risk_level}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, risk_level: 'All' })}
                className="hover:opacity-75 font-bold cursor-pointer ml-0.5"
                title="Clear level filter"
              >
                ✕
              </button>
            </div>
          )}

          {filters.category && filters.category !== 'All' && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 shadow-sm animate-fadeIn">
              <span>Category: {filters.category}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, category: 'All' })}
                className="hover:opacity-75 font-bold cursor-pointer ml-0.5"
                title="Clear category filter"
              >
                ✕
              </button>
            </div>
          )}

          {filters.status && filters.status !== 'All' && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-sm animate-fadeIn">
              <span>Status: {filters.status}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, status: 'All' })}
                className="hover:opacity-75 font-bold cursor-pointer ml-0.5"
                title="Clear status filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Quick Filter Floating Folders: Level, Category, Status (Spacious Layout) */}
      <div className="mt-4 pt-56 pb-6 border-t border-[var(--border-color)] relative z-20 overflow-visible">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-14 lg:gap-24 justify-items-center items-end overflow-visible px-4">
          {/* Folder 1: Level */}
          <div className="flex flex-col items-center gap-3 overflow-visible relative z-10 hover:z-30 focus-within:z-30 w-full max-w-[280px]">
            <ThemedFolderFloat
              items={['All', ...LEVELS]}
              label="Level"
              sublabel={filters.risk_level && filters.risk_level !== 'All' ? filters.risk_level : '4 tiers'}
              width={180}
              maxSpread={150}
              itemColor={isLight ? '#f59e0b' : '#f59e0b'}
              itemTextColor="#090d16"
              folderColor={isLight ? '#fed7aa' : '#1c1917'}
              frontColor={isLight ? '#ffedd5' : '#292524'}
              paperColor={isLight ? '#ffffff' : '#44403c'}
              labelColor={isLight ? '#78350f' : '#fef3c7'}
              onSelect={(lvl) => onFilterChange({ ...filters, risk_level: lvl as RiskLevel | 'All' })}
              className="shadow-xl"
            />
            {filters.risk_level && filters.risk_level !== 'All' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--risk-high-bg)] text-[var(--risk-high-text)] border border-[var(--risk-high-border)] shadow-sm animate-fadeIn">
                <span>Level: {filters.risk_level}</span>
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, risk_level: 'All' })}
                  className="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                  title="Clear level filter"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Filter by Level</span>
            )}
          </div>

          {/* Folder 2: Category */}
          <div className="flex flex-col items-center gap-3 overflow-visible relative z-10 hover:z-30 focus-within:z-30 w-full max-w-[280px]">
            <ThemedFolderFloat
              items={['All', ...CATEGORIES]}
              label="Category"
              sublabel={filters.category && filters.category !== 'All' ? filters.category : '10 categories'}
              width={180}
              maxSpread={210}
              itemColor={isLight ? '#06b6d4' : '#22d3ee'}
              itemTextColor="#090d16"
              folderColor={isLight ? '#bae6fd' : '#0f172a'}
              frontColor={isLight ? '#e0f2fe' : '#1e293b'}
              paperColor={isLight ? '#ffffff' : '#334155'}
              labelColor={isLight ? '#0369a1' : '#f8fafc'}
              onSelect={(cat) => onFilterChange({ ...filters, category: cat as ThreatCategory | 'All' })}
              className="shadow-xl"
            />
            {filters.category && filters.category !== 'All' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500 shadow-sm animate-fadeIn">
                <span>Category: {filters.category}</span>
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, category: 'All' })}
                  className="w-4 h-4 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                  title="Clear category filter"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Filter by Category</span>
            )}
          </div>

          {/* Folder 3: Status */}
          <div className="flex flex-col items-center gap-3 overflow-visible relative z-10 hover:z-30 focus-within:z-30 w-full max-w-[280px]">
            <ThemedFolderFloat
              items={['All', ...STATUSES]}
              label="Status"
              sublabel={filters.status && filters.status !== 'All' ? filters.status : '4 statuses'}
              width={180}
              maxSpread={150}
              itemColor={isLight ? '#a855f7' : '#a855f7'}
              itemTextColor="#090d16"
              folderColor={isLight ? '#e9d5ff' : '#1e1b4b'}
              frontColor={isLight ? '#f3e8ff' : '#312e81'}
              paperColor={isLight ? '#ffffff' : '#4338ca'}
              labelColor={isLight ? '#6b21a8' : '#f5f3ff'}
              onSelect={(st) => onFilterChange({ ...filters, status: st as ThreatStatus | 'All' })}
              className="shadow-xl"
            />
            {filters.status && filters.status !== 'All' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500 shadow-sm animate-fadeIn">
                <span>Status: {filters.status}</span>
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, status: 'All' })}
                  className="w-4 h-4 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                  title="Clear status filter"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Filter by Status</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatFiltersBar;
