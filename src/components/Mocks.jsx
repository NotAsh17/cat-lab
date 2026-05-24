import { Play, RotateCcw } from 'lucide-react';

function hasDraft(mock) {
  return Boolean(localStorage.getItem(`attempt_draft_${mock.id}`));
}

export default function Mocks({ db, history, onStartMock }) {
  const mocks = db?.mocks?.full || [];

  if (!db) {
    return <div className="mx-auto max-w-5xl px-6 py-16 font-mono text-xs text-text-muted">Loading question bank...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn px-6 py-8 font-sans">
      <div className="mb-8 border-b border-border-subtle pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">
          Full-length mocks
        </span>
        <h2 className="mt-1 font-serif text-3xl font-bold tracking-tight text-text-main">SIMCAT 2025 Mocks</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
          Three locked sections in CAT order: VARC, LRDI, then QA. Each section gets 40 minutes. Breaks are allowed only between sections.
        </p>
      </div>

      {mocks.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 text-center text-sm text-text-muted">
          No full mocks are available in the bank yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {mocks.map((mock) => {
            const completed = history.some((h) => h.paperId === mock.id || h.testId === `full_mock-${mock.id}`);
            const draft = hasDraft(mock);
            const sectionLine = mock.sections
              .map((section) => `${section.shortTitle}: ${section.questionCount}`)
              .join(' | ');
            return (
              <div
                key={mock.id}
                className={`flex flex-col justify-between gap-4 rounded-xl border bg-bg-surface p-6 transition sm:flex-row sm:items-center ${
                  completed ? 'border-brand-gold/30 bg-brand-gold/[0.01]' : 'border-border-subtle hover:border-brand-gold/25'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-brand-gold">
                    {draft ? 'RESUME AVAILABLE' : completed ? 'COMPLETED' : 'FULL MOCK'}
                  </div>
                  <h3 className="mt-1 font-serif text-lg font-bold text-text-main">{mock.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    2 hours total, section-locked in VARC → LRDI → QA order.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono font-semibold text-text-faint">
                    <span>120 MINUTES</span>
                    <span>{mock.questionCount} QUESTIONS</span>
                    <span>{mock.id}</span>
                  </div>
                  <div className="mt-2 truncate text-[10px] font-mono text-text-faint">{sectionLine}</div>
                  {mock.warnings?.length > 0 && <div className="mt-2 text-[10px] font-mono text-brand-gold">{mock.warnings.join(', ')}</div>}
                </div>

                <button
                  type="button"
                  onClick={() => onStartMock(mock)}
                  className="flex items-center space-x-1.5 self-end rounded-xl bg-brand-gold px-5 py-2.5 text-xs font-bold font-mono tracking-wider text-bg-base shadow-[0_4px_12px_rgba(201,150,74,0.15)] transition hover:bg-brand-gold-hover sm:self-auto"
                >
                  {draft ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  <span>{draft ? 'Resume Mock' : 'Start Mock'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
