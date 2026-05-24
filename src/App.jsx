import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Storage } from './services/storage';
import { generatePaper, weeklySeeds } from './services/paperGenerator';
import { answerOutcome, isQaQuestion } from './services/questionUtils';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Dailies from './components/Dailies';
import TestRunner from './components/TestRunner';
import Results from './components/Results';
import Bookmarks from './components/Bookmarks';
import Analytics from './components/Analytics';
import Practice from './components/Practice';
import ProfileSync from './components/ProfileSync';
import Mocks from './components/Mocks';
import FullMockRunner from './components/FullMockRunner';
import { CloudSync } from './services/cloudSync';

function rowTime(row, key = 'completedAt') {
  return new Date(row?.[key] || row?.completed_at || row?.bookmarkedAt || row?.bookmarked_at || 0).getTime() || 0;
}

function mergeByIdPreferNewest(localRows = [], cloudRows = [], dateKey = 'completedAt') {
  const map = new Map();
  [...localRows, ...cloudRows].forEach((row) => {
    if (!row?.id) return;
    const previous = map.get(row.id);
    if (!previous || rowTime(row, dateKey) >= rowTime(previous, dateKey)) map.set(row.id, row);
  });
  return Array.from(map.values());
}

export default function App() {
  const [currentView, setView] = useState('dashboard');
  const [theme, setTheme] = useState(Storage.getTheme());
  const [streak, setStreak] = useState(Storage.getStreak());
  const [profile, setProfile] = useState(Storage.getActiveProfile());
  const [db, setDb] = useState(null);
  const [dbError, setDbError] = useState('');
  const [activeTestConfig, setActiveTestConfig] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [stats, setStats] = useState({ attempted: 0, correct: 0, timeMin: 0 });
  const [history, setHistory] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ state: 'local', label: 'Local only' });
  const syncBusyRef = useRef(false);
  const initialSyncStartedRef = useRef(false);

  useEffect(() => {
    Storage.setSyncAdapter(CloudSync);
    Storage.setSyncStatusListener(setSyncStatus);
    return () => Storage.setSyncStatusListener(null);
  }, []);

  useEffect(() => {
    Storage.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}questions_db.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Database file not found (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const mockQuestions = (data?.mocks?.full || []).reduce((sum, mock) => sum + (mock.questionCount || 0), 0);
        window.__CAT_BANK_SIZE__ = (data?.varc?.questions?.length || 0) + (data?.qa?.questions?.length || 0) + mockQuestions;
        Storage.setBankVersion(data.bank_version || data.manifest?.bank_version || 'unknown');
        setDb(data);
        setDbError('');
        updateStatsAndHistory();
      })
      .catch((err) => {
        console.error('Error loading CAT database:', err);
        setDbError(err.message);
      });
    updateStatsAndHistory();
  }, []);

  function updateStatsAndHistory() {
    const hist = Storage.getHistory();
    setHistory(hist);
    let attempted = 0;
    let correct = 0;
    let timeSec = 0;
    hist.forEach((h) => {
      attempted += (h.correct || 0) + (h.wrong || 0);
      correct += h.correct || 0;
      timeSec += h.timeUsed || 0;
    });
    const totalQuestions = (window.__CAT_BANK_SIZE__ || 0);
    setStats({ attempted, correct, timeMin: Math.round(timeSec / 60), totalQuestions });
    setStreak(Storage.getStreak());
  }

  const syncAccountState = useCallback(async (reason = 'auto') => {
    if (!CloudSync.isConfigured || !db || syncBusyRef.current) return;
    syncBusyRef.current = true;
    setSyncStatus({ state: 'syncing', label: reason === 'signin' ? 'Signing in' : 'Syncing' });
    try {
      const session = await CloudSync.getSession();
      if (!session?.user) {
        setSyncStatus({ state: 'local', label: 'Local only' });
        return;
      }

      await CloudSync.ensureProfile(profile || session.user.email || 'CAT User');
      const [settings, cloudBookmarks, cloudAttempts, cloudDays] = await Promise.all([
        CloudSync.loadSettings(),
        CloudSync.loadBookmarks(),
        CloudSync.loadAttempts(),
        CloudSync.loadCompletedDays(),
      ]);

      if (settings?.theme && settings.theme !== theme) setTheme(settings.theme);
      if (settings?.active_local_profile && settings.active_local_profile !== profile) {
        setProfile(settings.active_local_profile);
        Storage.setActiveProfile(settings.active_local_profile);
      }

      const mergedBookmarks = mergeByIdPreferNewest(Storage.getBookmarks(), cloudBookmarks, 'bookmarkedAt');
      const mergedAttempts = mergeByIdPreferNewest(Storage.getHistory(), cloudAttempts, 'completedAt')
        .sort((a, b) => rowTime(b, 'completedAt') - rowTime(a, 'completedAt'));

      Storage.setBookmarks(mergedBookmarks);
      Storage.setHistory(mergedAttempts);
      Storage.applyCompletedDayRows([...Storage.getCompletedDayRows(), ...(cloudDays || [])]);

      const bankVersion = Storage.getBankVersion();
      for (const bookmark of mergedBookmarks) {
        await CloudSync.saveBookmark(bookmark, bankVersion);
      }
      for (const attempt of mergedAttempts) {
        await CloudSync.saveAttempt(attempt, bankVersion);
      }
      for (const day of Storage.getCompletedDayRows()) {
        await CloudSync.saveCompletedDay(day);
      }
      await CloudSync.updateSettings({ theme: settings?.theme || theme, activeLocalProfile: settings?.active_local_profile || profile, extra: { displayName: profile } });

      Storage.setLastSync();
      updateStatsAndHistory();
      setSyncStatus({ state: 'synced', label: 'Synced' });
    } catch (error) {
      console.warn('[Supabase Sync] account sync failed', error);
      setSyncStatus({ state: 'error', label: 'Sync failed', detail: error?.message || String(error) });
    } finally {
      syncBusyRef.current = false;
    }
  }, [db, profile, theme]);

  useEffect(() => {
    if (!db || !CloudSync.isConfigured) return undefined;
    if (!initialSyncStartedRef.current) {
      initialSyncStartedRef.current = true;
      syncAccountState('startup');
    }
    const sub = CloudSync.onAuthStateChange((session) => {
      if (session?.user) syncAccountState('signin');
      else setSyncStatus({ state: 'local', label: 'Local only' });
    });
    return () => sub?.unsubscribe?.();
  }, [db, syncAccountState]);

  const startTestRunner = (type, id, isUntimed = false, customQuestions = null, paper = null) => {
    setActiveTestConfig({ testType: type, testId: id, untimed: isUntimed, customQuestions, paper });
    if (type === 'qa_sectional') setView('test_runner_qa');
    else if (type === 'varc_sectional') setView('test_runner_varc');
    else if (type === 'full_mock') setView('test_runner_mock');
    else if (type === 'practice' || type === 'bookmarks') setView('test_runner_practice');
    else setView('test_runner_daily');
  };

  const handleFinishTest = (attemptResult) => {
    if (attemptResult.testType === 'daily_practice' && attemptResult.dailySectionId) {
      Storage.setDailyDone(attemptResult.dailySectionId);
    }
    Storage.saveAttempt(attemptResult);
    setActiveAttempt(attemptResult);
    updateStatsAndHistory();
    setView('results');
  };

  const handleRetake = () => {
    if (!activeTestConfig) return;
    if (activeTestConfig.testType === 'qa_sectional') setView('test_runner_qa');
    else if (activeTestConfig.testType === 'varc_sectional') setView('test_runner_varc');
    else if (activeTestConfig.testType === 'full_mock') setView('test_runner_mock');
    else if (activeTestConfig.testType === 'practice' || activeTestConfig.testType === 'bookmarks') setView('test_runner_practice');
    else setView('test_runner_daily');
  };

  const handleOpenAttempt = (attempt) => {
    setActiveAttempt(attempt);
    setView('results');
  };

  const collectQaWrongQuestions = () => {
    const seen = new Set();
    const wrong = [];
    history.forEach((attempt) => {
      (attempt.questions || []).forEach((q) => {
        if (!isQaQuestion(q) || seen.has(q.id)) return;
        if (answerOutcome(q, attempt.answers?.[q.id]) === 'wrong') {
          seen.add(q.id);
          wrong.push(q);
        }
      });
    });
    return wrong;
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    Storage.setTheme(nextTheme);
  };

  const handleProfileChange = (newProfile) => {
    setProfile(newProfile);
    Storage.setActiveProfile(newProfile);
    updateStatsAndHistory();
  };

  const renderSectionalSelector = (type, title) => {
    if (!db) {
      return (
        <div className="max-w-4xl mx-auto py-16 px-6 font-mono text-xs text-text-muted">
          {dbError ? `Question bank failed to load: ${dbError}` : 'Loading question bank...'}
        </div>
      );
    }
    const bankVersion = db.bank_version || db.manifest?.bank_version || 'v1';
    const seeds = weeklySeeds(bankVersion);
    const isVarc = type === 'varc_sectional';
    const cards = [];

    if (isVarc) {
      const paper = generatePaper({ db, blueprintId: 'varc_weekly_sectional', seed: seeds.varc, shared: true, bankVersion });
      cards.push({
        id: paper.id,
        title: "This Week's VARC Sectional",
        eyebrow: seeds.weekKey,
        desc: 'Shared CAT-style VARC paper: whole RC passages plus a mixed VA set.',
        paper,
        timedOnly: true,
      });
    } else {
      const weekly = generatePaper({ db, blueprintId: 'qa_weekly_sectional', seed: seeds.qa, shared: true, bankVersion });
      const exclude = new Set(weekly.questionIds);
      const qaWrongQuestions = collectQaWrongQuestions();
      cards.push({
        id: weekly.id,
        title: "This Week's QA Sectional",
        eyebrow: seeds.weekKey,
        desc: 'Shared weekly Quant paper from one complete source sectional/test.',
        paper: weekly,
        timedOnly: true,
      });
      for (let i = 1; i <= 3; i += 1) {
        const paper = generatePaper({
          db,
          blueprintId: 'qa_practice_sectional',
          seed: seeds.qaPractice(i),
          shared: true,
          bankVersion,
          excludeQuestionIds: exclude,
          practiceIndex: i - 1,
        });
        paper.questionIds.forEach((qid) => exclude.add(qid));
        cards.push({
          id: paper.id,
          title: `QA Practice Sectional ${i}`,
          eyebrow: seeds.weekKey,
          desc: 'Stable shared practice paper for this week; choose timed or untimed.',
          paper,
          timedOnly: false,
        });
      }
      if (qaWrongQuestions.length) {
        cards.push({
          id: 'qa-wrong-answer-drill',
          title: 'QA Wrong Answers',
          eyebrow: 'LOCAL REVIEW',
          desc: 'Personal retry set from incorrect Quant answers. Works like bookmarked-question tests.',
          paper: null,
          customQuestions: qaWrongQuestions,
          timedOnly: false,
        });
      }
    }

    return (
      <div className="max-w-4xl mx-auto py-8 px-6 animate-fadeIn font-sans">
        <div className="mb-8 border-b border-border-subtle pb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">
            Shared weekly sectionals
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-text-main font-serif mt-1">{title}</h2>
          <p className="text-sm text-text-muted mt-2 leading-relaxed">
            Shared papers are deterministic. You and your friend get the same paper for the week.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {cards.map((card) => {
            const paper = card.paper;
            const questionCount = paper?.questions?.length || card.customQuestions?.length || 0;
            const completed = paper ? history.some((h) => h.paperId === paper.id || h.testId === `${type}-${paper.id}`) : false;
            const sourceMix = paper ? Object.entries(paper.sourceMix || {}).map(([k, v]) => `${k}: ${v}`).join(' | ') : 'Personal wrong-answer set';
            return (
              <div
                key={card.id}
                className={`bg-bg-surface border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                  completed ? 'border-brand-gold/30 bg-brand-gold/[0.01]' : 'border-border-subtle hover:border-brand-gold/25'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[10px] text-brand-gold font-mono font-semibold uppercase tracking-wider">{card.eyebrow}</div>
                  <h3 className="font-serif font-bold text-lg text-text-main mt-1">{card.title}</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{card.desc}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-text-faint font-mono font-semibold">
                    <span>40 MINUTES</span>
                    <span>{questionCount} QUESTIONS</span>
                    <span>{paper?.id || card.id}</span>
                  </div>
                  {sourceMix && <div className="text-[10px] text-text-faint font-mono mt-2 truncate">{sourceMix}</div>}
                  {paper?.warnings?.length > 0 && <div className="text-[10px] text-brand-red font-mono mt-2">{paper.warnings.join(', ')}</div>}
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <button
                    onClick={() => paper ? startTestRunner(type, paper.id, false, null, paper) : startTestRunner('practice', card.id, false, card.customQuestions)}
                    className="px-5 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-bg-base rounded-xl text-xs font-bold font-mono tracking-wider flex items-center space-x-1.5 shadow-[0_4px_12px_rgba(201,150,74,0.15)] transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Timed</span>
                  </button>
                  {!card.timedOnly && (
                    <button
                      onClick={() => paper ? startTestRunner(type, paper.id, true, null, paper) : startTestRunner('practice', card.id, true, card.customQuestions)}
                      className="px-4 py-2.5 border border-border-subtle hover:border-text-muted text-text-muted hover:text-text-main rounded-xl text-xs font-bold font-mono transition"
                    >
                      Untimed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMainView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setView={setView} stats={stats} history={history} onOpenAttempt={handleOpenAttempt} />;
      case 'dailies':
        return <Dailies db={db} onStartPractice={(paper, isUntimed) => startTestRunner('daily_practice', paper.id, isUntimed, null, paper)} />;
      case 'practice':
        return <Practice db={db} onStartPractice={(typeId, isUntimed) => startTestRunner('practice', typeId, isUntimed)} />;
      case 'varc_sectional':
        return renderSectionalSelector('varc_sectional', 'VARC Sectional');
      case 'qa_sectional':
        return renderSectionalSelector('qa_sectional', 'Quantitative Aptitude');
      case 'mocks':
        return <Mocks db={db} history={history} onStartMock={(mock) => startTestRunner('full_mock', mock.id, false, null, mock)} />;
      case 'bookmarks':
        return <Bookmarks onStartPractice={(testId, isUntimed, customQuestions) => startTestRunner('bookmarks', testId, isUntimed, customQuestions)} />;
      case 'analytics':
        return <Analytics stats={stats} history={history} />;
      case 'profile_sync':
        return <ProfileSync theme={theme} setTheme={setTheme} profile={profile} setProfile={handleProfileChange} onDataChanged={updateStatsAndHistory} />;
      case 'test_runner_varc':
      case 'test_runner_qa':
      case 'test_runner_daily':
      case 'test_runner_practice':
        return (
          <TestRunner
            db={db}
            testType={activeTestConfig.testType}
            testId={activeTestConfig.testId}
            untimed={activeTestConfig.untimed}
            customQuestions={activeTestConfig.customQuestions}
            paper={activeTestConfig.paper}
            onFinishTest={handleFinishTest}
            onExit={() => setView('dashboard')}
          />
        );
      case 'test_runner_mock':
        return (
          <FullMockRunner
            paper={activeTestConfig.paper}
            onFinishTest={handleFinishTest}
            onExit={() => setView('dashboard')}
          />
        );
      case 'results':
        return <Results attempt={activeAttempt} onRetake={handleRetake} onBackToDashboard={() => setView('dashboard')} />;
      default:
        return <Dashboard setView={setView} stats={stats} history={history} onOpenAttempt={handleOpenAttempt} />;
    }
  };

  const isTestRunnerActive = currentView.startsWith('test_runner');

  return (
    <div className="flex min-h-screen bg-bg-base text-text-main font-sans selection:bg-brand-gold/30">
      {!isTestRunnerActive && (
        <Sidebar
          currentView={currentView}
          setView={setView}
          theme={theme}
          toggleTheme={toggleTheme}
          streak={streak}
          profile={profile}
          setProfile={handleProfileChange}
          syncStatus={syncStatus}
        />
      )}
      <div className="flex-grow min-w-0 overflow-y-auto">{renderMainView()}</div>
    </div>
  );
}
