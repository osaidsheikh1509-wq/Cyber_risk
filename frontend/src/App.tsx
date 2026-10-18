import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { RiskTrendChart } from './components/RiskTrendChart';
import { ThreatFiltersBar } from './components/ThreatFiltersBar';
import { ThreatCard } from './components/ThreatCard';
import { ThreatTimelineModal } from './components/ThreatTimelineModal';
import { ThreatDetailPage } from './components/ThreatDetailPage';
import { ThreatModal } from './components/ThreatModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ToastContainer, ToastMessage } from './components/Toast';
import { FanCards } from './components/FanCards';
import { SpokenBriefingModal } from './components/SpokenBriefingModal';
import { DoubleVerificationLogin } from './components/DoubleVerificationLogin';
import { useAuth } from './context/AuthContext';
import {
  fetchThreats,
  fetchThreatStats,
  createThreat,
  updateThreat,
  deleteThreat,
} from './services/threatApi';
import { Threat, ThreatStats, ThreatFilters, RiskLevel, ThreatInput } from './types/threat';
import { ShieldAlert, Terminal, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [totalMatchingThreats, setTotalMatchingThreats] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const PAGE_SIZE = 12;

  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active view: either Dashboard (null) or Threat Detail Page (threatId)
  const [activeThreatId, setActiveThreatId] = useState<number | string | null>(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#threat-(.+)$/);
    return match ? match[1] : null;
  });

  // Filters state
  const [filters, setFilters] = useState<ThreatFilters>({
    category: 'All',
    risk_level: 'All',
    status: 'All',
    search: '',
  });

  // Quick Timeline modal state
  const [quickTimelineThreat, setQuickTimelineThreat] = useState<Threat | null>(null);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState<boolean>(false);

  // Create / Edit Threat Modal state
  const [isThreatModalOpen, setIsThreatModalOpen] = useState<boolean>(false);
  const [threatModalMode, setThreatModalMode] = useState<'create' | 'edit'>('create');
  const [editingThreat, setEditingThreat] = useState<Threat | null>(null);
  const [voiceReadyModal, setVoiceReadyModal] = useState<boolean>(false);
  const [isSpokenBriefingModalOpen, setIsSpokenBriefingModalOpen] = useState<boolean>(false);

  // Authentication & Double Verification State
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Delete Confirmation Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [threatToDelete, setThreatToDelete] = useState<Threat | null>(null);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // URL hash sync for browser Back / Forward buttons & deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#threat-(.+)$/);
      setActiveThreatId(match ? match[1] : null);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToDetail = (threatId: number | string) => {
    setActiveThreatId(threatId);
    window.location.hash = `threat-${threatId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDashboard = () => {
    setActiveThreatId(null);
    window.location.hash = '';
  };

  // Data loading function (resets to page 1)
  const loadData = useCallback(async (currentFilters: ThreatFilters) => {
    setLoading(true);
    try {
      const [statsData, pagedData] = await Promise.all([
        fetchThreatStats(),
        fetchThreats({ ...currentFilters, limit: PAGE_SIZE, page: 1 }),
      ]);

      setStats(statsData);
      setThreats(pagedData.items);
      setTotalMatchingThreats(pagedData.total);
      setPage(1);
      setIsOnline(true);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Data load error:', err);
      setIsOnline(false);
      setErrorMessage(err?.message || 'Failed to communicate with Threat Intelligence backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load more function for pagination
  const handleLoadMore = async () => {
    if (loadingMore || threats.length >= totalMatchingThreats) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const pagedData = await fetchThreats({ ...filters, limit: PAGE_SIZE, page: nextPage });

      setThreats((prev) => {
        const existingIds = new Set(prev.map((t) => String(t.id)));
        const newItems = pagedData.items.filter((t) => !existingIds.has(String(t.id)));
        return [...prev, ...newItems];
      });
      setTotalMatchingThreats(pagedData.total);
      setPage(nextPage);
    } catch (err: any) {
      addToast('error', `Failed to load more threats: ${err?.message}`);
    } finally {
      setLoadingMore(false);
    }
  };

  // Initial load and filter change trigger
  useEffect(() => {
    loadData(filters);
  }, [loadData, filters]);

  // Handle clicking on summary cards to toggle level filter
  const handleSelectLevel = (level: RiskLevel | 'All') => {
    setFilters((prev) => ({
      ...prev,
      risk_level: level,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      category: 'All',
      risk_level: 'All',
      status: 'All',
      search: '',
    });
  };

  const handleOpenQuickTimeline = (threat: Threat) => {
    setQuickTimelineThreat(threat);
    setIsTimelineModalOpen(true);
  };

  // Open "New Threat" modal
  const handleOpenNewThreat = () => {
    setThreatModalMode('create');
    setEditingThreat(null);
    setVoiceReadyModal(false);
    setIsThreatModalOpen(true);
  };

  // Feature Showcase Fan Cards Handlers
  const handleVoiceReportCard = () => {
    setThreatModalMode('create');
    setEditingThreat(null);
    setVoiceReadyModal(true);
    setIsThreatModalOpen(true);
  };

  const handleAiAnalysisCard = () => {
    const el = document.getElementById('threats-registry');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSpokenBriefingCard = () => {
    setIsSpokenBriefingModalOpen(true);
  };

  // Open "Edit Threat" modal
  const handleOpenEditThreat = (threat: Threat) => {
    setThreatModalMode('edit');
    setEditingThreat(threat);
    setIsThreatModalOpen(true);
  };

  // Handle Create or Edit Submission
  const handleSaveThreat = async (data: ThreatInput) => {
    if (threatModalMode === 'create') {
      const created = await createThreat(data);
      addToast(
        'success',
        `Threat "${created.title}" registered successfully (Score: ${created.risk_score}, Tier: ${created.risk_level}).`
      );
    } else if (editingThreat) {
      const updated = await updateThreat(editingThreat.id, data);
      addToast(
        'success',
        `Threat #${updated.id} "${updated.title}" updated successfully.`
      );
    }
    await loadData(filters);
  };

  // Open Delete confirmation dialog
  const handlePromptDelete = (threat: Threat) => {
    setThreatToDelete(threat);
    setIsConfirmOpen(true);
  };

  // Confirm Delete execution
  const handleConfirmDelete = async () => {
    if (!threatToDelete) return;
    try {
      await deleteThreat(threatToDelete.id);
      addToast('success', `Threat #${threatToDelete.id} "${threatToDelete.title}" deleted.`);
      setIsConfirmOpen(false);
      setThreatToDelete(null);

      // If we are on the deleted threat's detail page, return to dashboard
      if (activeThreatId === threatToDelete.id) {
        navigateToDashboard();
      }

      await loadData(filters);
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to delete threat.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar with New Threat trigger */}
      <Navbar
        isOnline={isOnline}
        loading={loading}
        totalThreats={stats?.total_threats || 0}
        onRefresh={() => loadData(filters)}
        onOpenNewThreat={handleOpenNewThreat}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Main Content: View Switcher */}
      <main className="flex-1 w-full">
        {activeThreatId !== null ? (
          /* Detailed Threat Profile Page */
          <ThreatDetailPage
            threatId={activeThreatId}
            onBack={navigateToDashboard}
            onThreatUpdated={() => loadData(filters)}
            onEdit={handleOpenEditThreat}
            onDelete={handlePromptDelete}
          />
        ) : (
          /* Dashboard Overview Page */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center justify-between text-sm shadow-sm">
                <div className="flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => loadData(filters)}
                  className="px-3 py-1 rounded bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 text-xs font-mono font-medium transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Feature Showcase (Glass Fan Cards) */}
            <FanCards
              onVoiceReport={handleVoiceReportCard}
              onAiAnalysis={handleAiAnalysisCard}
              onSpokenBriefing={handleSpokenBriefingCard}
            />

            {/* 1. Summary Cards (Critical / High / Medium / Low) */}
            <SummaryCards
              stats={stats}
              selectedLevel={filters.risk_level || 'All'}
              onSelectLevel={handleSelectLevel}
              loading={loading}
            />

            {/* 2. 30-Day Risk Trend Line Chart (Recharts) */}
            {stats?.trend_30d && (
              <RiskTrendChart
                trendData={stats.trend_30d}
                averageScore={stats.average_risk_score}
              />
            )}

            {/* 3. Filter Bar (Level, Status, Category, Search) */}
            <div id="threats-registry" className="flex items-center justify-between mb-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-500" />
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Active Cybersecurity Threats Registry
                </h2>
              </div>
            </div>

            <ThreatFiltersBar
              filters={filters}
              onFilterChange={setFilters}
              onReset={handleResetFilters}
              totalFiltered={totalMatchingThreats || threats.length}
            />

            {/* 4. Latest Threat Cards Grid (Responsive Mobile/Desktop) */}
            {loading && threats.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse space-y-4"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                      <div className="flex gap-2">
                        <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-full" />
                      </div>
                    </div>
                    <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-full bg-slate-200/70 dark:bg-slate-800/70 rounded" />
                      <div className="h-3 w-5/6 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
                    </div>
                    <div className="h-8 w-full bg-slate-200/50 dark:bg-slate-800/40 rounded-lg" />
                    <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
                      <div className="flex justify-between">
                        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !isOnline && threats.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 max-w-lg mx-auto my-8">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Backend Connection Offline</h3>
                <p className="text-xs text-[var(--text-muted)] mb-5">
                  Could not connect to FastAPI Threat Intelligence server at http://127.0.0.1:8000. Ensure the backend daemon is running.
                </p>
                <button
                  onClick={() => loadData(filters)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : threats.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]">
                <ShieldAlert className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {stats?.total_threats === 0
                    ? 'No cybersecurity threats registered in database.'
                    : 'No threats match current filter criteria.'}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {stats?.total_threats === 0
                    ? 'Register your first threat incident manually or report it via voice audio.'
                    : 'Try clearing your category, status, or search query filters.'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  {stats?.total_threats === 0 ? (
                    <button
                      onClick={handleOpenNewThreat}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition cursor-pointer"
                    >
                      + Register First Threat
                    </button>
                  ) : (
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-secondary)] transition cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {threats.map((threat) => (
                    <ThreatCard
                      key={threat.id}
                      threat={threat}
                      onOpenTimeline={handleOpenQuickTimeline}
                      onSelectThreat={(t) => navigateToDetail(t.id)}
                      onEdit={handleOpenEditThreat}
                      onDelete={handlePromptDelete}
                    />
                  ))}
                </div>

                {/* Pagination / Load More Controls */}
                {threats.length < totalMatchingThreats && (
                  <div className="mt-8 flex flex-col items-center justify-center gap-3">
                    <div className="text-xs text-[var(--text-muted)] font-mono">
                      Showing <span className="font-semibold text-[var(--text-primary)]">{threats.length}</span> of{' '}
                      <span className="font-semibold text-[var(--text-primary)]">{totalMatchingThreats}</span> threats
                    </div>
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-card)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] shadow-sm hover:shadow transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                          <span>Loading more threats...</span>
                        </>
                      ) : (
                        <span>Load More Threats ({totalMatchingThreats - threats.length} remaining)</span>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] py-5 text-center text-xs text-[var(--text-muted)] font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-500" />
            <span>Cyber Risk Tracker Console • React + Vite + TypeScript + Recharts + Tailwind</span>
          </div>
          <div className="text-[var(--text-muted)]">
            Status: <span className="text-emerald-500 font-semibold">Live Monitoring Active</span>
          </div>
        </div>
      </footer>

      {/* New / Edit Threat Modal */}
      <ThreatModal
        isOpen={isThreatModalOpen}
        mode={threatModalMode}
        threat={editingThreat}
        initialVoiceReady={voiceReadyModal}
        onClose={() => {
          setIsThreatModalOpen(false);
          setEditingThreat(null);
          setVoiceReadyModal(false);
        }}
        onSubmit={handleSaveThreat}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete Threat Registry Entry"
        message={
          threatToDelete
            ? `Are you sure you want to permanently delete threat #${threatToDelete.id} "${threatToDelete.title}"? This action will permanently remove all associated audit timeline events.`
            : 'Are you sure you want to delete this threat?'
        }
        confirmText="Delete Threat"
        cancelText="Keep Threat"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setThreatToDelete(null);
        }}
      />

      {/* Quick Timeline Modal */}
      <ThreatTimelineModal
        threat={quickTimelineThreat}
        isOpen={isTimelineModalOpen}
        onClose={() => {
          setIsTimelineModalOpen(false);
          setQuickTimelineThreat(null);
        }}
      />

      {/* Spoken Threat Briefing Studio Modal */}
      <SpokenBriefingModal
        isOpen={isSpokenBriefingModalOpen}
        onClose={() => setIsSpokenBriefingModalOpen(false)}
        threats={threats}
        onNavigateToDetail={navigateToDetail}
      />

      {/* Double Verification 2FA Login Modal */}
      {(!isAuthenticated || isLoginModalOpen) && !authLoading && (
        <DoubleVerificationLogin
          onSuccess={() => {
            setIsLoginModalOpen(false);
            addToast('success', `Double verification complete. SOC terminal access granted for ${user?.full_name || 'Operator'}.`);
          }}
        />
      )}

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;
