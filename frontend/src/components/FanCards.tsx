import React, { useState } from 'react';
import { Mic, Brain, Volume2, Sparkles, EyeOff, Eye } from 'lucide-react';
import './FanCards.css';

interface FanCardsProps {
  onVoiceReport: () => void;
  onAiAnalysis: () => void;
  onSpokenBriefing: () => void;
}

export const FanCards: React.FC<FanCardsProps> = ({
  onVoiceReport,
  onAiAnalysis,
  onSpokenBriefing,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fancards_showcase_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fancards_showcase_collapsed', String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  };

  if (isCollapsed) {
    return (
      <div className="w-full mb-6 p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex items-center justify-between text-xs transition animate-fadeIn">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-200">Feature Showcase</span>
          <span className="hidden sm:inline text-slate-500 font-mono text-[11px]">
            • Voice Report, AI Analysis & Spoken Briefings
          </span>
        </div>
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-cyan-400 hover:text-cyan-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 transition cursor-pointer shadow-sm"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Show Showcase</span>
        </button>
      </div>
    );
  }

  return (
    <section className="fan-cards-section animate-fadeIn">
      {/* Showcase Header with Collapse Button */}
      <div className="fan-cards-header">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
            Interactive Feature Showcase
          </h3>
          <span className="hidden md:inline-block text-[11px] font-mono text-slate-500">
            (Hover cards to expand fan)
          </span>
        </div>
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer"
          title="Collapse showcase to save screen space"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Hide Showcase</span>
        </button>
      </div>

      {/* Fan Cards Container */}
      <div className="fan-cards-wrapper">
        <div className="fan-cards">
          {/* Card 1: Voice Report */}
          <div
            className="glass"
            style={{ '--r': -15 } as React.CSSProperties}
            data-text="Voice Report"
            onClick={onVoiceReport}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onVoiceReport()}
            title="Open New Threat modal with microphone ready"
          >
            <Mic className="w-9 h-9" />
            <span className="card-subtext">Record & auto-transcribe speech in 10+ Indic languages</span>
            <span className="card-action-hint">Launch Mic →</span>
          </div>

          {/* Card 2: AI Analysis */}
          <div
            className="glass"
            style={{ '--r': 5 } as React.CSSProperties}
            data-text="AI Analysis"
            onClick={onAiAnalysis}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAiAnalysis()}
            title="Scroll to active threats registry"
          >
            <Brain className="w-9 h-9" />
            <span className="card-subtext">LLM cyber-risk scoring & action suggestions</span>
            <span className="card-action-hint">Explore Registry ↓</span>
          </div>

          {/* Card 3: Spoken Briefing */}
          <div
            className="glass"
            style={{ '--r': 25 } as React.CSSProperties}
            data-text="Spoken Briefing"
            onClick={onSpokenBriefing}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSpokenBriefing()}
            title="Choose from all registered threats to listen to audio briefing"
          >
            <Volume2 className="w-9 h-9" />
            <span className="card-subtext">Sarvam AI Bulbul v3 neural voice synthesis for all threats</span>
            <span className="card-action-hint">Choose &amp; Listen &rarr;</span>
          </div>
        </div>
      </div>
    </section>
  );
};
