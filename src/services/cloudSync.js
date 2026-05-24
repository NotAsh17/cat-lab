import { answerOutcome, isQaQuestion } from './questionUtils';
import { isSupabaseConfigured, supabase } from './supabaseClient';

function nowIso() {
  return new Date().toISOString();
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clientOpId(prefix = 'op') {
  const random = crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}:${Date.now()}:${random}`;
}

function compactQuestion(q) {
  if (!q) return null;
  return {
    id: q.id,
    bank_id: q.bank_id,
    section: q.section,
    subsection: q.subsection,
    type: q.type,
    question_type: q.question_type,
    test_id: q.test_id,
    source_label: q.source_label,
    source: q.source,
    passage_id: q.passage_id,
    question_number: q.question_number,
    stem: q.stem,
    stem_text: q.stem_text,
    stem_html: q.stem_html,
    structured: q.structured,
    options: q.options,
    answer: q.answer,
    answer_key: q.answer_key,
    answer_value: q.answer_value,
    display: q.display,
    stem_media: q.stem_media,
    explanation: q.explanation,
    passage: q.passage,
  };
}

function throwIfNotConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}

async function currentUser() {
  throwIfNotConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function ensureSignedInUser() {
  const user = await currentUser();
  if (!user) throw new Error('Sign in before syncing.');
  return user;
}

export const CloudSync = {
  isConfigured: isSupabaseConfigured,

  async getSession() {
    throwIfNotConfigured();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback) {
    if (!isSupabaseConfigured || !supabase) return { unsubscribe() {} };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return data.subscription;
  },

  async signInWithEmail(email) {
    throwIfNotConfigured();
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  },

  async signOut() {
    throwIfNotConfigured();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async ensureProfile(displayName = 'CAT User') {
    const user = await ensureSignedInUser();
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, display_name: displayName || user.email || 'CAT User' }, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (settingsError) throw settingsError;
    return user;
  },

  async updateSettings(settings = {}) {
    const user = await ensureSignedInUser();
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        theme: settings.theme || 'dark',
        active_local_profile: settings.activeLocalProfile || 'User',
        settings: settings.extra || {},
      }, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async loadSettings() {
    const user = await ensureSignedInUser();
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async saveBookmark(bookmark, bankVersion) {
    const user = await ensureSignedInUser();
    const { error } = await supabase.from('bookmarks').upsert({
      user_id: user.id,
      question_id: bookmark.id,
      bank_version: bankVersion,
      section: bookmark.section,
      passage_title: bookmark.passageTitle,
      passage_text: bookmark.passageText,
      question: compactQuestion(bookmark.question),
      client_op_id: clientOpId('bookmark'),
      bookmarked_at: bookmark.bookmarkedAt || nowIso(),
      deleted_at: null,
    }, { onConflict: 'user_id,question_id' });
    if (error) throw error;
  },

  async removeBookmark(questionId) {
    const user = await ensureSignedInUser();
    const { error } = await supabase
      .from('bookmarks')
      .update({ deleted_at: nowIso(), client_op_id: clientOpId('bookmark-delete') })
      .eq('user_id', user.id)
      .eq('question_id', questionId);
    if (error) throw error;
  },

  async loadBookmarks() {
    const user = await ensureSignedInUser();
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('bookmarked_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.question_id,
      section: row.section,
      question: row.question,
      passageTitle: row.passage_title,
      passageText: row.passage_text,
      bookmarkedAt: row.bookmarked_at,
    }));
  },

  async saveAttempt(attempt, bankVersion) {
    const user = await ensureSignedInUser();
    const attemptId = attempt.id || clientOpId('attempt');
    const completedAt = attempt.completedAt || nowIso();
    const { error: attemptError } = await supabase.from('attempts').upsert({
      id: attemptId,
      user_id: user.id,
      test_id: attempt.testId,
      test_type: attempt.testType,
      paper_id: attempt.paperId,
      seed: attempt.seed,
      blueprint_id: attempt.blueprintId,
      bank_version: bankVersion,
      score: attempt.score || 0,
      max_score: attempt.max || 0,
      correct: attempt.correct || 0,
      wrong: attempt.wrong || 0,
      skipped: attempt.skipped || 0,
      time_used: attempt.timeUsed || 0,
      source_mix: attempt.sourceMix || {},
      type_mix: attempt.typeMix || {},
      client_op_id: clientOpId('attempt'),
      completed_at: completedAt,
    }, { onConflict: 'user_id,id' });
    if (attemptError) throw attemptError;

    const answers = (attempt.questions || []).map((q, idx) => {
      const answer = attempt.answers?.[q.id];
      const stats = attempt.questionStats?.[q.id] || {};
      return {
        attempt_id: attemptId,
        user_id: user.id,
        question_id: q.id,
        question_index: idx,
        section: isQaQuestion(q) ? 'qa' : 'varc',
        answer: answer === undefined ? null : String(answer),
        outcome: answerOutcome(q, answer),
        marked: (attempt.marked || []).includes(q.id),
        time_sec: stats.timeSec || 0,
        changes: stats.changes || 0,
        question: compactQuestion(q),
      };
    });

    if (answers.length) {
      const { error: answerError } = await supabase
        .from('attempt_answers')
        .upsert(answers, { onConflict: 'user_id,attempt_id,question_id' });
      if (answerError) throw answerError;
    }
  },

  async loadAttempts() {
    const user = await ensureSignedInUser();
    const { data: attempts, error: attemptError } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });
    if (attemptError) throw attemptError;
    if (!attempts?.length) return [];

    const ids = attempts.map((a) => a.id);
    const { data: answers, error: answersError } = await supabase
      .from('attempt_answers')
      .select('*')
      .eq('user_id', user.id)
      .in('attempt_id', ids)
      .order('question_index', { ascending: true });
    if (answersError) throw answersError;

    const byAttempt = new Map();
    (answers || []).forEach((row) => {
      if (!byAttempt.has(row.attempt_id)) byAttempt.set(row.attempt_id, []);
      byAttempt.get(row.attempt_id).push(row);
    });

    return attempts.map((row) => {
      const rows = byAttempt.get(row.id) || [];
      const answerMap = {};
      const questionStats = {};
      const marked = [];
      rows.forEach((item) => {
        if (item.answer !== null) answerMap[item.question_id] = item.answer;
        questionStats[item.question_id] = { timeSec: item.time_sec || 0, changes: item.changes || 0 };
        if (item.marked) marked.push(item.question_id);
      });
      return {
        id: row.id,
        testId: row.test_id,
        testType: row.test_type,
        paperId: row.paper_id,
        seed: row.seed,
        blueprintId: row.blueprint_id,
        score: row.score,
        max: row.max_score,
        correct: row.correct,
        wrong: row.wrong,
        skipped: row.skipped,
        timeUsed: row.time_used,
        completedAt: row.completed_at,
        sourceMix: row.source_mix,
        typeMix: row.type_mix,
        answers: answerMap,
        marked,
        questionStats,
        questions: rows.map((item) => item.question),
      };
    });
  },

  async saveCompletedDay(sectionId) {
    const user = await ensureSignedInUser();
    const { error } = await supabase.from('completed_days').upsert({
      user_id: user.id,
      day_key: localDateKey(),
      section_id: sectionId,
      completed_at: nowIso(),
    }, { onConflict: 'user_id,day_key,section_id' });
    if (error) throw error;
  },

  async clearCloud(scope = 'all') {
    const user = await ensureSignedInUser();
    const tasks = [];
    if (scope === 'all' || scope === 'history') {
      tasks.push(supabase.from('attempt_answers').delete().eq('user_id', user.id));
      tasks.push(supabase.from('attempts').delete().eq('user_id', user.id));
    }
    if (scope === 'all' || scope === 'bookmarks') {
      tasks.push(supabase.from('bookmarks').delete().eq('user_id', user.id));
    }
    if (scope === 'all' || scope === 'daily') {
      tasks.push(supabase.from('completed_days').delete().eq('user_id', user.id));
    }
    if (scope === 'all' || scope === 'settings') {
      tasks.push(supabase.from('user_settings').delete().eq('user_id', user.id));
    }
    const results = await Promise.all(tasks);
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;
  },
};
