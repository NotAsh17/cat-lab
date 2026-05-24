import { useState } from 'react';
import { Bookmark, BookOpen, Calculator, ChevronDown, ChevronUp, FileText, Play, Trash2 } from 'lucide-react';
import { Storage } from '../services/storage';
import { displayInstruction, isTitaQuestion } from '../services/questionUtils';
import { optionDisplayKey, shouldStripOptionKeys } from '../services/optionRenderUtils';
import { OptionContent, QuestionExplanation, QuestionPreviewText, QuestionStem } from './QuestionDisplay';

export default function Bookmarks({ onStartPractice }) {
  const [bookmarks, setBookmarks] = useState(Storage.getBookmarks());
  const [activeIdx, setActiveIdx] = useState(null);
  const [filterSection, setFilterSection] = useState('all');
  const [untimed, setUntimed] = useState(true);

  const filteredBookmarks = filterSection === 'all' ? bookmarks : bookmarks.filter((b) => b.section === filterSection);

  const handleRemove = (e, qId) => {
    e.stopPropagation();
    if (!window.confirm('Remove this bookmark?')) return;
    Storage.removeBookmark(qId);
    setBookmarks(Storage.getBookmarks());
    setActiveIdx(null);
  };

  const handlePracticeBookmarks = () => {
    if (!filteredBookmarks.length) {
      alert('No bookmarked questions in this filter.');
      return;
    }
    onStartPractice('all', untimed, filteredBookmarks.map((b) => b.question));
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fadeIn font-sans pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold font-mono">Saved Library</span>
          <h2 className="text-3xl font-bold tracking-tight text-text-main font-serif mt-1">Bookmarked Questions</h2>
          <p className="text-sm text-text-muted mt-2 leading-relaxed">Questions saved from runner and review, preserving passage/media display data.</p>
        </div>
        {bookmarks.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="flex items-center space-x-2.5 cursor-pointer bg-bg-surface border border-border-subtle px-3 py-2 rounded-xl select-none">
              <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} className="w-3.5 h-3.5 accent-brand-gold cursor-pointer" />
              <span className="text-xs font-semibold font-mono text-text-muted">Untimed</span>
            </label>
            <button onClick={handlePracticeBookmarks} className="px-4 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-bg-base rounded-xl text-xs font-bold font-mono tracking-wider flex items-center justify-center space-x-1.5 transition">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Take Test ({filteredBookmarks.length})</span>
            </button>
          </div>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <div className="text-center py-20 bg-bg-surface border border-border-subtle rounded-2xl">
          <Bookmark className="w-10 h-10 text-text-faint mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-text-main font-mono">No Bookmarks Saved</h4>
          <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-sm mx-auto">Use the bookmark button in runner or results to save questions.</p>
        </div>
      ) : (
        <div>
          <div className="flex space-x-2 mb-6">
            {['all', 'varc', 'qa'].map((section) => (
              <button key={section} onClick={() => { setFilterSection(section); setActiveIdx(null); }} className={`px-3 py-1.5 border rounded-lg text-xs font-mono font-semibold transition ${filterSection === section ? 'border-brand-gold text-brand-gold bg-brand-gold/10' : 'border-border-subtle text-text-muted hover:text-text-main hover:bg-bg-card'}`}>
                {section.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredBookmarks.map((b, idx) => {
              const q = b.question;
              const open = activeIdx === idx;
              const isVarc = b.section === 'varc';
              const tita = isTitaQuestion(q);
              const date = new Date(b.bookmarkedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              return (
                <div key={b.id} className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden transition-all">
                  <div onClick={() => setActiveIdx(open ? null : idx)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-card/50 select-none text-xs">
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      {isVarc ? <BookOpen className="w-4.5 h-4.5 text-brand-gold flex-shrink-0" /> : <Calculator className="w-4.5 h-4.5 text-brand-green flex-shrink-0" />}
                      <div className="truncate font-semibold text-text-main font-mono">
                        <span className="font-serif italic font-normal text-text-muted select-none"><QuestionPreviewText question={q} /></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      <span className="text-[10px] text-text-faint font-mono font-semibold uppercase tracking-wider px-2 py-0.5 bg-bg-card border border-border-subtle rounded">{tita ? 'TITA' : 'MCQ'}</span>
                      <span className="text-[10px] text-text-faint font-mono">{date}</span>
                      <button onClick={(e) => handleRemove(e, b.id)} className="p-1 text-text-faint hover:text-brand-red transition" title="Delete Bookmark">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {open ? <ChevronUp className="w-4 h-4 text-text-faint" /> : <ChevronDown className="w-4 h-4 text-text-faint" />}
                    </div>
                  </div>

                  {open && (
                    <div className="p-6 bg-bg-base border-t border-border-subtle border-dashed font-sans select-text">
                      {b.passageText && (
                        <div className="mb-6 bg-bg-surface border border-border-subtle rounded-xl p-5 select-text">
                          <div className="flex items-center space-x-1.5 mb-2.5">
                            <BookOpen className="w-4 h-4 text-brand-gold" />
                            <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-brand-gold">{b.passageTitle || 'Associated Reading Passage'}</h4>
                          </div>
                          <div className="text-xs md:text-sm font-serif leading-relaxed text-text-muted max-h-52 overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text pr-2">{b.passageText}</div>
                        </div>
                      )}
                      {displayInstruction(q) && <h2 className="text-xs font-normal italic text-text-muted bg-bg-surface border-l-2 border-brand-gold/60 px-4 py-2.5 rounded-r-lg mb-4">{displayInstruction(q)}</h2>}
                      <QuestionStem question={q} />
                      {tita ? (
                        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 mb-6 text-sm font-mono flex items-center space-x-4">
                          <span className="text-text-muted">Correct Numeric Value:</span>
                          <span className="font-bold text-brand-green">{q.answer_key || q.answer || q.answer_value}</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5 mb-6">
                          {q.options?.map((opt, oIdx) => {
                            const correct = String(q.answer_key || q.answer) === String(opt.key);
                            const stripSourceKey = shouldStripOptionKeys(q.options);
                            return (
                              <div key={opt.key} className={`flex items-start text-left p-3.5 rounded-xl border text-sm ${correct ? 'border-brand-green bg-brand-green/[0.02] text-text-main font-medium' : 'border-border-subtle text-text-muted'}`}>
                                <span className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center font-mono text-[10px] mr-3.5 border ${correct ? 'bg-brand-green border-brand-green text-white font-bold' : 'border-border-subtle bg-bg-card text-text-faint'}`}>{optionDisplayKey(opt, oIdx)}</span>
                                <span className="font-sans leading-relaxed select-text mt-0.5"><OptionContent option={opt} stripSourceKey={stripSourceKey} /></span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.explanation && (
                        <div className="mt-6 border-t border-border-subtle border-dashed pt-4 select-text">
                          <div className="flex items-center space-x-1.5 mb-3">
                            <FileText className="w-3.5 h-3.5 text-brand-gold" />
                            <span className="text-xs uppercase font-mono font-bold tracking-wider text-brand-gold">Solution Guide</span>
                          </div>
                          <div className="text-xs md:text-sm font-sans leading-relaxed text-text-muted bg-bg-surface border border-border-subtle p-5 rounded-xl">
                            <QuestionExplanation question={q} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
