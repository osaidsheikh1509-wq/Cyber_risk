import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Server,
  Calendar,
  Send,
  History,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  Edit2,
  Trash2,
  Volume2,
  Play,
  Pause,
  Loader2,
  Languages,
  ShieldCheck,
  ListChecks,
  Clock,
} from 'lucide-react';
import { Threat, TimelineEvent, ThreatStatus, RiskLevel, ThreatBriefingResponse } from '../types/threat';
import { RiskScoreGauge } from './RiskScoreGauge';
import {
  fetchThreatById,
  fetchThreatTimeline,
  updateThreatStatus,
  updateThreatAssessment,
  addTimelineNote,
  fetchThreatBriefing,
} from '../services/threatApi';
import { ThemedFolderFloat } from './FolderFloat';
import { getRecommendedActions } from '../utils/threatActions';
import { useTheme } from '../context/ThemeContext';

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

interface ThreatDetailPageProps {
  threatId: number | string;
  onBack: () => void;
  onThreatUpdated?: () => void;
  onEdit?: (threat: Threat) => void;
  onDelete?: (threat: Threat) => void;
}

export const ThreatDetailPage: React.FC<ThreatDetailPageProps> = ({
  threatId,
  onBack,
  onThreatUpdated,
  onEdit,
  onDelete,
}) => {
  const { isLight } = useTheme();

  const [threat, setThreat] = useState<Threat | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [newNote, setNewNote] = useState<string>('');
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedAsset, setCopiedAsset] = useState<boolean>(false);

  // Editable Likelihood & Impact state
  const [likelihood, setLikelihood] = useState<number>(3);
  const [impact, setImpact] = useState<number>(3);
  const [savingAssessment, setSavingAssessment] = useState<boolean>(false);

  // Multilingual Audio Briefing state
  const [briefingLang, setBriefingLang] = useState<string>('en-IN');
  const [loadingBriefing, setLoadingBriefing] = useState<boolean>(false);
  const [briefingData, setBriefingData] = useState<ThreatBriefingResponse | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio blob URL helper (decodes base64 into audio/wav Blob URL)
  const createAudioBlobUrl = (base64Str: string): string => {
    const binaryString = window.atob(base64Str.trim());
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  // Audio cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const applyBriefingResponse = (data: ThreatBriefingResponse) => {
    setBriefingData(data);
    if (data.audio_base64) {
      try {
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }
        const newUrl = createAudioBlobUrl(data.audio_base64);
        audioUrlRef.current = newUrl;
        setAudioUrl(newUrl);

        // Auto play with user controls synced
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = newUrl;
            audioRef.current.currentTime = 0;
            audioRef.current
              .play()
              .then(() => setIsPlayingAudio(true))
              .catch((err) => {
                console.warn('Audio auto-play prevented or error:', err);
                setIsPlayingAudio(false);
              });
          }
        }, 50);
      } catch (err) {
        console.error('Failed to decode audio base64:', err);
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
      const res = await fetchThreatBriefing(targetThreatId, targetLang, bypassCache);
      setBriefingLang(targetLang);
      applyBriefingResponse(res);
      showNotification(
        res.cached
          ? '⚡ Audio briefing loaded from cache (Credits saved)'
          : '⚡ Fresh audio briefing synthesized via Sarvam AI'
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
          showNotification('⚡ Playing English briefing fallback.');
        } catch (fallbackErr: any) {
          showNotification(
            `⚠️ Sarvam AI briefing failed for English: ${fallbackErr?.message || 'Error'}`,
            'error'
          );
        }
      } else {
        showNotification(`⚠️ Sarvam AI briefing failed for English: ${errorMsg}`, 'error');
      }
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleToggleBriefing = async () => {
    if (!threat) return;

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

    await fetchAndPlayBriefing(threat.id, briefingLang, false);
  };

  const handleRegenerateBriefing = async () => {
    if (!threat) return;
    await fetchAndPlayBriefing(threat.id, briefingLang, true);
  };

  const handleLanguageChange = async (newLang: string) => {
    setBriefingLang(newLang);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
    if (!threat) return;
    await fetchAndPlayBriefing(threat.id, newLang, false);
  };

  const loadThreatData = useCallback(async () => {
    setLoading(true);
    try {
      const [threatData, timelineData] = await Promise.all([
        fetchThreatById(threatId),
        fetchThreatTimeline(threatId),
      ]);
      setThreat(threatData);
      setTimeline(timelineData);
      setLikelihood(threatData.likelihood);
      setImpact(threatData.impact);
    } catch (err: any) {
      console.error('Failed to load threat details:', err);
    } finally {
      setLoading(false);
    }
  }, [threatId]);

  useEffect(() => {
    loadThreatData();
  }, [loadThreatData]);

  // Recommended actions and completed actions logic
  const recommendedActions = useMemo(() => {
    return threat ? getRecommendedActions(threat.category) : [];
  }, [threat]);

  const completedActions = useMemo(() => {
    return timeline
      .filter((e) => e.description.startsWith('Action taken: '))
      .map((e) => e.description.replace(/^Action taken:\s*/, '').trim());
  }, [timeline]);

  const handleTakeAction = async (actionText: string) => {
    if (!threat) return;
    const cleanAction = actionText.trim();

    if (completedActions.includes(cleanAction)) {
      showNotification(`Action "${cleanAction}" was already executed.`, 'success');
      return;
    }

    try {
      await addTimelineNote(threat.id, `Action taken: ${cleanAction}`);
      showNotification(`⚡ Action taken: "${cleanAction}" logged to timeline!`, 'success');
      await loadThreatData();
      if (onThreatUpdated) {
        onThreatUpdated();
      }
    } catch (err: any) {
      showNotification(`Failed to record action: ${err?.message || 'Error'}`, 'error');
    }
  };

  const handleStatusChange = async (newStatus: ThreatStatus) => {
    if (!threat || threat.status === newStatus) return;

    try {
      setUpdatingStatus(true);
      const updated = await updateThreatStatus(threat.id, newStatus);
      setThreat(updated);

      const updatedTimeline = await fetchThreatTimeline(threat.id);
      setTimeline(updatedTimeline);

      showNotification(`Status updated to "${newStatus}". Timeline event recorded.`);
      if (onThreatUpdated) onThreatUpdated();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      showNotification('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveAssessment = async () => {
    if (!threat) return;
    try {
      setSavingAssessment(true);
      const updated = await updateThreatAssessment(threat.id, likelihood, impact);
      setThreat(updated);

      const updatedTimeline = await fetchThreatTimeline(threat.id);
      setTimeline(updatedTimeline);

      showNotification(`Risk re-assessed to score ${updated.risk_score} (${updated.risk_level}). Timeline updated.`);
      if (onThreatUpdated) onThreatUpdated();
    } catch (err: any) {
      console.error('Failed to save assessment:', err);
      showNotification('Failed to update assessment.');
    } finally {
      setSavingAssessment(false);
    }
  };

  const handleLogNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threat || !newNote.trim()) return;

    try {
      setSubmittingNote(true);
      const createdEvent = await addTimelineNote(threat.id, newNote.trim());
      setTimeline([createdEvent, ...timeline]);
      setNewNote('');
      showNotification('Analyst timeline note added successfully.');
    } catch (err: any) {
      console.error('Failed to log note:', err);
      showNotification('Failed to log note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const copyAsset = () => {
    if (!threat) return;
    navigator.clipboard.writeText(threat.affected_asset);
    setCopiedAsset(true);
    setTimeout(() => setCopiedAsset(false), 2000);
  };

  const previewScore = likelihood * impact;
  const getPreviewLevel = (score: number): RiskLevel => {
    if (score >= 17) return 'Critical';
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  };
  const previewLevel = getPreviewLevel(previewScore);

  if (loading && !threat) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
          <div className="flex gap-2">
            <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-1/2 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
        </div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fadeIn">
        <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <ArrowLeft className="w-6 h-6 rotate-45" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Threat Record Not Found</h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mb-6 font-sans">
            Threat #{threatId} could not be located in the active threat intelligence database. It may have been deleted or archived.
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[var(--shadow-glow)] transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Threats Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const getEventBadgeStyle = (type: string) => {
    switch (type) {
      case 'CREATED':
        return 'text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800/80 dark:bg-emerald-950/70';
      case 'STATUS_CHANGED':
        return 'text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-400 dark:border-amber-800/80 dark:bg-amber-950/70';
      case 'ASSESSMENT_UPDATED':
        return 'text-rose-700 bg-rose-100 border-rose-300 dark:text-rose-400 dark:border-rose-800/80 dark:bg-rose-950/70';
      default:
        return 'text-cyan-700 bg-cyan-100 border-cyan-300 dark:text-cyan-400 dark:border-cyan-800/80 dark:bg-cyan-950/70';
    }
  };

  const likelihoodLabels = ['', 'Rare (1)', 'Unlikely (2)', 'Possible (3)', 'Likely (4)', 'Almost Certain (5)'];
  const impactLabels = ['', 'Negligible (1)', 'Minor (2)', 'Moderate (3)', 'Major (4)', 'Catastrophic (5)'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-md px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-mono animate-fadeIn ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-slate-900 dark:border-rose-500/70 dark:text-rose-300'
              : 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-slate-900 dark:border-cyan-500/50 dark:text-cyan-300'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          )}
          <span className="break-words">{notification.message}</span>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Threats Dashboard</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold uppercase bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800/60">
                {threat.category}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">Threat #{threat.id}</span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                Registered: {new Date(threat.created_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              {threat.title}
            </h1>
          </div>

          {/* Status Dropdown & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col items-start lg:items-end">
              <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                Investigation Status
              </span>
              <div className="relative">
                <select
                  value={threat.status}
                  disabled={updatingStatus}
                  onChange={(e) => handleStatusChange(e.target.value as ThreatStatus)}
                  className="px-4 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-cyan-500 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer disabled:opacity-50 transition"
                >
                  <option value="Open">Open</option>
                  <option value="Investigating">Investigating</option>
                  <option value="Mitigated">Mitigated</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            {onEdit && (
              <button
                onClick={() => onEdit(threat)}
                className="mt-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)] transition cursor-pointer"
                title="Edit Threat Details"
              >
                <Edit2 className="w-3.5 h-3.5 text-cyan-500" />
                <span>Edit</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => onDelete(threat)}
                className="mt-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition cursor-pointer"
                title="Delete Threat"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Multilingual Audio Briefing Widget */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-cyan-50 to-slate-50 border border-purple-200 dark:from-purple-950/40 dark:via-cyan-950/30 dark:to-slate-900 dark:border-purple-800/50 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition ${
                isPlayingAudio
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-[var(--shadow-glow)]'
                  : 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700/60 text-purple-600 dark:text-purple-300'
              }`}
            >
              <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse text-cyan-500' : ''}`} />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">Threat Intelligence Audio Briefing</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                Sarvam AI Voice Synthesis & Translation • Cached to conserve credits
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

            {/* Listen / Pause Button */}
            <button
              onClick={handleToggleBriefing}
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
                  <span>Generating audio...</span>
                </>
              ) : isPlayingAudio ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Briefing</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Listen to briefing</span>
                </>
              )}
            </button>

            {/* Regenerate Briefing Button */}
            <button
              type="button"
              onClick={handleRegenerateBriefing}
              disabled={loadingBriefing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-card)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-cyan-500/50 transition cursor-pointer disabled:opacity-50 shadow-sm"
              title="Force re-synthesis via Sarvam AI (bypasses cache)"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loadingBriefing ? 'animate-spin text-cyan-500' : ''}`} />
              <span>Regenerate briefing</span>
            </button>
          </div>
        </div>

        {/* Visible Audio Player with Controls */}
        {audioUrl && (
          <div className="mt-3 p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] backdrop-blur-md flex flex-col sm:flex-row items-center gap-3 animate-fadeIn shadow-lg">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-600 dark:text-cyan-300 shrink-0">
              <Volume2 className="w-4 h-4 text-cyan-500" />
              <span className="font-semibold">Audio Player:</span>
            </div>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full sm:flex-1 h-9 rounded-lg outline-none accent-cyan-500"
              onPlay={() => setIsPlayingAudio(true)}
              onPause={() => setIsPlayingAudio(false)}
              onEnded={() => setIsPlayingAudio(false)}
            />
          </div>
        )}

        {/* Display Translated Briefing Text */}
        {briefingData && (
          <div className="mt-3 p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-xs animate-fadeIn space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] border-b border-[var(--border-color)] pb-1.5">
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300 font-semibold">
                <Languages className="w-3.5 h-3.5 text-purple-500" />
                Spoken Briefing Transcript —{' '}
                {BRIEFING_LANGUAGES.find((l) => l.code === briefingData.language_code)?.label ||
                  briefingData.language_code}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] font-mono">
                {briefingData.cached ? '⚡ Cached (Zero API credits used)' : '⚡ Freshly Synthesized'}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed font-sans text-xs sm:text-sm">
              {briefingData.briefing_text}
            </p>
          </div>
        )}

        {/* Optional Use 3: Briefing Language Floating Folder */}
        <div className="mt-4 pt-52 pb-4 border-t border-[var(--border-color)] relative z-20 overflow-visible flex flex-col items-center justify-center gap-3">
          <ThemedFolderFloat
            items={BRIEFING_LANGUAGES.map((l) => ({ label: l.label, value: l.code }))}
            label="Briefing language"
            sublabel="11 languages"
            itemColor={isLight ? '#c084fc' : '#c084fc'}
            itemTextColor="#090d16"
            folderColor={isLight ? '#e9d5ff' : '#1e1b4b'}
            frontColor={isLight ? '#f3e8ff' : '#312e81'}
            paperColor={isLight ? '#ffffff' : '#4338ca'}
            labelColor={isLight ? '#6b21a8' : '#f5f3ff'}
            onSelect={(langCode) => handleLanguageChange(langCode)}
            className="shadow-2xl"
          />
          <p className="text-[11px] font-mono text-purple-600 dark:text-purple-300/80 text-center max-w-md">
            💡 Selecting a new language uses Sarvam AI translation & voice synthesis credits the first time (subsequent plays stream from cache).
          </p>
        </div>
      </div>

      {/* Main Grid: Left (Risk Gauge & Assessment) + Right (Asset & Description) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Column: Gauge and Likelihood/Impact Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Risk Score Gauge */}
          <RiskScoreGauge
            score={threat.risk_score}
            level={threat.risk_level}
            likelihood={threat.likelihood}
            impact={threat.impact}
          />

          {/* 2. Interactive Likelihood & Impact Matrix Controls */}
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Risk Re-Assessment
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Preview:{' '}
                <strong className="text-[var(--text-primary)]">{previewScore}</strong> ({previewLevel})
              </span>
            </div>

            {/* Likelihood Selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-[var(--text-muted)]">Likelihood:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">{likelihoodLabels[likelihood]}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLikelihood(lvl)}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      likelihood === lvl
                        ? 'bg-cyan-500 text-slate-950 shadow-[var(--shadow-glow)]'
                        : 'bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact Selector */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-[var(--text-muted)]">Impact:</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{impactLabels[impact]}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setImpact(lvl)}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      impact === lvl
                        ? 'bg-rose-500 text-white shadow-rose-500/30'
                        : 'bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveAssessment}
              disabled={
                savingAssessment ||
                (likelihood === threat.likelihood && impact === threat.impact)
              }
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[var(--shadow-glow)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {savingAssessment ? 'Recalculating...' : 'Update Likelihood & Impact'}
            </button>
          </div>
        </div>

        {/* Right Column: Affected Asset & Full Description (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Affected Asset Card */}
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Target / Affected Asset
              </span>
              <button
                onClick={copyAsset}
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition cursor-pointer"
              >
                {copiedAsset ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Asset</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-sm font-mono text-cyan-700 dark:text-cyan-300 break-all">
              <Server className="w-4 h-4 text-cyan-500 flex-shrink-0" />
              <span>{threat.affected_asset}</span>
            </div>
          </div>

          {/* Detailed Threat Description & Metadata */}
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
              Threat Intelligence & Impact Analysis
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans mb-6">
              {threat.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--border-color)] text-xs font-mono">
              <div>
                <span className="text-[var(--text-muted)] block mb-0.5">Category</span>
                <span className="text-[var(--text-primary)] font-semibold">{threat.category}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-0.5">Current Status</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{threat.status}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-0.5">Last Audit Activity</span>
                <span className="text-[var(--text-secondary)]">
                  {new Date(threat.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Actions & Incident Response Plan */}
      <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)] relative z-20 overflow-visible">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-color)] gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                Recommended Actions & Incident Response
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Pick mitigation steps from the floating folder to execute and log them to the incident audit timeline
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)]">
            Progress: <strong className="text-emerald-600 dark:text-emerald-400">{completedActions.length}</strong> / {recommendedActions.length} actions taken
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative overflow-visible">
          {/* Left Column: Floating Folder with ~200px reserved free space above */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center pt-52 pb-6 relative z-30 overflow-visible">
            <ThemedFolderFloat
              items={recommendedActions}
              label="Recommended actions"
              sublabel={`${recommendedActions.length} suggested`}
              closeOnSelect={false}
              itemColor={isLight ? '#10b981' : '#34d399'}
              itemTextColor="#022c22"
              folderColor={isLight ? '#a7f3d0' : '#064e3b'}
              frontColor={isLight ? '#d1fae5' : '#065f46'}
              paperColor={isLight ? '#ffffff' : '#047857'}
              labelColor={isLight ? '#065f46' : '#ecfdf5'}
              onSelect={(actionText) => handleTakeAction(actionText)}
              className="shadow-2xl"
            />
            <span className="text-[11px] font-mono text-[var(--text-muted)] mt-4 text-center">
              (Hover/tap folder to expand floating actions • Click pill to log action)
            </span>
          </div>

          {/* Right Column: Actions Taken Checklist Section */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-primary)] font-bold flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-500" />
                Actions Taken ({completedActions.length})
              </h3>
              {completedActions.length >= recommendedActions.length && recommendedActions.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                  ✓ All Mitigations Executed
                </span>
              )}
            </div>

            {completedActions.length > 0 ? (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {completedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 animate-fadeIn"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                        {action}
                      </p>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                        Status: Executed & logged in incident timeline
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-center space-y-2">
                <Clock className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  No mitigation actions logged yet.
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  Open the "Recommended actions" folder and click any action pill to execute and audit it.
                </p>
              </div>
            )}

            {/* Remaining Suggested Actions List */}
            {recommendedActions.filter((a) => !completedActions.includes(a)).length > 0 && (
              <div className="pt-3 border-t border-[var(--border-color)]">
                <span className="text-[11px] font-mono text-[var(--text-muted)] block mb-2">
                  Remaining Recommendations:
                </span>
                <div className="space-y-1.5">
                  {recommendedActions
                    .filter((a) => !completedActions.includes(a))
                    .map((action, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleTakeAction(action)}
                        className="w-full text-left p-2.5 rounded-lg bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-emerald-500/50 text-xs text-[var(--text-secondary)] transition flex items-center justify-between gap-2 group cursor-pointer"
                      >
                        <span className="line-clamp-1">{action}</span>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 opacity-0 group-hover:opacity-100 transition">
                          Take action →
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Full Vertical Timeline & Note Logger */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[var(--border-color)] gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                Incident Response & Audit Timeline
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Complete chronological activity log ({timeline.length} event{timeline.length !== 1 ? 's' : ''})
              </p>
            </div>
          </div>

          <button
            onClick={loadThreatData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card-subtle)] border border-[var(--border-color)] transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sync Timeline</span>
          </button>
        </div>

        {/* Form to Log Timeline Notes */}
        <form onSubmit={handleLogNote} className="mb-8 p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
          <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-2">
            Append Analyst Note or Action Log
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              required
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Host isolated via EDR agent; rotated affected API token in production vault..."
              className="flex-1 px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={submittingNote || !newNote.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[var(--shadow-glow)] disabled:opacity-50 cursor-pointer"
            >
              <span>{submittingNote ? 'Logging...' : 'Post Timeline Note'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Vertical Timeline */}
        {timeline.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] font-mono text-xs">
            No audit records found for this threat.
          </div>
        ) : (
          <div className="relative pl-8 sm:pl-10 space-y-6 before:absolute before:left-3.5 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-300 dark:before:bg-slate-800">
            {timeline.map((evt) => {
              const dt = new Date(evt.created_at);
              const formattedDate = dt.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Node Bullet */}
                  <div className="absolute -left-8 sm:-left-10 top-2 w-4 h-4 rounded-full bg-[var(--bg-surface)] border-2 border-cyan-500 ring-4 ring-[var(--bg-surface)] group-hover:scale-125 transition" />

                  {/* Timeline Event Box */}
                  <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--border-subtle)] transition shadow-[var(--shadow-card)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider border w-fit ${getEventBadgeStyle(
                          evt.event_type
                        )}`}
                      >
                        {evt.event_type.replace('_', ' ')}
                      </span>

                      <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                      {evt.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatDetailPage;
