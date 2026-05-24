import { Play, RotateCcw } from 'lucide-react';

function hasDraft(mock) {
  return Boolean(localStorage.getItem(`attempt_draft_${mock.id}`));
}

function latestMockAttempt(mock, history = []) {
  return history
    .filter((row) => row.paperId === mock.id || row.testId === `full_mock-${mock.id}`)
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())[0];
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function avgQuestionTime(attempt) {
  const values = Object.values(attempt?.questionStats || {}).map((stat) => Number(stat.timeSec || 0)).filter(Boolean);
  if (!values.length) return '--';
  return formatDuration(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function avgChanges(attempt) {
  const values = Object.values(attempt?.questionStats || {}).map((stat) => Number(stat.changes || 0));
  if (!values.length) return '--';
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return avg.toFixed(avg >= 1 ? 1 : 2);
}

function MockMetric({ value, label }) {
  return (
    <div>
      <div className="font-mono text-[11px] font-semibold text-text-main">{value}</div>
      <div className="mt-1 font-mono text-[10px] leading-none text-text-faint">{label}</div>
    </div>
  );
}

export default function Mocks({ db, history = [], onStartMock }) {
  const mocks = db?.mocks?.full || [];

  if (!db) {
    return <div className="mx-auto max-w-6xl px-4 py-16 font-mono text-xs text-text-muted sm:px-6">Loading question bank...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl animate-fadeIn px-4 py-6 font-sans sm:px-6 lg:py-8">
      <div className="mb-8 border-b border-border-subtle pb-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-gold">
          Full-length mocks
        </span>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-text-main sm:text-3xl">SIMCAT 2025 Mocks</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
          Three locked sections in CAT order: VARC, LRDI, then QA. Each section gets 40 minutes. Breaks are allowed only between sections.
        </p>
      </div>

      {mocks.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 text-center text-sm text-text-muted">
          No full mocks are available in the bank yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {mocks.map((mock) => {
            const attempt = latestMockAttempt(mock, history);
            const completed = Boolean(attempt);
            const draft = hasDraft(mock);
            const sectionLine = mock.sections
              .map((section) => `${section.shortTitle} ${section.questionCount}`)
              .join(' / ');

            return (
              <article
                key={mock.id}
                className={`flex min-h-[190px] flex-col rounded-xl border bg-bg-surface p-5 transition sm:p-6 ${
                  completed ? 'border-brand-gold/30 bg-brand-gold/[0.01]' : 'border-border-subtle hover:border-brand-gold/25'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl font-bold tracking-tight text-text-main">{mock.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-text-muted">
                      {draft
                        ? 'Draft available. Continue from your saved section.'
                        : completed
                          ? `Last score ${attempt.score ?? '--'} / ${attempt.max ?? mock.questionCount * 3}.`
                          : 'No local attempt data yet.'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-brand-gold/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                    {mock.questionCount} QS
                  </span>
                </div>

                <div className="mt-6 border-t border-border-subtle pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <MockMetric value={mock.questionCount} label="questions" />
                    <MockMetric value={attempt ? avgQuestionTime(attempt) : '--'} label="avg time" />
                    <MockMetric value={attempt ? avgChanges(attempt) : '--'} label="avg changes" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-semibold text-text-faint">
                  <span>{sectionLine}</span>
                  <span>120 MINUTES</span>
                  <span>{mock.id}</span>
                </div>
                {mock.warnings?.length > 0 && <div className="mt-2 font-mono text-[10px] text-brand-gold">{mock.warnings.join(', ')}</div>}

                <div className="mt-auto flex justify-end pt-5">
                  <button
                    type="button"
                    onClick={() => onStartMock(mock)}
                    className="flex min-h-10 items-center space-x-1.5 rounded-lg bg-brand-gold px-5 py-2.5 font-mono text-xs font-bold tracking-wider text-bg-base shadow-[0_4px_12px_rgba(201,150,74,0.15)] transition hover:bg-brand-gold-hover"
                  >
                    {draft ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{draft ? 'Resume Mock' : completed ? 'Retake Mock' : 'Start Mock'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
