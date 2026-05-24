import { useEffect, useRef, useState } from 'react';
import { Bookmark, CheckCircle, ChevronLeft, ChevronRight, Copy, HelpCircle, Pause, Play, Type, XCircle } from 'lucide-react';
import { Storage } from '../services/storage';
import { answerOutcome, displayInstruction, isQaQuestion, isTitaQuestion, questionType } from '../services/questionUtils';
import { optionDisplayKey, shouldStripOptionKeys } from '../services/optionRenderUtils';
import { OptionContent, PassageDisplay, QuestionStem } from './QuestionDisplay';
import { seededRng, shuffleStable } from '../services/paperGenerator';

function questionOrder(a, b) {
  return Number(a.question_number || a.number || 0) - Number(b.question_number || b.number || 0);
}

export default function TestRunner({
  db,
  testType,
  testId,
  untimed = false,
  customQuestions = null,
  paper = null,
  onFinishTest,
  onExit,
}) {
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(new Set());
  const [questionStats, setQuestionStats] = useState({});
  const [showSubmitReview, setShowSubmitReview] = useState(false);
  const [timeLeft, setTimeLeft] = useState(40 * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [varcFontSize, setVarcFontSize] = useState('text-base');
  const timerRef = useRef(null);
  const passageRef = useRef(null);
  const initialTimeRef = useRef(40 * 60);
  const activeStartedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!db && !paper && !customQuestions) return;
    let loadedQuestions = [];
    let duration = 40 * 60;
    let preserveOrder = false;

    if (paper) {
      loadedQuestions = [...(paper.questions || [])];
      duration = paper.durationSec || duration;
      preserveOrder = true;
    } else if (customQuestions?.length) {
      loadedQuestions = [...customQuestions];
      duration = Math.max(300, Math.round(loadedQuestions.length * 2.5 * 60));
      preserveOrder = true;
    } else if (testType === 'practice') {
      if (String(testId).startsWith('rc_')) {
        const pid = String(testId).replace('rc_', '');
        const passage = db.varc.passages.find((p) => p.id === pid);
        loadedQuestions = db.varc.questions.filter((q) => passage?.question_ids?.includes(q.id)).sort(questionOrder);
        duration = Math.round(loadedQuestions.length * 2.5 * 60);
      } else {
        const filters = {
          para_jumble: ['va_para_jumble_tita', 'va_para_jumble_mcq'],
          summary: ['va_summary_mcq', 'va_summary_tita'],
          odd_one_out: ['va_odd_one_out_tita'],
          para_completion: ['va_sentence_placement_mcq', 'va_para_completion_mcq'],
        };
        const pool = db.varc.questions.filter((q) => filters[testId]?.includes(questionType(q)));
        const rng = seededRng(`va-practice:${testId}:${Date.now()}`);
        loadedQuestions = shuffleStable(pool, rng).slice(0, Math.min(15, Math.max(10, pool.length)));
        duration = 15 * 60;
      }
    } else if (testType === 'bookmarks') {
      const bookmarks = Storage.getBookmarks();
      loadedQuestions = testId === 'all' ? bookmarks.map((b) => b.question) : bookmarks.filter((b) => b.section === testId).map((b) => b.question);
      duration = Math.max(300, loadedQuestions.length * 180);
      preserveOrder = true;
    }

    if (!preserveOrder) loadedQuestions.sort(questionOrder);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestions(loadedQuestions);
    setTimeLeft(duration);
    initialTimeRef.current = duration;
    setCurrentIdx(0);

    const saveKey = `attempt_draft_${paper?.id || `${testType}_${testId}`}`;
    const saved = localStorage.getItem(saveKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAnswers(parsed.answers || {});
        setMarked(new Set(parsed.marked || []));
        setQuestionStats(parsed.questionStats || {});
        setTimeLeft(parsed.timeLeft || duration);
        setCurrentIdx(parsed.currentIdx || 0);
      } catch {
        localStorage.removeItem(saveKey);
      }
    } else {
      setAnswers({});
      setMarked(new Set());
      setQuestionStats({});
    }
  }, [db, testType, testId, customQuestions, paper]);

  useEffect(() => {
    if (untimed || isPaused || questions.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitTest({ force: true });
          return 0;
        }
        const saveKey = `attempt_draft_${paper?.id || `${testType}_${testId}`}`;
        localStorage.setItem(saveKey, JSON.stringify({ answers, marked: Array.from(marked), questionStats, timeLeft: prev - 1, currentIdx }));
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, untimed, answers, marked, questionStats, currentIdx, questions.length, paper, testType, testId]);

  useEffect(() => {
    if (passageRef.current) passageRef.current.scrollTop = 0;
  }, [currentIdx]);

  useEffect(() => {
    activeStartedAtRef.current = Date.now();
    return () => {
      const q = questions[currentIdx];
      if (!q || isPaused) return;
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
  }, [currentIdx, questions, isPaused]);

  const activeQuestion = questions[currentIdx];
  const activePassage = activeQuestion?.passage || (activeQuestion?.passage_id ? db?.varc?.passages?.find((p) => p.id === activeQuestion.passage_id) : null);

  const formatTime = (secs) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

  const statsWithActive = () => {
    if (!activeQuestion || isPaused) return questionStats;
    const elapsed = Math.max(0, Math.round((Date.now() - activeStartedAtRef.current) / 1000));
    return {
      ...questionStats,
      [activeQuestion.id]: {
        timeSec: (questionStats[activeQuestion.id]?.timeSec || 0) + elapsed,
        changes: questionStats[activeQuestion.id]?.changes || 0,
      },
    };
  };

  const recordAnswer = (value) => {
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
  };

  const handlePickOption = (optionKey) => recordAnswer(optionKey);
  const handleTitaInput = (value) => recordAnswer(value);
  const handleTitaKeypad = (key) => {
    const current = answers[activeQuestion.id] || '';
    if (key === 'backspace') handleTitaInput(current.slice(0, -1));
    else if (key === 'clear') handleTitaInput('');
    else handleTitaInput(current + key);
  };
  const toggleMarkForReview = () => {
    const next = new Set(marked);
    if (next.has(activeQuestion.id)) next.delete(activeQuestion.id);
    else next.add(activeQuestion.id);
    setMarked(next);
  };
  const handleClearAnswer = () => {
    const next = { ...answers };
    delete next[activeQuestion.id];
    setAnswers(next);
  };

  function submitTest({ force = false } = {}) {
    if (!force) {
      setShowSubmitReview(true);
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem(`attempt_draft_${paper?.id || `${testType}_${testId}`}`);

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;
    questions.forEach((q) => {
      const userAns = answers[q.id];
      const outcome = answerOutcome(q, userAns);
      if (outcome === 'skipped') {
        skipped += 1;
        return;
      }
      const isTita = isTitaQuestion(q);
      if (outcome === 'correct') {
        correct += 1;
        score += 3;
      } else {
        wrong += 1;
        if (!isTita) score -= 1;
      }
    });

    onFinishTest({
      testId: `${testType}-${paper?.id || testId}`,
      testType,
      paperId: paper?.id,
      paper,
      seed: paper?.seed,
      blueprintId: paper?.blueprintId,
      dailySectionId: paper?.dailySectionId,
      score,
      max: questions.length * 3,
      correct,
      wrong,
      skipped,
      timeUsed: initialTimeRef.current - timeLeft,
      answers,
      marked: Array.from(marked),
      questionStats: statsWithActive(),
      questions,
      questionIds: questions.map((q) => q.id),
      sourceMix: paper?.sourceMix,
      typeMix: paper?.typeMix,
    });
  }

  const handleBookmarkToggle = () => {
    if (Storage.isBookmarked(activeQuestion.id)) {
      Storage.removeBookmark(activeQuestion.id);
    } else {
      Storage.saveBookmark(
        activeQuestion,
        isQaQuestion(activeQuestion) ? 'qa' : 'varc',
        activePassage?.source_label || activePassage?.title || activePassage?.id,
        activePassage?.paragraphs?.join('\n\n') || activePassage?.passage || '',
      );
    }
  };

  const copyQuestionToClipboard = () => {
    const text = `${displayInstruction(activeQuestion, currentIdx) || ''}\n\n${activeQuestion.stem || activeQuestion.stem_text || activeQuestion.id}\n\n${(activeQuestion.options || [])
      .map((o) => `${o.key}) ${o.text || ''}`)
      .join('\n')}`;
    navigator.clipboard.writeText(text);
  };

  if (!activeQuestion) {
    return <div className="flex h-screen items-center justify-center font-mono text-xs text-text-muted">Initializing exam workspace...</div>;
  }

  const tita = isTitaQuestion(activeQuestion);
  const bookmarked = Storage.isBookmarked(activeQuestion.id);
  const activeInstruction = displayInstruction(activeQuestion, currentIdx);
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const markedCount = marked.size;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  return (
    <div className="flex flex-col h-screen w-full select-none bg-bg-base text-text-main">
      {isPaused && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-base/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-bg-surface border border-border-subtle p-8 rounded-2xl max-w-sm text-center shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <h3 className="text-xl font-bold font-serif mb-2 text-text-main">Test Paused</h3>
            <p className="text-xs text-text-muted mb-6 leading-relaxed">Your test interface and timer are frozen.</p>
            <button onClick={() => setIsPaused(false)} className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-bg-base rounded-lg text-xs font-semibold font-mono tracking-wide transition flex items-center space-x-2 mx-auto">
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Practice</span>
            </button>
          </div>
        </div>
      )}

      <header className="h-14 border-b border-border-subtle bg-bg-surface flex items-center justify-between px-6 z-10 flex-shrink-0">
        <div className="flex items-center space-x-4 min-w-0">
          <button onClick={onExit} className="text-xs text-text-muted hover:text-text-main font-semibold font-mono flex items-center space-x-1 border border-border-subtle px-2.5 py-1 rounded-md bg-bg-card hover:bg-bg-surface transition">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Exit Practice</span>
          </button>
          <div className="h-4 w-px bg-border-subtle" />
          <div className="min-w-0">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-brand-gold">
              {paper?.blueprintId || testType}
            </span>
            <span className="text-xs text-text-faint font-mono ml-2">(Q{currentIdx + 1} of {questions.length})</span>
          </div>
        </div>

        {!untimed ? (
          <div className="flex items-center space-x-3 bg-bg-card border border-border-subtle rounded-lg px-3 py-1.5 font-mono text-sm">
            <span className={`w-2 h-2 rounded-full ${timeLeft < 180 ? 'bg-brand-red animate-ping' : 'bg-brand-green'}`} />
            <span className={timeLeft < 180 ? 'text-brand-red font-bold' : 'text-text-main'}>{formatTime(timeLeft)}</span>
            <button onClick={() => setIsPaused(true)} className="text-text-muted hover:text-text-main p-0.5" title="Pause Test">
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-bg-card border border-border-subtle rounded-lg px-3 py-1.5 font-mono text-xs text-text-muted">Untimed</div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-grow flex overflow-hidden min-w-0">
          {activePassage ? (
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/2 border-r border-border-subtle flex flex-col bg-bg-surface overflow-hidden">
                <div className="h-10 border-b border-border-subtle px-4 flex items-center justify-between text-xs text-text-muted flex-shrink-0">
                  <span className="font-semibold font-serif italic text-text-main">Reading Passage</span>
                  <div className="flex items-center space-x-1 bg-bg-card border border-border-subtle rounded px-1.5 py-0.5">
                    <Type className="w-3 h-3 text-text-faint mr-1" />
                    {['text-sm', 'text-base', 'text-lg'].map((size, idx) => (
                      <button key={size} onClick={() => setVarcFontSize(size)} className={`px-1.5 py-px text-[10px] font-bold rounded ${varcFontSize === size ? 'bg-brand-gold text-bg-base' : 'text-text-muted hover:text-text-main'}`}>
                        {idx === 0 ? 'A-' : idx === 1 ? 'A' : 'A+'}
                      </button>
                    ))}
                  </div>
                </div>
                <div ref={passageRef} className="flex-1 p-6 md:p-8 overflow-y-auto select-text bg-bg-base">
                  <h3 className="text-lg font-bold font-serif italic tracking-tight text-text-main mb-6 leading-tight max-w-2xl border-b border-border-subtle/30 pb-4">
                    {activePassage.source_label || activePassage.id}
                  </h3>
                  <PassageDisplay passage={activePassage} fontSize={varcFontSize} />
                </div>
              </div>
              <div className="w-[35%] flex flex-col overflow-y-auto bg-bg-base border-r border-border-subtle">{renderQuestionWorkspace()}</div>
            </div>
          ) : (
            <div className="w-[80%] flex flex-col bg-bg-base overflow-y-auto border-r border-border-subtle">{renderQuestionWorkspace()}</div>
          )}
        </div>

        <aside className={`${activePassage ? 'w-[15%]' : 'w-[20%]'} flex-shrink-0 bg-bg-surface flex flex-col justify-between overflow-y-auto`}>
          <div className="p-4">
            <div className="font-bold text-[10px] font-mono uppercase tracking-wider text-text-muted mb-4 border-b border-border-subtle pb-2">Question Palette</div>
            <div className={`grid ${activePassage ? 'grid-cols-4' : 'grid-cols-5'} gap-1.5 mb-6`}>
              {questions.map((q, idx) => {
                const current = idx === currentIdx;
                const isMarked = marked.has(q.id);
                const answered = answers[q.id] !== undefined && answers[q.id] !== '';
                let cls = 'bg-bg-card border-border-subtle text-text-muted hover:border-text-muted';
                if (current) cls = 'bg-bg-base border-brand-gold text-brand-gold ring-1 ring-brand-gold font-bold';
                else if (isMarked) cls = 'bg-purple-950/20 border-purple-500/50 text-purple-400 font-semibold';
                else if (answered) cls = 'bg-brand-green/15 border-brand-green/30 text-brand-green font-semibold';
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(idx)} className={`h-9 border rounded text-xs font-mono transition ${cls}`}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-4 text-[10px] font-mono">
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-brand-green/15 border border-brand-green/30 rounded" /><span className="text-text-muted">Answered</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-purple-950/20 border border-purple-500/50 rounded" /><span className="text-text-muted">Marked</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-bg-base border border-brand-gold rounded" /><span className="text-text-muted">Active</span></div>
            </div>
          </div>
          <div className="p-4 border-t border-border-subtle bg-bg-card">
            <button onClick={submitTest} className="w-full py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-bg-base rounded-lg text-xs font-bold font-mono tracking-wider transition">Submit</button>
          </div>
        </aside>
      </div>

      <footer className="h-14 border-t border-border-subtle bg-bg-surface flex items-center justify-between px-6 z-10 flex-shrink-0">
        <div className="flex space-x-3">
          <button onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))} disabled={currentIdx === 0} className="px-4 py-2 border border-border-subtle disabled:opacity-30 rounded-lg text-xs font-semibold font-mono hover:text-text-main hover:border-text-muted transition flex items-center space-x-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          <button onClick={toggleMarkForReview} className={`px-4 py-2 border rounded-lg text-xs font-semibold font-mono transition ${marked.has(activeQuestion.id) ? 'bg-purple-950/20 border-purple-500/50 text-purple-400' : 'border-border-subtle hover:text-text-main hover:border-text-muted'}`}>
            {marked.has(activeQuestion.id) ? 'Unmark Review' : 'Mark for Review'}
          </button>
          <button onClick={handleClearAnswer} disabled={answers[activeQuestion.id] === undefined || answers[activeQuestion.id] === ''} className="px-4 py-2 text-xs text-text-faint hover:text-brand-red disabled:opacity-30 transition font-mono">Clear Response</button>
        </div>
        <button onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))} disabled={currentIdx === questions.length - 1} className="px-6 py-2 bg-bg-card border border-border-subtle disabled:opacity-30 hover:border-text-muted rounded-lg text-xs font-bold font-mono hover:text-text-main transition flex items-center space-x-1">
          <span>Save & Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </footer>

      {showSubmitReview && (
        <SubmitReviewModal
          questions={questions}
          answers={answers}
          marked={marked}
          answeredCount={answeredCount}
          markedCount={markedCount}
          unansweredCount={unansweredCount}
          onClose={() => setShowSubmitReview(false)}
          onJump={(idx) => {
            setCurrentIdx(idx);
            setShowSubmitReview(false);
          }}
          onSubmit={() => submitTest({ force: true })}
        />
      )}
    </div>
  );

  function renderQuestionWorkspace() {
    return (
      <div className="p-6 md:p-8 flex flex-col flex-grow justify-between min-h-0 select-text font-sans">
        <div>
          <div className="flex items-center justify-between border-b border-border-subtle/50 pb-4 mb-6">
            <div className="flex items-center space-x-3">
              <span className="text-base md:text-lg font-bold font-mono text-text-main">Question {currentIdx + 1}</span>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tita ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' : 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20'}`}>
                {tita ? 'TITA' : 'MCQ'}
              </span>
              <span className="text-[10px] text-text-faint font-mono">[+3 / {tita ? '0' : '-1'}]</span>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={copyQuestionToClipboard} className="p-1.5 border border-border-subtle rounded-md text-text-muted hover:text-text-main bg-bg-card hover:bg-bg-surface transition" title="Copy Question">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleBookmarkToggle} className={`p-1.5 border rounded-md transition ${bookmarked ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-border-subtle text-text-muted hover:text-text-main bg-bg-card hover:bg-bg-surface'}`} title={bookmarked ? 'Remove Bookmark' : 'Save Bookmark'}>
                <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {activeInstruction && <h2 className="text-xs font-normal italic text-text-muted bg-bg-surface border-l-2 border-brand-gold/60 px-4 py-2.5 rounded-r-lg mb-4 leading-relaxed">{activeInstruction}</h2>}
          <QuestionStem question={activeQuestion} />

          {tita ? (
            <div className="mt-4 max-w-sm">
              <input type="text" value={answers[activeQuestion.id] || ''} onChange={(e) => handleTitaInput(e.target.value)} placeholder="Enter TITA response..." className="w-full p-2.5 bg-bg-surface border border-border-subtle rounded-xl font-mono text-sm text-text-main focus:outline-none focus:border-brand-gold mb-3" />
              <div className="bg-bg-surface border border-border-subtle p-3 rounded-xl">
                <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '.', '-'].map((k) => <button key={k} onClick={() => handleTitaKeypad(String(k))} className="h-9 bg-bg-card border border-border-subtle hover:border-brand-gold text-text-main rounded-md active:bg-brand-gold/15 transition font-semibold">{k}</button>)}
                  <button onClick={() => handleTitaKeypad('clear')} className="h-9 bg-bg-card border border-border-subtle hover:border-brand-red text-text-muted hover:text-brand-red rounded-md transition font-semibold">Clear</button>
                  <button onClick={() => handleTitaKeypad('backspace')} className="h-9 col-span-2 bg-bg-card border border-border-subtle hover:border-brand-red text-text-muted hover:text-brand-red rounded-md transition font-semibold">Backspace</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeQuestion.options?.map((opt, idx) => {
                const selected = String(answers[activeQuestion.id]) === String(opt.key);
                const stripSourceKey = shouldStripOptionKeys(activeQuestion.options);
                return (
                  <button key={opt.key} onClick={() => handlePickOption(opt.key)} className={`w-full flex items-start text-left p-3.5 rounded-xl border transition-all duration-150 ${selected ? 'border-brand-gold bg-brand-gold/[0.02] text-text-main' : 'border-border-subtle hover:border-text-faint hover:bg-bg-surface/30 text-text-muted hover:text-text-main'}`}>
                    <span className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center font-mono text-[10px] font-bold mr-3 border transition-all ${selected ? 'bg-brand-gold border-brand-gold text-bg-base' : 'border-border-subtle bg-bg-card text-text-faint'}`}>
                      {optionDisplayKey(opt, idx)}
                    </span>
                    <span className="text-xs md:text-sm font-sans leading-relaxed select-text mt-0.5"><OptionContent option={opt} stripSourceKey={stripSourceKey} /></span>
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

function SubmitReviewModal({
  questions,
  answers,
  marked,
  answeredCount,
  markedCount,
  unansweredCount,
  onClose,
  onJump,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-2xl">
        <h3 className="font-serif text-2xl font-bold text-text-main">Review & Submit</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          Check your answer state before submitting. Click any question to return to it.
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
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onJump(idx)}
                  className={`h-8 rounded-md border text-xs font-mono font-semibold transition hover:border-brand-gold ${cls}`}
                >
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-xs font-bold text-text-muted transition hover:border-text-muted hover:text-text-main"
          >
            Back to questions
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-brand-gold px-5 py-2 text-xs font-bold text-bg-base transition hover:bg-brand-gold-hover"
          >
            Submit now
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
