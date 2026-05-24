import { 
  Award, 
  Clock, 
  Compass, 
  ChevronRight, 
  CheckCircle2,} from 'lucide-react';

export default function Dashboard({ setView, stats, history, onOpenAttempt }) {
  const totalQuestions = Math.max(1, stats.totalQuestions || 150);
  const attempted = stats.attempted || 0;
  const correct = stats.correct || 0;
  const acc = attempted ? Math.round((correct / attempted) * 100) : 0;
  const totalMin = stats.timeMin || 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 animate-fadeIn font-sans">
      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">
          CAT 2025 Prep Workspace
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-text-main font-serif mt-1">
          Catalyst Dashboard
        </h2>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Access high-end analytics, timed sectional mocks, and daily practice routines. Take mocks in order to measure progress.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 hover:border-brand-gold/40 transition duration-300">
          <span className="text-xs text-text-muted uppercase tracking-wider font-mono">Attempted</span>
          <div className="text-3xl font-semibold mt-2 font-mono flex items-baseline">
            {attempted}
            <span className="text-sm text-text-faint ml-1">/ {totalQuestions}</span>
          </div>
          <p className="text-xs text-text-faint mt-1 font-mono">
            {Math.round((attempted / totalQuestions) * 100) || 0}% of bank
          </p>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 hover:border-brand-gold/40 transition duration-300">
          <span className="text-xs text-text-muted uppercase tracking-wider font-mono">Accuracy</span>
          <div className="text-3xl font-semibold mt-2 font-mono text-brand-gold">
            {acc}%
          </div>
          <p className="text-xs text-text-faint mt-1 font-mono">
            {correct} correct responses
          </p>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 hover:border-brand-gold/40 transition duration-300">
          <span className="text-xs text-text-muted uppercase tracking-wider font-mono">Time Spent</span>
          <div className="text-3xl font-semibold mt-2 font-mono">
            {totalMin}m
          </div>
          <p className="text-xs text-text-faint mt-1 font-mono">
            {attempted ? Math.round((totalMin * 60) / attempted) : 0}s average per question
          </p>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 hover:border-brand-gold/40 transition duration-300">
          <span className="text-xs text-text-muted uppercase tracking-wider font-mono">Completed</span>
          <div className="text-3xl font-semibold mt-2 font-mono">
            {history.length}
          </div>
          <p className="text-xs text-text-faint mt-1 font-mono">
            sectional attempts logged
          </p>
        </div>
      </div>

      {/* Quick Launch & Dailies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 flex flex-col justify-between hover:border-brand-gold/30 transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400 mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-text-main font-serif">Daily Practice</h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              7-Day rotational calendar. 4 days of 2 reading comprehension passages (RC) each, 3 days of 1 RC + 1 Verbal Ability (VA) set.
            </p>
          </div>
          <button 
            onClick={() => setView('dailies')}
            className="mt-6 w-full py-2 bg-indigo-950/20 border border-indigo-800/40 rounded-lg text-xs font-semibold text-indigo-300 hover:bg-indigo-650 hover:text-white transition flex items-center justify-center space-x-1"
          >
            <span>Enter Dailies</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </button>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 flex flex-col justify-between hover:border-brand-gold/30 transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold mb-4">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-text-main font-serif">VARC Sectionals</h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              Full-length timed VARC tests containing multiple RC passages and verbal ability questions. Mirrors the actual exam.
            </p>
          </div>
          <button 
            onClick={() => setView('varc_sectional')}
            className="mt-6 w-full py-2 bg-brand-gold/10 border border-brand-gold/20 rounded-lg text-xs font-semibold text-brand-gold hover:bg-brand-gold hover:text-bg-base transition flex items-center justify-center space-x-1"
          >
            <span>Take VARC Mock</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition font-bold" />
          </button>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 flex flex-col justify-between hover:border-brand-gold/30 transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-green/10 border border-brand-green/20 flex items-center justify-center text-brand-green mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-text-main font-serif">QA Sectionals</h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              Quantitative Aptitude mock tests. Standard 40 minutes timer with TITA question keypad support.
            </p>
          </div>
          <button 
            onClick={() => setView('qa_sectional')}
            className="mt-6 w-full py-2 bg-brand-green/10 border border-brand-green/20 rounded-lg text-xs font-semibold text-brand-green hover:bg-brand-green hover:text-white transition flex items-center justify-center space-x-1"
          >
            <span>Take QA Mock</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
        <h3 className="text-base font-semibold text-text-main mb-4 font-mono">
          Recent Activity & Logs
        </h3>
        {history.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-xs font-mono">
            No mock tests completed yet. Click a sectional above to start.
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((h, i) => {
              const date = new Date(h.completedAt);
              const formattedDate = date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              const isVarc = h.testId.includes('varc');
              return (
                <button key={h.id || i} type="button" onClick={() => onOpenAttempt?.(h)} className="flex w-full items-center justify-between p-3.5 bg-bg-base border border-border-subtle rounded-lg text-xs hover:border-brand-gold/25 hover:bg-bg-card/40 transition text-left">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className={`w-4 h-4 ${isVarc ? 'text-brand-gold' : 'text-brand-green'}`} />
                    <div>
                      <div className="font-semibold text-text-main font-mono">
                        {isVarc ? 'VARC Sectional' : 'QA Sectional'} (Mock #{h.testId.split('-').pop()})
                      </div>
                      <div className="text-[10px] text-text-faint font-mono mt-0.5">
                        {formattedDate} | Completed
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <span className="font-semibold text-text-main font-mono">{h.score} / {h.max}</span>
                      <span className="text-[10px] text-text-muted block font-mono">score</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-text-main font-mono">
                        {Math.floor(h.timeUsed / 60)}m {h.timeUsed % 60}s
                      </span>
                      <span className="text-[10px] text-text-muted block font-mono">duration</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

