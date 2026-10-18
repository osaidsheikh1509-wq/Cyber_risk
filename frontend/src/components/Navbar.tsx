import React from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Radio, Plus } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  isOnline: boolean;
  loading: boolean;
  totalThreats: number;
  onRefresh: () => void;
  onOpenNewThreat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  loading,
  totalThreats,
  onRefresh,
  onOpenNewThreat,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:bg-cyan-950/80 dark:border-cyan-800/60 dark:text-cyan-400 shadow-[var(--shadow-glow)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5 sm:gap-2">
              <span>CYBER RISK</span>
              <span className="hidden xs:inline">TRACKER</span>
              <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 dark:border-cyan-800/60 uppercase">
                SOC
              </span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] hidden md:block">
              Continuous Threat Surface & Vulnerability Management
            </p>
          </div>
        </div>

        {/* Action Controls & Status */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Active Threats Counter */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-mono bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
            <Radio className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 animate-pulse" />
            <span className="text-[var(--text-muted)]">Tracked:</span>
            <span className="text-[var(--text-primary)] font-bold">{totalThreats}</span>
          </div>

          {/* Backend Online Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-mono bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">API Connected</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium sm:hidden">API</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-rose-500 font-medium hidden sm:inline">Reconnecting...</span>
                <span className="text-rose-500 font-medium sm:hidden">Offline</span>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 sm:p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-50 cursor-pointer"
            title="Refresh Dashboard Data"
            aria-label="Refresh Dashboard Data"
          >
            <RefreshCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>

          {/* Theme Toggle - Animated Sun/Moon Switch */}
          <ThemeToggle />

          {/* New Threat Button */}
          {onOpenNewThreat && (
            <button
              onClick={onOpenNewThreat}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[var(--shadow-glow)] cursor-pointer"
              aria-label="Create New Threat"
            >
              <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span className="hidden sm:inline">New Threat</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
