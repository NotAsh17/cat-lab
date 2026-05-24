import { useState } from 'react';
import { Bookmark, BookmarkCheck, BookOpen, CheckCircle, ChevronLeft, HelpCircle, RotateCcw, XCircle } from 'lucide-react';
import { Storage } from '../services/storage';
import { answerOutcome, correctAnswer, displayInstruction, isQaQuestion, isTitaQuestion, questionPreview, sourceLabel } from '../services/questionUtils';
import { optionDisplayKey, shouldStripOptionKeys } from '../services/optionRenderUtils';
import { OptionContent, PassageDisplay, QuestionExplanation, QuestionStem } from './QuestionDisplay';

function formatDuration(secs = 0) {
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`;
}

export default function Results({ attempt, onRetake, onBackToDashboard }) {
  const [reviewIdx, setReviewIdx] = useState(null);
  const [, setBookmarksUpdated] = useState(false);
  if (!attempt) return null;

  const { testId, score, max, correct, wrong, skipped, timeUsed, answers = {}, questions = [], questionStats = {} } = attempt;
  const acc = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;

  const handleBookmarkToggle = (e, q) => {
    e?.stopPropagation?.();
    if (Storage.isBookmarked(q.id)) Storage.removeBookmark(q.id);
    else Storage.saveBookmark(q, isQaQuestion(q) ? 'qa' : 'varc', q.passage?.source_label || q.passage?.id, q.passage?.paragraphs?.join('\n\n') || '');
    setBookmarksUpdated((value) => !value);
  };

  if (reviewIdx !== null) {
    return (
      <ResultReviewWorkspace
        attempt={attempt}
        reviewIdx={reviewIdx}
        setReviewIdx={setReviewIdx}
        onBack={() => setReviewIdx(null)}
        handleBookmarkToggle={handleBookmarkToggle}
        questionStats={questionStats}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fadeIn px-6 py-8 pb-16 font-sans">
      <div className="mb-8 flex items-center justify-between border-b border-border-subtle pb-4">
        <button onClick={onBackToDashboard} className="flex items-center space-x-1 text-xs font-semibold font-mono text-text-muted hover:text-text-main">
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </button>
        <span className="text-xs font-mono uppercase tracking-wider text-text-faint">Practice ID: {testId}</span>
      </div>

      <div className="mb-8 flex flex-col items-center justify-between gap-6 rounded-2xl border border-border-subtle bg-bg-surface p-6 md:flex-row md:p-8">
        <div className="text-center md:text-left">
          <span className="mb-2 block text-xs font-bold font-mono uppercase tracking-widest text-brand-gold">Practice Result Summary</span>
          <div className="flex items-baseline justify-center text-5xl font-extrabold font-mono text-text-main md:justify-start">
            {score}<span className="ml-1.5 text-xl text-text-faint">/ {max}</span>
          </div>
          <p className="mt-2 text-xs font-mono text-text-muted">
            Accuracy: <span className="font-bold text-brand-gold">{acc}%</span> | Time Used: <span className="font-bold">{formatDuration(timeUsed)}</span>
          </p>
        </div>
        <button onClick={onRetake} className="flex items-center justify-center space-x-1.5 rounded-xl border border-border-subtle bg-bg-card px-5 py-2.5 text-xs font-bold font-mono text-text-muted transition hover:border-text-muted hover:text-text-main">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Retake Practice</span>
        </button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 text-center md:grid-cols-4">
        <Stat label="Correct" value={`+${correct}`} sub={`+${correct * 3} score`} cls="text-brand-green" />
        <Stat label="Wrong" value={`-${wrong}`} sub="MCQ penalty only" cls="text-brand-red" />
        <Stat label="Skipped" value={skipped} sub="0 penalty" cls="text-text-muted" />
        <Stat label="Pace / Question" value={`${correct + wrong ? Math.round(timeUsed / (correct + wrong)) : 0}s`} sub="attempted average" cls="text-text-main" />
      </div>

      <h3 className="mb-4 font-mono text-lg font-semibold text-text-main">Question Review</h3>
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const outcome = answerOutcome(q, answers[q.id]);
          const bookmarked = Storage.isBookmarked(q.id);
          const stats = questionStats[q.id] || {};
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setReviewIdx(idx)}
              className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 text-left transition hover:border-brand-gold/30 hover:bg-bg-card/50"
            >
              <div className="flex min-w-0 flex-1 items-center space-x-3.5">
                {outcome === 'skipped' ? <HelpCircle className="h-5 w-5 flex-shrink-0 text-text-faint" /> : outcome === 'correct' ? <CheckCircle className="h-5 w-5 flex-shrink-0 text-brand-green" /> : <XCircle className="h-5 w-5 flex-shrink-0 text-brand-red" />}
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold font-mono text-text-main">
                    Q{idx + 1}: <span className="font-serif font-normal italic text-text-muted">{questionPreview(q)}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-text-faint">{sourceLabel(q)} | {formatDuration(stats.timeSec || 0)} | {stats.changes || 0} changes</div>
                </div>
              </div>
              <span className="ml-3 text-text-muted">
                {bookmarked ? <BookmarkCheck className="h-4 w-4 text-brand-gold" /> : <Bookmark className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultReviewWorkspace({ attempt, reviewIdx, setReviewIdx, onBack, handleBookmarkToggle, questionStats }) {
  const { questions = [], answers = {} } = attempt;
  const q = questions[reviewIdx];
  const activePassage = q?.passage || null;
  const tita = isTitaQuestion(q);
  const userAns = answers[q.id];
  const outcome = answerOutcome(q, userAns);
  const stats = questionStats[q.id] || {};
  const bookmarked = Storage.isBookmarked(q.id);

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-main">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6">
        <button onClick={onBack} className="flex items-center space-x-1 rounded-md border border-border-subtle bg-bg-card px-2.5 py-1 text-xs font-semibold font-mono text-text-muted transition hover:text-text-main">
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Back to summary</span>
        </button>
        <div className="text-xs font-mono text-text-muted">
          Q{reviewIdx + 1} of {questions.length} | {formatDuration(stats.timeSec || 0)} | {stats.changes || 0} changes
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {activePassage && (
          <section className="flex w-1/2 flex-col overflow-hidden border-r border-border-subtle bg-bg-surface">
            <div className="h-10 flex-shrink-0 border-b border-border-subtle px-4 py-2 text-xs font-semibold font-serif italic text-text-main">Reading Passage</div>
            <div className="flex-1 overflow-y-auto bg-bg-base p-8">
              <h3 className="mb-6 max-w-2xl border-b border-border-subtle/30 pb-4 font-serif text-lg font-bold italic text-text-main">{activePassage.source_label || activePassage.id}</h3>
              <PassageDisplay passage={activePassage} />
            </div>
          </section>
        )}

        <main className={`${activePassage ? 'w-[35%]' : 'w-[80%]'} overflow-y-auto border-r border-border-subtle p-6 md:p-8`}>
          <div className="mb-6 flex items-center justify-between border-b border-border-subtle/50 pb-4">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-lg font-bold text-text-main">Question {reviewIdx + 1}</span>
              <span className={`rounded border px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${tita ? 'border-brand-green/20 bg-brand-green/10 text-brand-green' : 'border-brand-blue/20 bg-brand-blue/10 text-brand-blue'}`}>{tita ? 'TITA' : 'MCQ'}</span>
              <OutcomePill outcome={outcome} />
            </div>
            <button
              type="button"
              onClick={(e) => handleBookmarkToggle(e, q)}
              className={`rounded-md border p-1.5 transition ${bookmarked ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-border-subtle bg-bg-card text-text-muted hover:text-text-main'}`}
              title={bookmarked ? 'Remove Bookmark' : 'Save Bookmark'}
            >
              <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {displayInstruction(q, reviewIdx) && <h2 className="mb-4 rounded-r-lg border-l-2 border-brand-gold/60 bg-bg-surface px-4 py-2.5 text-xs font-normal italic leading-relaxed text-text-muted">{displayInstruction(q, reviewIdx)}</h2>}
          <QuestionStem question={q} />
          <AnswerReview question={q} userAnswer={userAns} />

          {q.explanation && (
            <div className="mt-8 border-t border-dashed border-border-subtle pt-5">
              <div className="mb-3 flex items-center space-x-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand-gold" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-brand-gold">Solution</span>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-surface p-5 text-sm leading-relaxed text-text-muted">
                <QuestionExplanation question={q} />
              </div>
            </div>
          )}
        </main>

        <aside className={`${activePassage ? 'w-[15%]' : 'w-[20%]'} flex-shrink-0 overflow-y-auto bg-bg-surface p-4`}>
          <div className="mb-4 border-b border-border-subtle pb-2 text-[10px] font-bold font-mono uppercase tracking-wider text-text-muted">Review Palette</div>
          <div className={`grid ${activePassage ? 'grid-cols-4' : 'grid-cols-5'} gap-1.5`}>
            {questions.map((item, idx) => {
              const itemOutcome = answerOutcome(item, answers[item.id]);
              const current = idx === reviewIdx;
              let cls = 'border-text-faint/40 bg-bg-card text-text-muted';
              if (itemOutcome === 'correct') cls = 'border-brand-green/40 bg-brand-green/10 text-brand-green';
              if (itemOutcome === 'wrong') cls = 'border-brand-red/40 bg-brand-red/10 text-brand-red';
              if (itemOutcome === 'skipped') cls = 'border-border-subtle bg-bg-card text-text-faint';
              if (current) cls += ' ring-1 ring-brand-gold';
              return (
                <button key={item.id} onClick={() => setReviewIdx(idx)} className={`h-9 rounded border text-xs font-mono font-semibold transition ${cls}`}>{idx + 1}</button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function AnswerReview({ question, userAnswer }) {
  const expected = correctAnswer(question);
  const tita = isTitaQuestion(question);
  const skipped = userAnswer === undefined || userAnswer === '';
  const outcome = answerOutcome(question, userAnswer);

  if (tita) {
    return (
      <div className="mb-6 flex flex-wrap gap-6 rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm font-mono">
        <span className="text-text-muted">Your Response: <b className={outcome === 'correct' ? 'text-brand-green' : 'text-brand-red'}>{skipped ? '[Skipped]' : userAnswer}</b></span>
        <span className="text-text-muted">Correct: <b className="text-brand-green">{expected}</b></span>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-2.5">
      {question.options?.map((opt, oIdx) => {
        const picked = String(userAnswer) === String(opt.key);
        const correctOpt = String(expected) === String(opt.key);
        const stripSourceKey = shouldStripOptionKeys(question.options);
        return (
          <div key={opt.key} className={`flex items-start rounded-xl border p-3.5 text-left text-sm ${correctOpt ? 'border-brand-green bg-brand-green/[0.03]' : picked ? 'border-brand-red bg-brand-red/[0.03]' : 'border-border-subtle text-text-muted'}`}>
            <span className={`mr-3.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border font-mono text-[10px] ${correctOpt ? 'border-brand-green bg-brand-green text-white' : picked ? 'border-brand-red bg-brand-red text-white' : 'border-border-subtle bg-bg-card text-text-faint'}`}>
              {optionDisplayKey(opt, oIdx)}
            </span>
            <span className="mt-0.5 select-text font-sans leading-relaxed"><OptionContent option={opt} stripSourceKey={stripSourceKey} /></span>
          </div>
        );
      })}
      {skipped && <div className="text-xs font-mono text-text-faint">You skipped this question. Correct answer: {expected}</div>}
    </div>
  );
}

function OutcomePill({ outcome }) {
  if (outcome === 'correct') return <span className="rounded bg-brand-green/10 px-2 py-0.5 text-[10px] font-bold font-mono uppercase text-brand-green">Correct</span>;
  if (outcome === 'wrong') return <span className="rounded bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold font-mono uppercase text-brand-red">Wrong</span>;
  return <span className="rounded bg-bg-card px-2 py-0.5 text-[10px] font-bold font-mono uppercase text-text-faint">Skipped</span>;
}

function Stat({ label, value, sub, cls }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-faint">{label}</span>
      <div className={`mt-1 font-mono text-2xl font-bold ${cls}`}>{value}</div>
      <span className="text-[10px] font-mono text-text-faint">{sub}</span>
    </div>
  );
}
