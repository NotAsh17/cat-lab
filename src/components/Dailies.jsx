import { useMemo, useState } from 'react';
import { Calendar, Info, Play } from 'lucide-react';
import { Storage } from '../services/storage';
import { generateDailySections } from '../services/paperGenerator';

function formatMinutes(seconds) {
  return `${Math.round(seconds / 60)} min`;
}

export default function Dailies({ db, onStartPractice }) {
  const [dailyDone] = useState(() => Storage.getDailyDone());

  const today = useMemo(() => new Date(), []);
  const dayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const daily = useMemo(() => (db ? generateDailySections(db, today) : null), [db, today]);

  const sections = daily?.sections || [];
  const allDone = sections.length > 0 && sections.every((s) => dailyDone[s.dailySectionId]);

  const handleLogDayCompletion = () => {
    const dayOfWeek = today.getDay();
    const dayIndex = dayOfWeek === 0 ? 7 : dayOfWeek;
    Storage.completeDay(dayIndex);
    alert('Practice logged. Streak updated.');
    window.location.reload();
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 animate-fadeIn font-sans">
      <div className="mb-8 border-b border-border-subtle pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">
          Shared daily practice
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-text-main font-serif mt-1">Today's Practice</h2>
        <p className="text-xs text-text-muted mt-2 font-mono">{dayLabel}</p>
      </div>

      {!db || !daily ? (
        <div className="text-center py-16 bg-bg-surface border border-border-subtle rounded-xl font-mono text-xs text-text-muted">
          Loading question bank...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle p-5 rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono text-brand-gold uppercase tracking-wider font-semibold">
                Daily seed
              </div>
              <div className="text-sm font-serif font-bold text-text-main mt-1">
                {daily.mixed ? '1 RC passage + 1 VA set' : '2 RC passages'}
              </div>
              <div className="text-[10px] text-text-faint font-mono mt-2 truncate">{daily.seed}</div>
            </div>
            <Calendar className="w-5 h-5 text-text-faint flex-shrink-0" />
          </div>

          <div className="space-y-3">
            {sections.map((section) => {
              const done = !!dailyDone[section.dailySectionId];
              return (
                <div
                  key={section.id}
                  className={`bg-bg-surface border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                    done ? 'border-brand-green/30 bg-brand-green/[0.01] opacity-75' : 'border-border-subtle hover:border-brand-gold/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2 text-sm font-bold text-text-main font-serif">
                      <span>{section.label}</span>
                      {done && (
                        <span className="inline-flex items-center text-[9px] text-brand-green bg-brand-green/10 px-2 py-0.5 rounded font-mono font-semibold uppercase">
                          Done
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-1">{section.sublabel}</div>
                    <div className="text-[10px] text-text-faint font-mono mt-2">
                      {section.questionCount} questions | {formatMinutes(section.durationSec)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    {done ? (
                      <span className="text-brand-green text-xs font-mono font-bold">COMPLETE</span>
                    ) : (
                      <>
                        <button
                          onClick={() => onStartPractice({ ...section.paper, dailySectionId: section.dailySectionId }, false)}
                          className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-hover text-bg-base rounded-lg text-xs font-semibold font-mono tracking-wide transition shadow-[0_4px_12px_rgba(201,150,74,0.15)] flex items-center space-x-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Start</span>
                        </button>
                        <button
                          onClick={() => onStartPractice({ ...section.paper, dailySectionId: section.dailySectionId }, true)}
                          className="px-3 py-2 border border-border-subtle hover:border-text-muted text-text-muted hover:text-text-main rounded-lg text-xs font-semibold font-mono transition"
                        >
                          Untimed
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {allDone && (
            <div className="bg-brand-green/5 border border-brand-green/20 p-6 rounded-xl text-center space-y-4 animate-fadeIn">
              <h3 className="text-base font-bold font-serif text-text-main">Today's practice complete.</h3>
              <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                Log completion to update the practice grid and streak.
              </p>
              <button
                onClick={handleLogDayCompletion}
                className="px-6 py-2.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-lg text-xs font-bold font-mono tracking-wider transition"
              >
                Log Completion
              </button>
            </div>
          )}

          <div className="bg-bg-surface border border-border-subtle p-4 rounded-xl flex items-start space-x-3 text-xs text-text-muted">
            <Info className="w-4 h-4 text-brand-gold flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-text-main block mb-1">Shared daily rules</span>
              Daily papers use the same date and bank version seed for everyone. RC timers are 3 minutes per question; VA sets are 15 minutes.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
