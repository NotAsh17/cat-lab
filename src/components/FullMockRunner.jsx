import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, CheckCircle, ChevronLeft, ChevronRight, Copy, HelpCircle, Play, Type, XCircle } from 'lucide-react';
import { Storage } from '../services/storage';
import { answerOutcome, displayInstruction, isTitaQuestion, questionSection } from '../services/questionUtils';
import { optionDisplayKey, shouldStripOptionKeys } from '../services/optionRenderUtils';
import { OptionContent, PassageDisplay, QuestionStem } from './QuestionDisplay';

function formatTime(secs) {
  return `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

function draftKey(paper) {
  return `attempt_draft_${paper?.id || 'full_mock'}`;
}

function initialStateFromDraft(paper) {
  const firstDuration = paper?.sections?.[0]?.durationSec || 40 * 60;
  if (!paper) {
    return {
      sectionIdx: 0,
      currentIdx: 0,
      answers: {},
      marked: new Set(),
      questionStats: {},
      sectionResults: {},
      showSectionBreak: false,
      timeLeft: firstDuration,
    };
  }
  const saved = localStorage.getItem(draftKey(paper));
  if (!saved) {
    return {
      sectionIdx: 0,
      currentIdx: 0,
      answers: {},
      marked: new Set(),
      questionStats: {},
      sectionResults: {},
      showSectionBreak: false,
      timeLeft: firstDuration,
    };
  }
  try {
    const parsed = JSON.parse(saved);
    const sectionIdx = parsed.sectionIdx || 0;
    return {
      sectionIdx,
      currentIdx: parsed.currentIdx || 0,
      answers: parsed.answers || {},
      marked: new Set(parsed.marked || []),
      questionStats: parsed.questionStats || {},
      sectionResults: parsed.sectionResults || {},
      showSectionBreak: Boolean(parsed.showSectionBreak),
      timeLeft: parsed.timeLeft || paper.sections?.[sectionIdx]?.durationSec || firstDuration,
    };
  } catch {
    localStorage.removeItem(draftKey(paper));
    return {
      sectionIdx: 0,
      currentIdx: 0,
      answers: {},
      marked: new Set(),
      questionStats: {},
      sectionResults: {},
      showSectionBreak: false,
      timeLeft: firstDuration,
    };
  }
}

function attachContextsToSection(section, contextMap) {
  return (section?.questions || []).map((q) => {
    const passage = q.passage_id ? contextMap.get(q.passage_id) : null;
    return passage ? { ...q, passage } : q;
  });
}

function sectionOutcome(questions, answers) {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let score = 0;
  questions.forEach((q) => {
    const outcome = answerOutcome(q, answers[q.id]);
    if (outcome === 'skipped') {
      skipped += 1;
      return;
    }
    if (outcome === 'correct') {
      correct += 1;
      score += 3;
    } else {
      wrong += 1;
      if (!isTitaQuestion(q)) score -= 1;
    }
  });
  return { correct, wrong, skipped, score, max: questions.length * 3 };
}

export default function FullMockRunner({ paper, onFinishTest, onExit }) {
  const initialRef = useRef(initialStateFromDraft(paper));
  const [sectionIdx, setSectionIdx] = useState(initialRef.current.sectionIdx);
  const [currentIdx, setCurrentIdx] = useState(initialRef.current.currentIdx);
  const [answers, setAnswers] = useState(initialRef.current.answers);
  const [marked, setMarked] = useState(initialRef.current.marked);
  const [questionStats, setQuestionStats] = useState(initialRef.current.questionStats);
  const [sectionResults, setSectionResults] = useState(initialRef.current.sectionResults);
  const [showSubmitReview, setShowSubmitReview] = useState(false);
  const [showSectionBreak, setShowSectionBreak] = useState(initialRef.current.showSectionBreak);
  const [timeLeft, setTimeLeft] = useState(initialRef.current.timeLeft);
  const [varcFontSize, setVarcFontSize] = useState('text-base');
  const timerRef = useRef(null);
  const passageRef = useRef(null);
  const activeStartedAtRef = useRef(Date.now());

  const contextMap = useMemo(() => new Map((paper?.contexts || []).map((ctx) => [ctx.id, ctx])), [paper]);
  const sections = useMemo(() => paper?.sections || [], [paper]);
  const activeSection = sections[sectionIdx] || null;
  const questions = useMemo(() => attachContextsToSection(activeSection, contextMap), [activeSection, contextMap]);
  const activeQuestion = questions[currentIdx];
  const activePassage = activeQuestion?.passage || null;
  const isLastSection = sectionIdx === sections.length - 1;

  useEffect(() => {
    if (!paper || showSectionBreak) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitSection({ force: true });
          return 0;
        }
        saveDraft({ nextTimeLeft: prev - 1 });
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper, sectionIdx, currentIdx, answers, marked, questionStats, sectionResults, showSectionBreak]);

  useEffect(() => {
    if (passageRef.current) passageRef.current.scrollTop = 0;
  }, [currentIdx, sectionIdx]);

  useEffect(() => {
    activeStartedAtRef.current = Date.now();
    return () => {
      const q = questions[currentIdx];
      if (!q || showSectionBreak) return;
      const elapsed = Math.max(0, Math.round((Date.now() - activeStartedAtRef.current) / 1000));
      if (!elapsed) return;
      setQuestionStats((prev) => ({
        ...prev,
        [q.id]: {
          timeSec: (prev[q.id]?.timeSec || 0) + elapsed,
          changes: prev[q.id]?.changes || 0,
        },
      }));
    };
  }, [currentIdx, sectionIdx, questions, showSectionBreak]);

  function saveDraft(overrides = {}) {
    if (!paper) return;
    localStorage.setItem(draftKey(paper), JSON.stringify({
      sectionIdx,
      currentIdx,
      answers,
      marked: Array.from(marked),
      questionStats,
      sectionResults,
      showSectionBreak,
      timeLeft,
      ...overrides,
    }));
  }

  function statsWithActive() {
    if (!activeQuestion || showSectionBreak) return questionStats;
    const elapsed = Math.max(0, Math.round((Date.now() - activeStartedAtRef.current) / 1000));
    return {
      ...questionStats,
      [activeQuestion.id]: {
        timeSec: (questionStats[activeQuestion.id]?.timeSec || 0) + elapsed,
        changes: questionStats[activeQuestion.id]?.changes || 0,
      },
    };
  }

  function recordAnswer(value) {
    if (!activeQuestion) return;
    setAnswers((prev) => {
      const previous = prev[activeQuestion.id];
      const changedExisting = previous !== undefined && previous !== '' && String(previous) !== String(value);
      if (changedExisting) {
        setQuestionStats((stats) => ({
          ...stats,
          [activeQuestion.id]: {
            timeSec: stats[activeQuestion.id]?.timeSec || 0,
            changes: (stats[activeQuestion.id]?.changes || 0) + 1,
          },
        }));
      }
      return { ...prev, [activeQuestion.id]: value };
    });
  }

  function submitSection({ force = false } = {}) {
    if (!force) {
      setShowSubmitReview(true);
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setShowSubmitReview(false);

    const finalStats = statsWithActive();
    const currentUsed = Math.max(0, (activeSection?.durationSec || 40 * 60) - timeLeft);
    const currentResult = {
      ...sectionOutcome(questions, answers),
      timeUsed: currentUsed,
      submittedAt: new Date().toISOString(),
      sectionId: activeSection.id,
      title: activeSection.title,
    };
    const nextSectionResults = { ...sectionResults, [activeSection.id]: currentResult };

    if (!isLastSection) {
      setQuestionStats(finalStats);
      setSectionResults(nextSectionResults);
      setShowSectionBreak(true);
      localStorage.setItem(draftKey(paper), JSON.stringify({
        sectionIdx,
        currentIdx,
        answers,
        marked: Array.from(marked),
        questionStats: finalStats,
        sectionResults: nextSectionResults,
        showSectionBreak: true,
        timeLeft,
      }));
      return;
    }

    const allQuestions = sections.flatMap((section) => attachContextsToSection(section, contextMap));
    const totals = sectionOutcome(allQuestions, answers);
    const totalTimeUsed = Object.values(nextSectionResults).reduce((sum, result) => sum + (result.timeUsed || 0), 0);
    localStorage.removeItem(draftKey(paper));
    onFinishTest({
      testId: `full_mock-${paper.id}`,
      testType: 'full_mock',
      paperId: paper.id,
      paper: {
        id: paper.id,
        title: paper.title,
        durationSec: paper.durationSec,
        questionCount: paper.questionCount,
        sections: sections.map((section) => ({
          id: section.id,
          title: section.title,
          shortTitle: section.shortTitle,
          questionCount: section.questionCount,
          durationSec: section.durationSec,
        })),
      },
      score: totals.score,
      max: totals.max,
      correct: totals.correct,
      wrong: totals.wrong,
      skipped: totals.skipped,
      timeUsed: totalTimeUsed,
      answers,
      marked: Array.from(marked),
      questionStats: finalStats,
      sectionResults: nextSectionResults,
      questions: allQuestions,
      questionIds: allQuestions.map((q) => q.id),
      sourceMix: { [paper.title]: allQuestions.length },
      typeMix: Object.fromEntries(sections.map((section) => [section.shortTitle, section.questionCount])),
    });
  }

  function startNextSection() {
    const nextIdx = Math.min(sectionIdx + 1, sections.length - 1);
    setSectionIdx(nextIdx);
    setCurrentIdx(0);
    setTimeLeft(sections[nextIdx]?.durationSec || 40 * 60);
    setShowSectionBreak(false);
    localStorage.setItem(draftKey(paper), JSON.stringify({
      sectionIdx: nextIdx,
      currentIdx: 0,
      answers,
      marked: Array.from(marked),
      questionStats,
      sectionResults,
      showSectionBreak: false,
      timeLeft: sections[nextIdx]?.durationSec || 40 * 60,
    }));
  }

  function toggleMarkForReview() {
    const next = new Set(marked);
    if (next.has(activeQuestion.id)) next.delete(activeQuestion.id);
    else next.add(activeQuestion.id);
    setMarked(next);
  }

  function clearAnswer() {
    const next = { ...answers };
    delete next[activeQuestion.id];
    setAnswers(next);
  }

  function handleBookmarkToggle() {
    if (Storage.isBookmarked(activeQuestion.id)) {
      Storage.removeBookmark(activeQuestion.id);
    } else {
      Storage.saveBookmark(
        activeQuestion,
        questionSection(activeQuestion, activeSection?.id || 'varc'),
        activePassage?.source_label || paper.title,
        activePassage?.paragraphs?.join('\n\n') || '',
      );
    }
  }

  function copyQuestionToClipboard() {
    const text = `${displayInstruction(activeQuestion, currentIdx) || ''}\n\n${activeQuestion.stem || activeQuestion.stem_text || activeQuestion.id}\n\n${(activeQuestion.options || [])
      .map((o) => `${o.key}) ${o.text || ''}`)
      .join('\n')}`;
    navigator.clipboard.writeText(text);
  }

  if (!paper || !activeSection) {
    return <div className="flex h-screen items-center justify-center font-mono text-xs text-text-muted">Loading full mock...</div>;
  }

  if (showSectionBreak) {
    const result = sectionResults[activeSection.id] || sectionOutcome(questions, answers);
    const nextSection = sections[sectionIdx + 1];
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base p-6 text-text-main">
        <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-bg-surface p-8 shadow-2xl">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-gold">{paper.title}</div>
          <h2 className="mt-2 font-serif text-3xl font-bold">{activeSection.shortTitle} Submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Your section is locked. Take a break here if needed; the next section timer starts only when you press start.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <BreakStat label="Score" value={`${result.score} / ${result.max}`} />
            <BreakStat label="Correct" value={result.correct} tone="text-brand-green" />
            <BreakStat label="Wrong" value={result.wrong} tone="text-brand-red" />
            <BreakStat label="Skipped" value={result.skipped} />
          </div>

          <div className="mt-7 rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">Next Section</div>
            <div className="mt-1 font-serif text-xl font-bold text-text-main">{nextSection?.title}</div>
            <div className="mt-1 text-xs font-mono text-text-muted">40 minutes | {nextSection?.questionCount || 0} questions</div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                saveDraft({ showSectionBreak: true });
                onExit();
              }}
              className="rounded-xl border border-border-subtle px-5 py-2.5 text-xs font-bold font-mono text-text-muted transition hover:border-text-muted hover:text-text-main"
            >
              Pause and Resume Later
            </button>
            <button
              type="button"
              onClick={startNextSection}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-2.5 text-xs font-bold font-mono text-bg-base transition hover:bg-brand-gold-hover"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start {nextSection?.shortTitle}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeQuestion) {
    return <div className="flex h-screen items-center justify-center font-mono text-xs text-text-muted">Preparing section...</div>;
  }

  const tita = isTitaQuestion(activeQuestion);
  const bookmarked = Storage.isBookmarked(activeQuestion.id);
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const markedCount = questions.filter((q) => marked.has(q.id)).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const activeInstruction = displayInstruction(activeQuestion, currentIdx);

  return (
    <div className="flex h-screen w-full select-none flex-col bg-bg-base text-text-main">
      <header className="z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6">
        <div className="flex min-w-0 items-center space-x-4">
          <button onClick={onExit} className="flex items-center space-x-1 rounded-md border border-border-subtle bg-bg-card px-2.5 py-1 text-xs font-semibold font-mono text-text-muted transition hover:bg-bg-surface hover:text-text-main">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Exit Mock</span>
          </button>
          <div className="h-4 w-px bg-border-subtle" />
          <div className="min-w-0">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-brand-gold">{activeSection.shortTitle}</span>
            <span className="ml-2 text-xs font-mono text-text-faint">Section {sectionIdx + 1} of {sections.length} | Q{currentIdx + 1} of {questions.length}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3 rounded-lg border border-border-subtle bg-bg-card px-3 py-1.5 font-mono text-sm">
          <span className={`h-2 w-2 rounded-full ${timeLeft < 180 ? 'animate-ping bg-brand-red' : 'bg-brand-green'}`} />
          <span className={timeLeft < 180 ? 'font-bold text-brand-red' : 'text-text-main'}>{formatTime(timeLeft)}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-grow overflow-hidden">
          {activePassage ? (
            <div className="flex flex-1 overflow-hidden">
              <div className="flex w-1/2 flex-col overflow-hidden border-r border-border-subtle bg-bg-surface">
                <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border-subtle px-4 text-xs text-text-muted">
                  <span className="font-serif font-semibold italic text-text-main">{activeSection.id === 'lrdi' ? 'Data Set' : 'Reading Passage'}</span>
                  {activeSection.id === 'varc' && (
                    <div className="flex items-center space-x-1 rounded border border-border-subtle bg-bg-card px-1.5 py-0.5">
                      <Type className="mr-1 h-3 w-3 text-text-faint" />
                      {['text-sm', 'text-base', 'text-lg'].map((size, idx) => (
                        <button key={size} onClick={() => setVarcFontSize(size)} className={`rounded px-1.5 py-px text-[10px] font-bold ${varcFontSize === size ? 'bg-brand-gold text-bg-base' : 'text-text-muted hover:text-text-main'}`}>
                          {idx === 0 ? 'A-' : idx === 1 ? 'A' : 'A+'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div ref={passageRef} className="flex-1 overflow-y-auto bg-bg-base p-6 md:p-8">
                  <h3 className="mb-6 max-w-2xl border-b border-border-subtle/30 pb-4 font-serif text-lg font-bold italic leading-tight text-text-main">
                    {activePassage.source_label || activePassage.id}
                  </h3>
                  <PassageDisplay passage={activePassage} fontSize={varcFontSize} />
                </div>
              </div>
              <div className="flex w-[35%] flex-col overflow-y-auto border-r border-border-subtle bg-bg-base">{renderQuestionWorkspace()}</div>
            </div>
          ) : (
            <div className="flex w-[80%] flex-col overflow-y-auto border-r border-border-subtle bg-bg-base">{renderQuestionWorkspace()}</div>
          )}
        </div>

        <aside className={`${activePassage ? 'w-[15%]' : 'w-[20%]'} flex-shrink-0 overflow-y-auto bg-bg-surface`}>
          <div className="p-4">
            <div className="mb-4 border-b border-border-subtle pb-2 text-[10px] font-bold font-mono uppercase tracking-wider text-text-muted">Question Palette</div>
            <div className={`mb-6 grid ${activePassage ? 'grid-cols-4' : 'grid-cols-5'} gap-1.5`}>
              {questions.map((q, idx) => {
                const current = idx === currentIdx;
                const isMarked = marked.has(q.id);
                const answered = answers[q.id] !== undefined && answers[q.id] !== '';
                let cls = 'bg-bg-card border-border-subtle text-text-muted hover:border-text-muted';
                if (current) cls = 'bg-bg-base border-brand-gold text-brand-gold ring-1 ring-brand-gold font-bold';
                else if (isMarked) cls = 'bg-purple-950/20 border-purple-500/50 text-purple-400 font-semibold';
                else if (answered) cls = 'bg-brand-green/15 border-brand-green/30 text-brand-green font-semibold';
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(idx)} className={`h-9 rounded border text-xs font-mono transition ${cls}`}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-4 text-[10px] font-mono">
              <div className="flex items-center space-x-2"><div className="h-3 w-3 rounded border border-brand-green/30 bg-brand-green/15" /><span className="text-text-muted">Answered</span></div>
              <div className="flex items-center space-x-2"><div className="h-3 w-3 rounded border border-purple-500/50 bg-purple-950/20" /><span className="text-text-muted">Marked</span></div>
              <div className="flex items-center space-x-2"><div className="h-3 w-3 rounded border border-brand-gold bg-bg-base" /><span className="text-text-muted">Active</span></div>
            </div>
          </div>
          <div className="border-t border-border-subtle bg-bg-card p-4">
            <button onClick={submitSection} className="w-full rounded-lg bg-brand-gold py-2.5 text-xs font-bold font-mono tracking-wider text-bg-base transition hover:bg-brand-gold-hover">
              {isLastSection ? 'Submit Mock' : 'Submit Section'}
            </button>
          </div>
        </aside>
      </div>

      <footer className="z-10 flex h-14 flex-shrink-0 items-center justify-between border-t border-border-subtle bg-bg-surface px-6">
        <div className="flex space-x-3">
          <button onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))} disabled={currentIdx === 0} className="flex items-center space-x-1 rounded-lg border border-border-subtle px-4 py-2 text-xs font-semibold font-mono transition hover:border-text-muted hover:text-text-main disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>
          <button onClick={toggleMarkForReview} className={`rounded-lg border px-4 py-2 text-xs font-semibold font-mono transition ${marked.has(activeQuestion.id) ? 'border-purple-500/50 bg-purple-950/20 text-purple-400' : 'border-border-subtle hover:border-text-muted hover:text-text-main'}`}>
            {marked.has(activeQuestion.id) ? 'Unmark Review' : 'Mark for Review'}
          </button>
          <button onClick={clearAnswer} disabled={answers[activeQuestion.id] === undefined || answers[activeQuestion.id] === ''} className="text-xs font-mono text-text-faint transition hover:text-brand-red disabled:opacity-30">Clear Response</button>
        </div>
        <button onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))} disabled={currentIdx === questions.length - 1} className="flex items-center space-x-1 rounded-lg border border-border-subtle bg-bg-card px-6 py-2 text-xs font-bold font-mono transition hover:border-text-muted hover:text-text-main disabled:opacity-30">
          <span>Save & Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </footer>

      {showSubmitReview && (
        <SubmitSectionModal
          activeSection={activeSection}
          questions={questions}
          answers={answers}
          marked={marked}
          answeredCount={answeredCount}
          markedCount={markedCount}
          unansweredCount={unansweredCount}
          isLastSection={isLastSection}
          onClose={() => setShowSubmitReview(false)}
          onJump={(idx) => {
            setCurrentIdx(idx);
            setShowSubmitReview(false);
          }}
          onSubmit={() => submitSection({ force: true })}
        />
      )}
    </div>
  );

  function renderQuestionWorkspace() {
    return (
      <div className="flex min-h-0 flex-grow flex-col justify-between p-6 font-sans select-text md:p-8">
        <div>
          <div className="mb-6 flex items-center justify-between border-b border-border-subtle/50 pb-4">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-base font-bold text-text-main md:text-lg">Question {currentIdx + 1}</span>
              <span className={`rounded border px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${tita ? 'border-brand-green/20 bg-brand-green/10 text-brand-green' : 'border-brand-blue/20 bg-brand-blue/10 text-brand-blue'}`}>
                {tita ? 'TITA' : 'MCQ'}
              </span>
              <span className="text-[10px] font-mono text-text-faint">[+3 / {tita ? '0' : '-1'}]</span>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={copyQuestionToClipboard} className="rounded-md border border-border-subtle bg-bg-card p-1.5 text-text-muted transition hover:bg-bg-surface hover:text-text-main" title="Copy Question">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleBookmarkToggle} className={`rounded-md border p-1.5 transition ${bookmarked ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-border-subtle bg-bg-card text-text-muted hover:bg-bg-surface hover:text-text-main'}`} title={bookmarked ? 'Remove Bookmark' : 'Save Bookmark'}>
                <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {activeInstruction && <h2 className="mb-4 rounded-r-lg border-l-2 border-brand-gold/60 bg-bg-surface px-4 py-2.5 text-xs font-normal italic leading-relaxed text-text-muted">{activeInstruction}</h2>}
          <QuestionStem question={activeQuestion} />

          {tita ? (
            <div className="mt-4 max-w-sm">
              <input type="text" value={answers[activeQuestion.id] || ''} onChange={(e) => recordAnswer(e.target.value)} placeholder="Enter TITA response..." className="mb-3 w-full rounded-xl border border-border-subtle bg-bg-surface p-2.5 font-mono text-sm text-text-main focus:border-brand-gold focus:outline-none" />
              <div className="rounded-xl border border-border-subtle bg-bg-surface p-3">
                <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '.', '-'].map((k) => <button key={k} onClick={() => recordAnswer(`${answers[activeQuestion.id] || ''}${k}`)} className="h-9 rounded-md border border-border-subtle bg-bg-card font-semibold text-text-main transition hover:border-brand-gold active:bg-brand-gold/15">{k}</button>)}
                  <button onClick={() => recordAnswer('')} className="h-9 rounded-md border border-border-subtle bg-bg-card font-semibold text-text-muted transition hover:border-brand-red hover:text-brand-red">Clear</button>
                  <button onClick={() => recordAnswer(String(answers[activeQuestion.id] || '').slice(0, -1))} className="col-span-2 h-9 rounded-md border border-border-subtle bg-bg-card font-semibold text-text-muted transition hover:border-brand-red hover:text-brand-red">Backspace</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeQuestion.options?.map((opt, idx) => {
                const selected = String(answers[activeQuestion.id]) === String(opt.key);
                const stripSourceKey = shouldStripOptionKeys(activeQuestion.options);
                return (
                  <button key={opt.key} onClick={() => recordAnswer(opt.key)} className={`flex w-full items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${selected ? 'border-brand-gold bg-brand-gold/[0.02] text-text-main' : 'border-border-subtle text-text-muted hover:border-text-faint hover:bg-bg-surface/30 hover:text-text-main'}`}>
                    <span className={`mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-bold transition-all ${selected ? 'border-brand-gold bg-brand-gold text-bg-base' : 'border-border-subtle bg-bg-card text-text-faint'}`}>
                      {optionDisplayKey(opt, idx)}
                    </span>
                    <span className="mt-0.5 select-text font-sans text-xs leading-relaxed md:text-sm"><OptionContent option={opt} stripSourceKey={stripSourceKey} /></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
}

function BreakStat({ label, value, tone = 'text-text-main' }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-4 text-center">
      <div className={`font-mono text-xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">{label}</div>
    </div>
  );
}

function SubmitSectionModal({
  activeSection,
  questions,
  answers,
  marked,
  answeredCount,
  markedCount,
  unansweredCount,
  isLastSection,
  onClose,
  onJump,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-2xl">
        <h3 className="font-serif text-2xl font-bold text-text-main">Review {activeSection.shortTitle}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          Once submitted, this section is locked. You can take a break before starting the next section.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <SubmitStat label="Answered" value={answeredCount} tone="text-brand-green" />
          <SubmitStat label="Flagged" value={markedCount} tone="text-purple-review" />
          <SubmitStat label="Unanswered" value={unansweredCount} tone="text-text-muted" />
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">Questions</div>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((q, idx) => {
              const answered = answers[q.id] !== undefined && answers[q.id] !== '';
              const flagged = marked.has(q.id);
              let cls = 'border-border-subtle bg-bg-card text-text-muted';
              if (answered) cls = 'border-brand-green/40 bg-brand-green/10 text-brand-green';
              if (flagged) cls = 'border-purple-review/50 bg-purple-review/10 text-purple-review';
              return (
                <button key={q.id} type="button" onClick={() => onJump(idx)} className={`h-8 rounded-md border text-xs font-mono font-semibold transition hover:border-brand-gold ${cls}`}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-[10px] font-mono text-text-muted">
          <span className="inline-flex items-center gap-1"><CheckCircle className="h-3 w-3 text-brand-green" /> Answered</span>
          <span className="inline-flex items-center gap-1"><HelpCircle className="h-3 w-3 text-purple-review" /> Flagged for review</span>
          <span className="inline-flex items-center gap-1"><XCircle className="h-3 w-3 text-text-faint" /> Unanswered</span>
        </div>

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border-subtle px-4 py-2 text-xs font-bold text-text-muted transition hover:border-text-muted hover:text-text-main">
            Back to questions
          </button>
          <button type="button" onClick={onSubmit} className="rounded-lg bg-brand-gold px-5 py-2 text-xs font-bold text-bg-base transition hover:bg-brand-gold-hover">
            {isLastSection ? 'Submit mock' : 'Submit section'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmitStat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-4 text-center">
      <div className={`font-mono text-2xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">{label}</div>
    </div>
  );
}
