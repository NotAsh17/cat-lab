import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Award,} from 'lucide-react';

export default function Analytics({ history }) {
  if (history.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-6 animate-fadeIn font-sans select-none">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">
            Performance Summary
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-text-main font-serif mt-1">
            Learning Analytics
          </h2>
        </div>
        <div className="text-center py-24 bg-bg-surface border border-border-subtle rounded-2xl">
          <BarChart3 className="w-10 h-10 text-text-faint mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-text-main font-mono">No Performance Logs</h4>
          <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-sm mx-auto">
            Take a timed mock or complete a daily practice set first. Your accuracy trends and pacing scores will compile here automatically.
          </p>
        </div>
      </div>
    );
  }

  // Segment by section
  const varcAttempts = history.filter(h => h.testId.includes('varc') || h.testType === 'varc_sectional');
  const qaAttempts = history.filter(h => h.testId.includes('qa') || h.testType === 'qa_sectional');

  const getSectionStats = (attempts) => {
    let attempted = 0;
    let correct = 0;
    let scoreTotal = 0;
    let maxTotal = 0;
    let timeTotal = 0;

    attempts.forEach(a => {
      attempted += (a.correct + a.wrong);
      correct += a.correct;
      scoreTotal += a.score;
      maxTotal += a.max;
      timeTotal += a.timeUsed;
    });

    return {
      attempted,
      correct,
      acc: attempted ? Math.round((correct / attempted) * 100) : 0,
      scoreTotal,
      maxTotal,
      timeTotal,
      avgPace: attempted ? Math.round(timeTotal / attempted) : 0
    };
  };

  const varcStats = getSectionStats(varcAttempts);
  const qaStats = getSectionStats(qaAttempts);

  // Total correct vs wrong in all history
  const totalCorrect = history.reduce((sum, h) => sum + h.correct, 0);
  const totalWrong = history.reduce((sum, h) => sum + h.wrong, 0);  const totalQuestionsAnswered = totalCorrect + totalWrong;
  const overallAcc = totalQuestionsAnswered ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fadeIn font-sans pb-16">
      {/* Header */}
      <div className="mb-8 border-b border-border-subtle pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">
          Performance Analytics
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-text-main font-serif mt-1">
          Detailed Learning Analytics
        </h2>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Drill down into your sectional mock scores, speed statistics, and accuracy by exam area.
        </p>
      </div>

      {/* Main stats highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-text-faint flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-brand-gold mr-1" />
            <span>Overall Accuracy</span>
          </span>
          <div className="text-3xl font-bold font-mono text-brand-gold mt-2">
            {overallAcc}%
          </div>
          <span className="text-[10px] text-text-faint font-mono block mt-1">
            Across {totalQuestionsAnswered} responses
          </span>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-text-faint flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-text-muted mr-1" />
            <span>Average Speed</span>
          </span>
          <div className="text-3xl font-bold font-mono text-text-main mt-2">
            {totalQuestionsAnswered ? Math.round(history.reduce((sum, h) => sum + h.timeUsed, 0) / totalQuestionsAnswered) : 0}s
          </div>
          <span className="text-[10px] text-text-faint font-mono block mt-1">
            Time per question response
          </span>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-text-faint flex items-center space-x-1">
            <Award className="w-3.5 h-3.5 text-brand-green mr-1" />
            <span>Test Completion Rate</span>
          </span>
          <div className="text-3xl font-bold font-mono text-brand-green mt-2">
            100%
          </div>
          <span className="text-[10px] text-text-faint font-mono block mt-1">
            {history.length} of {history.length} mocks submitted
          </span>
        </div>
      </div>

      {/* Accuracy Section Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* VARC Stats card */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
          <h3 className="font-serif font-bold text-base text-text-main mb-4 border-b border-border-subtle pb-2">
            VARC Performance
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5 text-text-muted">
                <span>Accuracy</span>
                <span className="font-bold text-brand-gold">{varcStats.acc}%</span>
              </div>
              <div className="w-full bg-bg-card h-2 rounded-full overflow-hidden border border-border-subtle">
                <div 
                  className="bg-brand-gold h-full rounded-full transition-all duration-500" 
                  style={{ width: `${varcStats.acc}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="bg-bg-card p-3 rounded-lg border border-border-subtle">
                <span className="text-[10px] text-text-faint block uppercase">Mocks Run</span>
                <span className="font-bold text-text-main mt-0.5 block">{varcAttempts.length}</span>
              </div>
              <div className="bg-bg-card p-3 rounded-lg border border-border-subtle">
                <span className="text-[10px] text-text-faint block uppercase">Correct Ans</span>
                <span className="font-bold text-brand-green mt-0.5 block">{varcStats.correct}</span>
              </div>
            </div>
          </div>
        </div>

        {/* QA Stats card */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
          <h3 className="font-serif font-bold text-base text-text-main mb-4 border-b border-border-subtle pb-2">
            Quant Performance
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5 text-text-muted">
                <span>Accuracy</span>
                <span className="font-bold text-brand-green">{qaStats.acc}%</span>
              </div>
              <div className="w-full bg-bg-card h-2 rounded-full overflow-hidden border border-border-subtle">
                <div 
                  className="bg-brand-green h-full rounded-full transition-all duration-500" 
                  style={{ width: `${qaStats.acc}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="bg-bg-card p-3 rounded-lg border border-border-subtle">
                <span className="text-[10px] text-text-faint block uppercase">Mocks Run</span>
                <span className="font-bold text-text-main mt-0.5 block">{qaAttempts.length}</span>
              </div>
              <div className="bg-bg-card p-3 rounded-lg border border-border-subtle">
                <span className="text-[10px] text-text-faint block uppercase">Correct Ans</span>
                <span className="font-bold text-brand-green mt-0.5 block">{qaStats.correct}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
        <h3 className="font-serif font-bold text-base text-text-main mb-4">
          All Logged Test Attempts
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left font-mono">
            <thead>
              <tr className="border-b border-border-subtle text-text-faint uppercase font-bold text-[10px]">
                <th className="py-2">Mock Test ID</th>
                <th className="py-2">Score</th>
                <th className="py-2">Accuracy</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 text-text-main">
              {history.map((h, idx) => {
                const hAcc = (h.correct + h.wrong) ? Math.round((h.correct / (h.correct + h.wrong)) * 100) : 0;
                const date = new Date(h.completedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                });
                return (
                  <tr key={idx} className="hover:bg-bg-card/20 transition-all">
                    <td className="py-3 font-semibold">{h.testId}</td>
                    <td className="py-3">{h.score} / {h.max}</td>
                    <td className="py-3">{hAcc}%</td>
                    <td className="py-3">{Math.floor(h.timeUsed / 60)}m {h.timeUsed % 60}s</td>
                    <td className="py-3 text-text-faint">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

