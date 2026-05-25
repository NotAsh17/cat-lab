import { useMemo, useState } from 'react';
import { Calendar, CheckCircle, ClipboardCheck, Copy, Eye, Info, Play } from 'lucide-react';
import { Storage } from '../services/storage';
import { generateDailySections, todayKey } from '../services/paperGenerator';
import { copyText, discordScoreMessage, findDailyAttempt } from '../services/resultShare';

const LOOKBACK_DAYS = 14;

function formatMinutes(seconds) {
  return `${Math.round(seconds / 60)} min`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, delta) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function dayLabel(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function shortDayLabel(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function selectedTitle(isToday) {
  return isToday ? "Today's Practice" : 'Past Daily Practice';
}

export default function Dailies({ db, history = [], onStartPractice, onOpenAttempt }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [copiedAttemptId, setCopiedAttemptId] = useState('');

  const selectedDateKey = todayKey(selectedDate);
  const currentDateKey = todayKey(today);
  const isToday = selectedDateKey === currentDateKey;
  const dailyDone = useMemo(() => Storage.getDailyDone(selectedDateKey), [selectedDateKey]);
  const daily = useMemo(() => (db ? generateDailySections(db, selectedDate) : null), [db, selectedDate]);
  const sections = daily?.sections || [];
  const allDone = sections.length > 0 && sections.every((s) => dailyDone[s.dailySectionId]);

  const recentDays = useMemo(() => {
    if (!db) return [];
    return Array.from({ length: LOOKBACK_DAYS }, (_, idx) => {
      const date = addDays(today, -idx);
      const key = todayKey(date);
      const generated = generateDailySections(db, date);
      const doneForDay = Storage.getDailyDone(key);
      const complete = generated.sections.length > 0 && generated.sections.every((s) => doneForDay[s.dailySectionId]);
      return {
        key,
        date,
        label: shortDayLabel(date),
        type: generated.mixed ? 'RC + VA' : '2 RCs',
        complete,
      };
    });
  }, [db, today]);

  const handleLogDayCompletion = () => {
    const dayOfWeek = selectedDate.getDay();
    const dayIndex = dayOfWeek === 0 ? 7 : dayOfWeek;
    Storage.completeDay(dayIndex, selectedDateKey);
    alert(isToday ? 'Practice logged. Streak updated.' : 'Past daily logged.');
    window.location.reload();
  };

  const handleShareAttempt = async (event, attempt) => {
    event.stopPropagation();
    if (!attempt) return;
    await copyText(discordScoreMessage(attempt));
    setCopiedAttemptId(attempt.id || attempt.paperId || attempt.testId);
    window.setTimeout(() => setCopiedAttemptId(''), 1800);
  };

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn px-4 py-6 font-sans sm:px-6 lg:py-8">
      <div className="mb-8 border-b border-border-subtle pb-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-gold">
          Shared daily practice
        </span>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-text-main sm:text-3xl">{selectedTitle(isToday)}</h2>
        <p className="mt-2 font-mono text-xs text-text-muted">{dayLabel(selectedDate)}</p>
      </div>

      {!db || !daily ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface py-16 text-center font-mono text-xs text-text-muted">
          Loading question bank...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5">
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
                Daily seed
              </div>
              <div className="mt-1 font-serif text-sm font-bold text-text-main">
                {daily.mixed ? '1 RC passage + 1 VA set' : '2 RC passages'}
              </div>
              <div className="mt-2 truncate font-mono text-[10px] text-text-faint">{daily.seed}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowCalendar((value) => !value)}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                showCalendar ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-border-subtle bg-bg-card text-text-muted hover:border-brand-gold/40 hover:text-brand-gold'
              }`}
              title="Open recent dailies"
            >
              <Calendar className="h-5 w-5" />
            </button>
          </div>

          {showCalendar && (
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-base font-bold text-text-main">Recent Dailies</h3>
                  <p className="mt-0.5 text-xs text-text-muted">Pick a missed daily from the last {LOOKBACK_DAYS} days.</p>
                </div>
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(today)}
                    className="rounded-lg border border-border-subtle px-3 py-2 font-mono text-[10px] font-bold uppercase text-text-muted transition hover:border-brand-gold/50 hover:text-brand-gold"
                  >
                    Today
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recentDays.map((day) => {
                  const selected = day.key === selectedDateKey;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDate(day.date)}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                        selected ? 'border-brand-gold bg-brand-gold/10' : 'border-border-subtle bg-bg-card hover:border-brand-gold/40'
                      }`}
                    >
                      <span>
                        <span className="block font-serif text-sm font-bold text-text-main">{day.label}</span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-faint">{day.type}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[9px] font-bold uppercase ${day.complete ? 'bg-brand-green/10 text-brand-green' : 'bg-bg-surface text-text-faint'}`}>
                        {day.complete && <CheckCircle className="h-3 w-3" />}
                        {day.complete ? 'Done' : day.key === currentDateKey ? 'Today' : 'Missed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sections.map((section) => {
              const done = !!dailyDone[section.dailySectionId];
              const attempt = done ? findDailyAttempt(history, selectedDateKey, section.dailySectionId) : null;
              const canOpenResult = Boolean(attempt && onOpenAttempt);
              const copied = copiedAttemptId && copiedAttemptId === (attempt?.id || attempt?.paperId || attempt?.testId);
              return (
                <div
                  key={section.id}
                  role={canOpenResult ? 'button' : undefined}
                  tabIndex={canOpenResult ? 0 : undefined}
                  onClick={() => {
                    if (canOpenResult) onOpenAttempt(attempt);
                  }}
                  onKeyDown={(event) => {
                    if (!canOpenResult || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    onOpenAttempt(attempt);
                  }}
                  className={`flex flex-col justify-between gap-4 rounded-xl border bg-bg-surface p-5 transition sm:flex-row sm:items-center ${
                    done ? `border-brand-green/30 bg-brand-green/[0.01] ${canOpenResult ? 'cursor-pointer hover:border-brand-gold/40 hover:bg-brand-green/[0.03]' : 'opacity-75'}` : 'border-border-subtle hover:border-brand-gold/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2 font-serif text-sm font-bold text-text-main">
                      <span>{section.label}</span>
                      {done && (
                        <span className="inline-flex rounded bg-brand-green/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-brand-green">
                          Done
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">{section.sublabel}</div>
                    <div className="mt-2 font-mono text-[10px] text-text-faint">
                      {section.questionCount} questions | {formatMinutes(section.durationSec)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    {done ? (
                      attempt ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenAttempt?.(attempt);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-card px-3 py-2 font-mono text-xs font-semibold text-text-muted transition hover:border-brand-gold/50 hover:text-text-main"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Result</span>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => handleShareAttempt(event, attempt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-card px-3 py-2 font-mono text-xs font-semibold text-text-muted transition hover:border-brand-gold/50 hover:text-text-main"
                          >
                            {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-brand-green" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copied ? 'Copied' : 'Share'}</span>
                          </button>
                        </>
                      ) : (
                        <span className="font-mono text-xs font-bold text-brand-green">COMPLETE</span>
                      )
                    ) : (
                      <>
                        <button
                          onClick={() => onStartPractice({ ...section.paper, dailySectionId: section.dailySectionId, dailyDayKey: daily.dateKey }, false)}
                          className="flex items-center space-x-1 rounded-lg bg-brand-gold px-4 py-2 font-mono text-xs font-semibold tracking-wide text-bg-base shadow-[0_4px_12px_rgba(201,150,74,0.15)] transition hover:bg-brand-gold-hover"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Start</span>
                        </button>
                        <button
                          onClick={() => onStartPractice({ ...section.paper, dailySectionId: section.dailySectionId, dailyDayKey: daily.dateKey }, true)}
                          className="rounded-lg border border-border-subtle px-3 py-2 font-mono text-xs font-semibold text-text-muted transition hover:border-text-muted hover:text-text-main"
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
            <div className="animate-fadeIn space-y-4 rounded-xl border border-brand-green/20 bg-brand-green/5 p-6 text-center">
              <h3 className="font-serif text-base font-bold text-text-main">{isToday ? "Today's practice complete." : 'Selected daily complete.'}</h3>
              <p className="mx-auto max-w-md text-xs leading-relaxed text-text-muted">
                {isToday ? 'Log completion to update the practice grid and streak.' : 'This past daily is marked complete for your account.'}
              </p>
              <button
                onClick={handleLogDayCompletion}
                className="rounded-lg bg-brand-green px-6 py-2.5 font-mono text-xs font-bold tracking-wider text-white transition hover:bg-brand-green/90"
              >
                {isToday ? 'Log Completion' : 'Log Past Daily'}
              </button>
            </div>
          )}

          <div className="flex items-start space-x-3 rounded-xl border border-border-subtle bg-bg-surface p-4 text-xs text-text-muted">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold" />
            <div className="leading-relaxed">
              <span className="mb-1 block font-semibold text-text-main">Shared daily rules</span>
              Daily papers use the same date and bank version seed for everyone. RC timers are 3 minutes per question; VA sets are 15 minutes.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
