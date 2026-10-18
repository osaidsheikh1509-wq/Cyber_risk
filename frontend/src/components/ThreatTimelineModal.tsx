import React, { useState, useEffect } from 'react';
import { X, Send, Clock, History } from 'lucide-react';
import { Threat, TimelineEvent } from '../types/threat';
import { fetchThreatTimeline, addTimelineNote } from '../services/threatApi';

interface ThreatTimelineModalProps {
  threat: Threat | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ThreatTimelineModal: React.FC<ThreatTimelineModalProps> = ({
  threat,
  isOpen,
  onClose,
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (threat && isOpen) {
      setLoading(true);
      fetchThreatTimeline(threat.id)
        .then((data) => setEvents(data))
        .catch((err) => console.error('Failed to fetch timeline:', err))
        .finally(() => setLoading(false));
    }
  }, [threat, isOpen]);

  if (!isOpen || !threat) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      const created = await addTimelineNote(threat.id, newNote.trim());
      setEvents([created, ...events]);
      setNewNote('');
    } catch (err) {
      console.error('Failed to post note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getEventBadge = (type: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-100 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-400">
                {threat.category}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">ID #{threat.id}</span>
              <span className="text-xs text-[var(--text-muted)]">•</span>
              <span className="text-xs font-mono text-[var(--text-muted)] truncate max-w-[220px]">
                {threat.affected_asset}
              </span>
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight leading-snug">
              {threat.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Events Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-[var(--text-muted)] mb-2 font-semibold">
            <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Audit History & Response Trail ({events.length})</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-mono text-[var(--text-muted)]">
              Loading chronological events...
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-[var(--text-muted)]">
              No audit records logged yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300 dark:before:bg-slate-800">
              {events.map((evt) => {
                const dateStr = new Date(evt.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={evt.id} className="relative group">
                    {/* Event dot */}
                    <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[var(--bg-surface)] border-2 border-cyan-500 ring-4 ring-[var(--bg-surface)] group-hover:scale-125 transition" />

                    <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getEventBadge(
                            evt.event_type
                          )}`}
                        >
                          {evt.event_type.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)]">
                          <Clock className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-sans">
                        {evt.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Note Input Footer */}
        <form onSubmit={handleAddNote} className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card-subtle)]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Append analyst forensic observation or mitigation update..."
              className="flex-1 px-3.5 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={submitting || !newNote.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-[var(--shadow-glow)] disabled:opacity-50 cursor-pointer"
            >
              <span>Log Note</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ThreatTimelineModal;
