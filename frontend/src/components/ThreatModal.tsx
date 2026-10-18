import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldAlert,
  Sparkles,
  Bot,
  Clock,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Mic,
  Square,
  AlertTriangle,
} from 'lucide-react';
import {
  Threat,
  ThreatCategory,
  ThreatStatus,
  RiskLevel,
  ThreatInput,
  AIAssessResponse,
  VoiceReportResponse,
} from '../types/threat';
import { assessThreatWithAI, reportThreatByVoice } from '../services/threatApi';

interface ThreatModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  threat?: Threat | null;
  onClose: () => void;
  onSubmit: (data: ThreatInput) => Promise<void>;
  initialVoiceReady?: boolean;
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

const VOICE_LANGUAGES = [
  { label: 'Auto Detect', code: 'unknown' },
  { label: 'English', code: 'en-IN' },
  { label: 'Hindi (हिंदी)', code: 'hi-IN' },
  { label: 'Kannada (ಕನ್ನಡ)', code: 'kn-IN' },
  { label: 'Tamil (தமிழ்)', code: 'ta-IN' },
  { label: 'Telugu (తెలుగు)', code: 'te-IN' },
  { label: 'Bengali (বাংলা)', code: 'bn-IN' },
  { label: 'Marathi (मराठी)', code: 'mr-IN' },
];

export const ThreatModal: React.FC<ThreatModalProps> = ({
  isOpen,
  mode,
  threat,
  onClose,
  onSubmit,
  initialVoiceReady = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ThreatCategory>('Vulnerability');
  const [likelihood, setLikelihood] = useState<number>(3);
  const [impact, setImpact] = useState<number>(3);
  const [status, setStatus] = useState<ThreatStatus>('Open');
  const [affectedAsset, setAffectedAsset] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // AI Assessment State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIAssessResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Voice Reporting State
  const [voiceLang, setVoiceLang] = useState<string>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceResult, setVoiceResult] = useState<VoiceReportResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Sync state when opened or mode changed
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && threat) {
        setTitle(threat.title);
        setDescription(threat.description);
        setCategory(threat.category);
        setLikelihood(threat.likelihood);
        setImpact(threat.impact);
        setStatus(threat.status);
        setAffectedAsset(threat.affected_asset);
      } else {
        setTitle('');
        setDescription('');
        setCategory('Vulnerability');
        setLikelihood(3);
        setImpact(3);
        setStatus('Open');
        setAffectedAsset('');
      }
      setErrors({});
      setAiInsights(null);
      setAiError(null);
      setMicError(null);
      setVoiceResult(null);
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  }, [isOpen, mode, threat]);

  // Auto-start microphone recording if opened via Voice Report card
  useEffect(() => {
    if (isOpen && initialVoiceReady && mode === 'create') {
      const timer = setTimeout(() => {
        startRecording();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialVoiceReady, mode]);

  if (!isOpen) return null;

  // Live recalculation of risk score and level
  const liveScore = likelihood * impact;
  const getLiveLevel = (score: number): RiskLevel => {
    if (score >= 17) return 'Critical';
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  };
  const liveLevel = getLiveLevel(liveScore);

  const getTierColor = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'Critical':
        return 'bg-[var(--risk-critical-bg)] text-[var(--risk-critical-text)] border-[var(--risk-critical-border)]';
      case 'High':
        return 'bg-[var(--risk-high-bg)] text-[var(--risk-high-text)] border-[var(--risk-high-border)]';
      case 'Medium':
        return 'bg-[var(--risk-medium-bg)] text-[var(--risk-medium-text)] border-[var(--risk-medium-border)]';
      case 'Low':
        return 'bg-[var(--risk-low-bg)] text-[var(--risk-low-text)] border-[var(--risk-low-border)]';
    }
  };

  // --- Voice Reporting Functions ---
  const startRecording = async () => {
    setMicError(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
          await handleProcessAudio(audioBlob);
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      let elapsed = 0;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
        if (elapsed >= 30) {
          stopRecording();
        }
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError('No microphone hardware detected on your device.');
      } else {
        setMicError(`Unable to start voice recording: ${err.message || 'Access error'}`);
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleProcessAudio = async (audioBlob: Blob) => {
    try {
      setVoiceProcessing(true);
      setMicError(null);

      const result = await reportThreatByVoice(audioBlob, voiceLang);
      setVoiceResult(result);

      if (!title.trim()) {
        setTitle(`${result.assessment.category} Alert (Voice Report)`);
      }

      let newDesc = result.transcript_english;
      if (result.transcript_original && result.transcript_original !== result.transcript_english) {
        newDesc += `\n\n[Original Transcript (${result.language_code})]:\n${result.transcript_original}`;
      }
      setDescription(newDesc);

      setCategory(result.assessment.category);
      setLikelihood(result.assessment.likelihood);
      setImpact(result.assessment.impact);
      setAiInsights(result.assessment);

      setErrors((prev) => {
        const next = { ...prev };
        delete next.description;
        return next;
      });
    } catch (err: any) {
      setMicError(err?.message || 'Failed to process voice report with AI.');
    } finally {
      setVoiceProcessing(false);
    }
  };

  // --- Text-based AI Analysis ---
  const handleAIAnalyze = async () => {
    const textToAnalyze = description.trim() || title.trim();
    if (!textToAnalyze || textToAnalyze.length < 3) {
      setErrors((prev) => ({
        ...prev,
        description: 'Please enter a description or title first to analyze with AI.',
      }));
      return;
    }

    try {
      setIsAnalyzing(true);
      setAiError(null);
      const assessment = await assessThreatWithAI(textToAnalyze);

      setCategory(assessment.category);
      setLikelihood(assessment.likelihood);
      setImpact(assessment.impact);
      setAiInsights(assessment);

      setErrors((prev) => {
        const next = { ...prev };
        delete next.description;
        return next;
      });
    } catch (err: any) {
      setAiError(err?.message || 'Failed to complete AI threat assessment.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const appendActionsToDescription = () => {
    if (!aiInsights || !aiInsights.recommended_actions.length) return;
    const actionsFormatted =
      '\n\nRecommended Mitigation Actions:\n' +
      aiInsights.recommended_actions.map((act, i) => `${i + 1}. ${act}`).join('\n');
    setDescription((prev) => prev + actionsFormatted);
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim() || title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters.';
    } else if (title.trim().length > 255) {
      newErrors.title = 'Title cannot exceed 255 characters.';
    }

    if (!description.trim() || description.trim().length < 5) {
      newErrors.description = 'Description must be at least 5 characters.';
    }

    if (!affectedAsset.trim() || affectedAsset.trim().length < 2) {
      newErrors.affectedAsset = 'Affected asset must be specified (min 2 characters).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        likelihood,
        impact,
        status,
        affected_asset: affectedAsset.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrors({ form: err?.message || 'Failed to submit threat.' });
    } finally {
      setSubmitting(false);
    }
  };

  const likelihoodLabels = ['', 'Rare (1)', 'Unlikely (2)', 'Possible (3)', 'Likely (4)', 'Almost Certain (5)'];
  const impactLabels = ['', 'Negligible (1)', 'Minor (2)', 'Moderate (3)', 'Major (4)', 'Catastrophic (5)'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-cyan-600 dark:text-cyan-400">
            <ShieldAlert className="w-5 h-5 text-cyan-500" />
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              {mode === 'create' ? 'Register New Cyber Threat' : `Edit Threat #${threat?.id}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 font-sans">
          {errors.form && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-mono">
              {errors.form}
            </div>
          )}

          {/* Voice Threat Reporting Bar */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-50/70 via-purple-50/50 to-slate-50 border border-cyan-200 dark:from-cyan-950/40 dark:via-purple-950/30 dark:to-slate-950 dark:border-cyan-800/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 border border-cyan-300 dark:border-cyan-700/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">Voice Incident Report</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Sarvam AI Multi-Indic Speech-to-Text
                  </span>
                </div>
              </div>

              {/* Language Selector & Record Action */}
              <div className="flex items-center space-x-2">
                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  disabled={isRecording || voiceProcessing}
                  className="px-2.5 py-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  {VOICE_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>

                {!isRecording && !voiceProcessing && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/30 dark:hover:bg-rose-600/50 border border-rose-300 dark:border-rose-500/60 text-rose-700 dark:text-rose-200 hover:text-rose-800 dark:hover:text-white transition shadow-sm cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    <span>Report by voice</span>
                  </button>
                )}

                {isRecording && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[var(--shadow-glow)] cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop & Assess</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="px-2 py-1 rounded-lg text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Recording Active Indicator */}
            {isRecording && (
              <div className="mt-3 pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-mono text-rose-600 dark:text-rose-300 font-bold">
                    Recording audio... ({recordingSeconds}s / 30s)
                  </span>
                </div>
                <div className="w-32 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(recordingSeconds / 30) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Voice Processing Spinner */}
            {voiceProcessing && (
              <div className="mt-3 pt-2.5 border-t border-[var(--border-color)] flex items-center space-x-2 text-cyan-600 dark:text-cyan-400 text-xs font-mono animate-fadeIn">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                <span>Transcribing with Sarvam AI & evaluating risk...</span>
              </div>
            )}

            {/* Microphone / Device Error Alert */}
            {micError && (
              <div className="mt-2.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{micError}</span>
              </div>
            )}

            {/* Voice Report Processed Notice */}
            {voiceResult && !voiceProcessing && (
              <div className="mt-2.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-mono flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Voice report transcribed & auto-filled ({voiceResult.language_code})
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">Edit values below as needed</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-secondary)] mb-1">
              Threat Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unauthenticated Remote Code Execution in Gateway Proxy"
              className={`w-full px-3.5 py-2.5 bg-[var(--bg-input)] border rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 ${
                errors.title
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-[var(--border-color)] focus:border-cyan-500 focus:ring-cyan-500'
              }`}
            />
            {errors.title && <p className="text-rose-500 text-xs mt-1 font-mono">{errors.title}</p>}
          </div>

          {/* Description & AI Trigger */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono uppercase text-[var(--text-secondary)]">
                Description & Threat Intelligence <span className="text-rose-500">*</span>
              </label>

              {/* Analyze with AI Button */}
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={isAnalyzing || isRecording}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-600/40 hover:bg-purple-100 dark:hover:bg-purple-600/60 border border-purple-300 dark:border-purple-500/50 text-purple-700 dark:text-purple-200 transition shadow-sm disabled:opacity-50 cursor-pointer"
                title="Automatically analyze incident text, detect category, and calculate likelihood/impact"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                    <span>Analyzing incident...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Analyze with AI</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail root cause, affected software components, or paste raw incident log..."
              className={`w-full px-3.5 py-2.5 bg-[var(--bg-input)] border rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 resize-none ${
                errors.description
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-[var(--border-color)] focus:border-cyan-500 focus:ring-cyan-500'
              }`}
            />
            {errors.description && (
              <p className="text-rose-500 text-xs mt-1 font-mono">{errors.description}</p>
            )}
            {aiError && (
              <p className="text-amber-500 text-xs mt-1 font-mono">{aiError}</p>
            )}
          </div>

          {/* AI Insights & Recommended Actions Panel */}
          {aiInsights && (
            <div className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-300">
                  <Bot className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    AI Threat Evaluation
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]">
                    Backend: {aiInsights.backend_used}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-500" />
                    Target SLA: {aiInsights.response_timeline_hours}h
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                  Analytical Reasoning:
                </span>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-surface-elevated)] p-2.5 rounded-lg border border-[var(--border-color)]">
                  {aiInsights.reasoning}
                </p>
              </div>

              {/* Recommended Actions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                    Recommended Mitigation Actions:
                  </span>
                  <button
                    type="button"
                    onClick={appendActionsToDescription}
                    className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Append to Description</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {aiInsights.recommended_actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ThreatCategory)}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-secondary)] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ThreatStatus)}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Affected Asset */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-secondary)] mb-1">
              Target / Affected Asset <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={affectedAsset}
              onChange={(e) => setAffectedAsset(e.target.value)}
              placeholder="e.g. s3://customer-billing-archive, corp-ad-domain-controller-01"
              className={`w-full px-3.5 py-2.5 bg-[var(--bg-input)] border rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 ${
                errors.affectedAsset
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-[var(--border-color)] focus:border-cyan-500 focus:ring-cyan-500'
              }`}
            />
            {errors.affectedAsset && (
              <p className="text-rose-500 text-xs mt-1 font-mono">{errors.affectedAsset}</p>
            )}
          </div>

          {/* Real-Time Live Recalculation Box */}
          <div className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Live Risk Recalculation
                </span>
              </div>

              {/* Live Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  Score:{' '}
                  <strong className="text-[var(--text-primary)] text-sm font-mono">{liveScore}</strong>
                  <span className="text-[var(--text-muted)]">/25</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${getTierColor(
                    liveLevel
                  )}`}
                >
                  {liveLevel}
                </span>
              </div>
            </div>

            {/* Likelihood Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-[var(--text-muted)]">Likelihood:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">{likelihoodLabels[likelihood]}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={likelihood}
                onChange={(e) => setLikelihood(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
                <span>1 (Rare)</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5 (Almost Certain)</span>
              </div>
            </div>

            {/* Impact Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-[var(--text-muted)]">Impact:</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{impactLabels[impact]}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={impact}
                onChange={(e) => setImpact(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
                <span>1 (Negligible)</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5 (Catastrophic)</span>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[var(--shadow-glow)] disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Processing...'
                : mode === 'create'
                ? 'Register Threat'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ThreatModal;
