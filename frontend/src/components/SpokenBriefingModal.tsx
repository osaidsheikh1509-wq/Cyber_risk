import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Languages,
  Search,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { Threat, ThreatBriefingResponse } from '../types/threat';
import { fetchThreatBriefing } from '../services/threatApi';

const BRIEFING_LANGUAGES = [
  { label: 'English', code: 'en-IN' },
  { label: 'Hindi (हिंदी)', code: 'hi-IN' },
  { label: 'Kannada (ಕನ್ನಡ)', code: 'kn-IN' },
  { label: 'Tamil (தமிழ்)', code: 'ta-IN' },
  { label: 'Telugu (తెలుగు)', code: 'te-IN' },
  { label: 'Bengali (বাংলা)', code: 'bn-IN' },
  { label: 'Marathi (मराठी)', code: 'mr-IN' },
  { label: 'Gujarati (ગુજરાતી)', code: 'gu-IN' },
  { label: 'Malayalam (മലയാളം)', code: 'ml-IN' },
  { label: 'Punjabi (ਪੰਜਾਬੀ)', code: 'pa-IN' },
  { label: 'Odia (ଓଡ଼ିଆ)', code: 'od-IN' },
];

interface SpokenBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  threats: Threat[];
  onNavigateToDetail: (threatId: number | string) => void;
}

export const SpokenBriefingModal: React.FC<SpokenBriefingModalProps> = ({
  isOpen,
  onClose,
  threats,
  onNavigateToDetail,
}) => {
  const [selectedThreatId, setSelectedThreatId] = useState<number | string | null>(null);
  const [briefingLang, setBriefingLang] = useState<string>('en-IN');
  const [loadingBriefing, setLoadingBriefing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [briefingData, setBriefingData] = useState<ThreatBriefingResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  // Set default selected threat when modal opens or threats change
  useEffect(() => {
    if (isOpen && threats.length > 0 && selectedThreatId === null) {
      setSelectedThreatId(threats[0].id);
    }
  }, [isOpen, threats, selectedThreatId]);

  // Clean up audio blob URL on unmount or URL replacement
  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
        audioBlobUrlRef.current = null;
      }
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const selectedThreat = useMemo(() => {
    return threats.find((t) => t.id === selectedThreatId) || null;
  }, [threats, selectedThreatId]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    threats.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['All', ...Array.from(set)];
  }, [threats]);

  // Filtered threats
  const filteredThreats = useMemo(() => {
    return threats.filter((t) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.affected_asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [threats, searchQuery, categoryFilter]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const applyBriefingResponse = (res: ThreatBriefingResponse) => {
    setBriefingData(res);
    setErrorMessage(null);

    if (res.audio_base64) {
      try {
        const binaryStr = atob(res.audio_base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], { type: 'audio/wav' });

        if (audioBlobUrlRef.current) {
          URL.revokeObjectURL(audioBlobUrlRef.current);
        }

        const newUrl = URL.createObjectURL(blob);
        audioBlobUrlRef.current = newUrl;
        setAudioUrl(newUrl);

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current
              .play()
              .then(() => setIsPlayingAudio(true))
              .catch((err) => console.log('Autoplay deferred until user interaction:', err));
          }
        }, 80);
      } catch (err) {
        console.error('Failed to decode audio base64:', err);
        setErrorMessage('Failed to decode synthesized audio.');
      }
    }
  };

  const fetchAndPlayBriefing = async (
    targetThreatId: number | string,
    targetLang: string,
    bypassCache: boolean
  ) => {
    try {
      setLoadingBriefing(true);
      setErrorMessage(null);
      const res = await fetchThreatBriefing(targetThreatId, targetLang, bypassCache);
      setBriefingLang(targetLang);
      applyBriefingResponse(res);
      showNotification(
        res.cached
          ? '⚡ Audio briefing loaded from cache (Zero credits used)'
          : '⚡ Fresh audio briefing synthesized via Sarvam AI',
        'success'
      );
    } catch (err: any) {
      console.error(`Briefing error for ${targetLang}:`, err);
      const errorMsg = err?.message || 'Failed to generate audio briefing';
      const langLabel = BRIEFING_LANGUAGES.find((l) => l.code === targetLang)?.label || targetLang;

      if (targetLang !== 'en-IN') {
        showNotification(
          `⚠️ Briefing failed for ${langLabel}: ${errorMsg}. Falling back to English...`,
          'error'
        );
        try {
          const enRes = await fetchThreatBriefing(targetThreatId, 'en-IN', bypassCache);
          setBriefingLang('en-IN');
          applyBriefingResponse(enRes);
          showNotification('⚡ Playing English briefing fallback.', 'info');
        } catch (fallbackErr: any) {
          const failMsg = `Sarvam AI briefing failed for English: ${fallbackErr?.message || 'Error'}`;
          setErrorMessage(failMsg);
          showNotification(`⚠️ ${failMsg}`, 'error');
        }
      } else {
        const failMsg = `Sarvam AI briefing failed for English: ${errorMsg}`;
        setErrorMessage(failMsg);
        showNotification(`⚠️ ${failMsg}`, 'error');
      }
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleSelectThreat = async (threat: Threat) => {
    if (selectedThreatId === threat.id && briefingData) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }

    setSelectedThreatId(threat.id);
    setBriefingData(null);
    setAudioUrl(null);
    await fetchAndPlayBriefing(threat.id, briefingLang, false);
  };

  const handleTogglePlay = async () => {
    if (!selectedThreat) return;

    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (briefingData && briefingData.language_code === briefingLang && audioUrl && audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlayingAudio(true);
        return;
      } catch (err) {
        console.error('Audio play error:', err);
      }
    }

    await fetchAndPlayBriefing(selectedThreat.id, briefingLang, false);
  };

  const handleRegenerate = async () => {
    if (!selectedThreat) return;
    await fetchAndPlayBriefing(selectedThreat.id, briefingLang, true);
  };

  const handleLanguageChange = async (newLang: string) => {
    setBriefingLang(newLang);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
    if (!selectedThreat) return;
    await fetchAndPlayBriefing(selectedThreat.id, newLang, false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl text-[var(--text-primary)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-purple-500/20 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-sm">
              <Volume2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-mono tracking-tight">
                  Spoken Threat Briefing Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-semibold">
                  {threats.length} threats present
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Select any registered threat below to hear its AI-synthesized spoken briefing in 11 Indic languages
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
            title="Close briefing modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`px-4 py-2 text-xs font-mono flex items-center justify-between shrink-0 transition ${
              notification.type === 'error'
                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-b border-rose-300 dark:border-rose-800'
                : notification.type === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-b border-emerald-300 dark:border-emerald-800'
                : 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border-b border-cyan-300 dark:border-cyan-800'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Message Banner */}
        {errorMessage && (
          <div className="px-4 py-2.5 bg-rose-100 dark:bg-rose-950/80 border-b border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-mono flex items-center justify-between shrink-0">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
              {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Active Player Card (if a threat is selected) */}
          {selectedThreat ? (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-5 shadow-xl space-y-4">
              {/* Selected Threat Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800 font-bold">
                      #{selectedThreat.id}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                        selectedThreat.risk_level === 'Critical'
                          ? 'bg-[var(--risk-critical-bg)] text-[var(--risk-critical-text)] border border-[var(--risk-critical-border)]'
                          : selectedThreat.risk_level === 'High'
                          ? 'bg-[var(--risk-high-bg)] text-[var(--risk-high-text)] border border-[var(--risk-high-border)]'
                          : selectedThreat.risk_level === 'Medium'
                          ? 'bg-[var(--risk-medium-bg)] text-[var(--risk-medium-text)] border border-[var(--risk-medium-border)]'
                          : 'bg-[var(--risk-low-bg)] text-[var(--risk-low-text)] border border-[var(--risk-low-border)]'
                      }`}
                    >
                      {selectedThreat.risk_level} (Score: {selectedThreat.risk_score}/25)
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                      {selectedThreat.category}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      Status: <strong className="text-[var(--text-secondary)]">{selectedThreat.status}</strong>
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug">
                    {selectedThreat.title}
                  </h3>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span className="font-mono">Target:</span>
                    <span className="font-mono text-cyan-600 dark:text-cyan-300">{selectedThreat.affected_asset}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToDetail(selectedThreat.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-cyan-600 dark:text-cyan-300 hover:text-cyan-700 dark:hover:text-white bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-700/50 transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <span>Full Threat Detail</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Player Controls Bar */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                      isPlayingAudio
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-[var(--shadow-glow)]'
                        : 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700/50 text-purple-600 dark:text-purple-300'
                    }`}
                  >
                    <Radio className={`w-4 h-4 ${isPlayingAudio ? 'animate-pulse text-cyan-600 dark:text-cyan-300' : ''}`} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Neural Spoken Briefing</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      Bulbul v3 TTS & Mayura v1 Translation
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Language Selector */}
                  <select
                    value={briefingLang}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={loadingBriefing}
                    className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-cyan-500 rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
                  >
                    {BRIEFING_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>

                  {/* Play / Pause Button */}
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    disabled={loadingBriefing}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer ${
                      isPlayingAudio
                        ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                        : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white shadow-[var(--shadow-glow)]'
                    }`}
                  >
                    {loadingBriefing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Synthesizing audio...</span>
                      </>
                    ) : isPlayingAudio ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause Briefing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Listen to Briefing</span>
                      </>
                    )}
                  </button>

                  {/* Regenerate Button */}
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={loadingBriefing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-card)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-cyan-500/50 transition cursor-pointer disabled:opacity-50 shadow-sm"
                    title="Force fresh generation via Sarvam AI (bypasses cache)"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loadingBriefing ? 'animate-spin text-cyan-500' : ''}`} />
                    <span className="hidden sm:inline">Regenerate</span>
                  </button>
                </div>
              </div>

              {/* HTML5 Audio Player */}
              {audioUrl && (
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] backdrop-blur-md flex flex-col sm:flex-row items-center gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-600 dark:text-cyan-300 shrink-0">
                    <Volume2 className="w-4 h-4 text-cyan-500" />
                    <span className="font-semibold">Player:</span>
                  </div>
                  <audio
                    ref={audioRef}
                    controls
                    src={audioUrl}
                    className="w-full sm:flex-1 h-8 rounded-lg outline-none accent-cyan-500"
                    onPlay={() => setIsPlayingAudio(true)}
                    onPause={() => setIsPlayingAudio(false)}
                    onEnded={() => setIsPlayingAudio(false)}
                  />
                </div>
              )}

              {/* Spoken Briefing Transcript */}
              {briefingData && (
                <div className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-xs animate-fadeIn space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] border-b border-[var(--border-color)] pb-1.5">
                    <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300 font-semibold">
                      <Languages className="w-3.5 h-3.5 text-purple-500" />
                      Briefing Transcript —{' '}
                      {BRIEFING_LANGUAGES.find((l) => l.code === briefingData.language_code)?.label ||
                        briefingData.language_code}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] font-mono">
                      {briefingData.cached ? '⚡ Cached (Zero API credits)' : '⚡ Freshly Synthesized'}
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed font-sans text-xs sm:text-sm">
                    {briefingData.briefing_text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No threat selected yet.</p>
              <p className="text-xs text-[var(--text-muted)]">Pick any threat from the list below to play its briefing.</p>
            </div>
          )}

          {/* Section: All Threats Present in the Registry */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] font-bold flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  Select From All Threats Present ({filteredThreats.length} of {threats.length})
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Click on any card to load and play its spoken audio briefing
                </p>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search threats..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'All' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of All Threats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {filteredThreats.map((threat) => {
                const isSelected = selectedThreatId === threat.id;
                return (
                  <div
                    key={threat.id}
                    onClick={() => handleSelectThreat(threat)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-3 text-left ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 shadow-md dark:shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'bg-[var(--bg-card)] hover:bg-[var(--bg-surface-elevated)] border-[var(--border-color)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                            #{threat.id}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              threat.risk_level === 'Critical'
                                ? 'bg-[var(--risk-critical-bg)] text-[var(--risk-critical-text)] border border-[var(--risk-critical-border)]'
                                : threat.risk_level === 'High'
                                ? 'bg-[var(--risk-high-bg)] text-[var(--risk-high-text)] border border-[var(--risk-high-border)]'
                                : threat.risk_level === 'Medium'
                                ? 'bg-[var(--risk-medium-bg)] text-[var(--risk-medium-text)] border border-[var(--risk-medium-border)]'
                                : 'bg-[var(--risk-low-bg)] text-[var(--risk-low-text)] border border-[var(--risk-low-border)]'
                            }`}
                          >
                            {threat.risk_level} ({threat.risk_score})
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-card-subtle)] text-[var(--text-secondary)]">
                            {threat.category}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-800 font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Selected
                          </span>
                        )}
                      </div>

                      <h5 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] line-clamp-2 leading-snug">
                        {threat.title}
                      </h5>

                      <p className="text-[11px] font-mono text-[var(--text-muted)] mt-1 line-clamp-1">
                        Asset: <span className="text-[var(--text-secondary)]">{threat.affected_asset}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)] text-[11px]">
                      <span className="font-mono text-[var(--text-muted)]">
                        Status: <span className="text-[var(--text-secondary)]">{threat.status}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectThreat(threat);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${
                            isSelected && isPlayingAudio
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] text-cyan-600 dark:text-cyan-300 border border-[var(--border-color)]'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isSelected && isPlayingAudio ? 'Playing' : 'Listen'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onNavigateToDetail(threat.id);
                          }}
                          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
                          title="View Details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredThreats.length === 0 && (
                <div className="col-span-full py-8 text-center text-[var(--text-muted)] text-xs font-mono">
                  No threats found matching "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-card-subtle)] flex items-center justify-between shrink-0 text-xs font-mono text-[var(--text-muted)]">
          <span>Supported: 11 Indic languages via Sarvam AI Mayura + Bulbul v3</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)] transition cursor-pointer font-sans text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpokenBriefingModal;
