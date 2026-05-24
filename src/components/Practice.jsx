import { useMemo, useState } from 'react';
import { Bookmark, ChevronLeft, Play, Search } from 'lucide-react';
import { Storage } from '../services/storage';
import { questionType } from '../services/questionUtils';

const VA_INFO = {
  para_jumble: {
    name: 'Para Jumbles',
    desc: 'TITA and older MCQ para-jumble formats, preserving statement order.',
    types: ['va_para_jumble_tita', 'va_para_jumble_mcq'],
  },
  summary: {
    name: 'Para Summary',
    desc: "Choose the option that captures the author's point most accurately.",
    types: ['va_summary_mcq', 'va_summary_tita'],
  },
  odd_one_out: {
    name: 'Odd Sentence Out',
    desc: 'Identify the sentence that breaks paragraph coherence.',
    types: ['va_odd_one_out_tita'],
  },
  para_completion: {
    name: 'Sentence Placement / Completion',
    desc: 'Place or complete a sentence in the most logical location.',
    types: ['va_sentence_placement_mcq', 'va_para_completion_mcq'],
  },
};

function sourceName(id = '') {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bVarc\b/g, 'VARC')
    .replace(/\bRc\b/g, 'RC')
    .replace(/\bCl\b/g, 'CL')
    .replace(/\bIms\b/g, 'IMS');
}

function formatStat(value, suffix = '') {
  return value ? `${value}${suffix}` : '--';
}

export default function Practice({ db, onStartPractice }) {
  const [activeTab, setActiveTab] = useState('rc');
  const [searchTerm, setSearchTerm] = useState('');
  const [untimed, setUntimed] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const loaded = db?.varc;

  const history = useMemo(() => Storage.getHistory(), []);
  const questionAttempts = useMemo(() => {
    const map = new Map();
    history.forEach((attempt) => {
      Object.entries(attempt.questionStats || {}).forEach(([qid, stats]) => {
        const entry = map.get(qid) || { timeSec: 0, changes: 0, seen: 0 };
        entry.timeSec += stats.timeSec || 0;
        entry.changes += stats.changes || 0;
        entry.seen += 1;
        map.set(qid, entry);
      });
    });
    return map;
  }, [history]);

  const vaCounts = Object.fromEntries(Object.entries(VA_INFO).map(([key, info]) => [
    key,
    loaded ? db.varc.questions.filter((q) => info.types.includes(questionType(q))).length : 0,
  ]));

  const sourceGroups = useMemo(() => {
    if (!loaded) return [];
    const groups = new Map();
    db.varc.passages.forEach((p) => {
      const key = p.bank_id || p.source_family || 'unknown_source';
      if (!groups.has(key)) groups.set(key, { id: key, name: sourceName(key), passages: [], questionCount: 0, timeSec: 0, changes: 0, seen: 0 });
      const g = groups.get(key);
      g.passages.push(p);
      g.questionCount += p.question_ids?.length || 0;
      (p.question_ids || []).forEach((qid) => {
        const stat = questionAttempts.get(qid);
        if (!stat) return;
        g.timeSec += stat.timeSec;
        g.changes += stat.changes;
        g.seen += stat.seen;
      });
    });
    return [...groups.values()].sort((a, b) => b.passages.length - a.passages.length);
  }, [db, loaded, questionAttempts]);

  const activeGroup = sourceGroups.find((g) => g.id === selectedSource);
  const passages = activeGroup ? activeGroup.passages.filter((p) => {
    const haystack = `${p.id} ${p.source_label || ''} ${p.passage || ''}`.toLowerCase();
    const matches = haystack.includes(searchTerm.toLowerCase());
    if (!matches) return false;
    if (!bookmarkedOnly) return true;
    return p.question_ids?.some((qid) => Storage.isBookmarked(qid));
  }) : [];

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn px-6 py-8 pb-16 font-sans">
      <div className="mb-6 flex flex-col gap-4 border-b border-border-subtle pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-xs font-semibold font-mono uppercase tracking-wider text-brand-gold">Custom drill area</span>
          <h2 className="mt-1 font-serif text-3xl font-bold tracking-tight text-text-main">Practice by Type</h2>
          <p className="mt-2 text-sm text-text-muted">RC practice is grouped by source. VA practice launches one 10-15 question set with a 15 minute timer.</p>
        </div>
        <label className="flex cursor-pointer select-none items-center space-x-2.5 self-start rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 transition hover:border-text-faint md:self-auto">
          <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} className="h-3.5 w-3.5 cursor-pointer accent-brand-gold" />
          <span className="text-xs font-semibold font-mono text-text-muted">Untimed Practice Mode</span>
        </label>
      </div>

      {!loaded ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface py-20 text-center text-xs font-mono text-text-muted">Loading question bank databases...</div>
      ) : (
        <div>
          <div className="mb-6 flex items-center space-x-3 border-b border-border-subtle pb-3">
            {[
              ['rc', 'Reading Comprehension'],
              ['va', 'Verbal Ability'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => { setActiveTab(key); setSelectedSource(null); }} className={`pb-1 text-xs font-bold font-mono uppercase tracking-wider transition ${activeTab === key ? 'border-b-2 border-brand-gold text-brand-gold' : 'text-text-muted hover:text-text-main'}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'rc' && !activeGroup && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {sourceGroups.map((group) => {
                const avgSec = group.seen ? Math.round(group.timeSec / group.seen) : 0;
                const avgChanges = group.seen ? (group.changes / group.seen).toFixed(1) : '';
                const note = !group.seen ? 'No local attempt data yet.' : avgSec > 210 ? 'Slow-average source; use for endurance.' : Number(avgChanges) > 1 ? 'High-change source; review option traps.' : 'Stable local performance so far.';
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => setSelectedSource(group.id)}
                    className="rounded-xl border border-border-subtle bg-bg-surface p-5 text-left transition hover:border-brand-gold/30 hover:bg-bg-card/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-lg font-bold text-text-main">{group.name}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-text-muted">{note}</p>
                      </div>
                      <span className="rounded bg-brand-gold/10 px-2 py-1 text-[10px] font-semibold font-mono uppercase text-brand-gold">{group.passages.length} RCs</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border-subtle/50 pt-4 text-[10px] font-mono text-text-faint">
                      <div><span className="block text-text-muted">{group.questionCount}</span>questions</div>
                      <div><span className="block text-text-muted">{formatStat(avgSec, 's')}</span>avg time</div>
                      <div><span className="block text-text-muted">{avgChanges || '--'}</span>avg changes</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'rc' && activeGroup && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button onClick={() => setSelectedSource(null)} className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs font-semibold font-mono text-text-muted hover:text-text-main">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Sources
                </button>
                <div className="relative flex-grow">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={`Search ${activeGroup.name} passages...`} className="w-full rounded-xl border border-border-subtle bg-bg-surface py-2.5 pl-10 pr-4 text-xs font-mono text-text-main transition focus:border-brand-gold focus:outline-none" />
                </div>
                <button onClick={() => setBookmarkedOnly(!bookmarkedOnly)} className={`rounded-xl border px-4 py-2.5 text-xs font-semibold font-mono transition ${bookmarkedOnly ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-border-subtle bg-bg-surface text-text-muted hover:border-text-muted'}`}>
                  <Bookmark className="mr-1 inline h-3.5 w-3.5" />
                  Bookmarked
                </button>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint">Showing {passages.length} of {activeGroup.passages.length} passages in {activeGroup.name}</div>
              <div className="space-y-3">
                {passages.map((p) => (
                  <div key={p.id} className="flex flex-col justify-between gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 transition hover:border-brand-gold/25 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-base font-bold tracking-tight text-text-main">{p.source_label || p.id}</h3>
                      <p className="mt-1 text-xs font-mono text-text-faint">{p.bank_id}</p>
                      <p className="mt-2.5 pr-4 font-serif text-xs italic leading-relaxed text-text-muted">"{(p.passage || '').slice(0, 150).replace(/\s+/g, ' ')}..."</p>
                    </div>
                    <div className="flex items-center space-x-3 self-end md:self-auto">
                      <span className="rounded-md border border-border-subtle bg-bg-card px-2.5 py-1.5 text-[10px] font-mono text-text-faint">{p.question_ids?.length || 0} Questions</span>
                      <button onClick={() => onStartPractice(`rc_${p.id}`, untimed)} className="flex items-center space-x-1 rounded-lg bg-brand-gold px-4 py-2 text-xs font-bold font-mono tracking-wide text-bg-base transition hover:bg-brand-gold-hover">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Practice</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'va' && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {Object.entries(VA_INFO).map(([key, info]) => (
                <div key={key} className="flex flex-col justify-between gap-5 rounded-xl border border-border-subtle bg-bg-surface p-5 transition hover:border-brand-gold/25">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-serif text-base font-bold text-text-main">{info.name}</h3>
                      <span className="rounded bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold font-mono uppercase text-brand-gold">{vaCounts[key]} Qs</span>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-text-muted">{info.desc}</p>
                    <p className="mt-3 text-[10px] font-mono text-text-faint">Set size: 10-15 questions | Timer: 15 minutes</p>
                  </div>
                  <div className="flex justify-end border-t border-border-subtle/50 pt-4">
                    <button onClick={() => onStartPractice(key, untimed)} disabled={vaCounts[key] === 0} className="flex items-center space-x-1 rounded-lg bg-brand-gold px-4 py-2 text-xs font-bold font-mono tracking-wider text-bg-base transition hover:bg-brand-gold-hover disabled:pointer-events-none disabled:opacity-30">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Practice Set</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
