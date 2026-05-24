import { questionSection, questionType, questionTypeGroup, questionTypeLabel, sourceLabel } from './questionUtils';

const KEYS = {
  THEME: 'cat_theme',
  ACCOUNT_SCOPE: 'cat_account_scope',
  USERNAME: 'cat_username',
  PENDING_USERNAME: 'cat_pending_username',
  PROFILE: 'cat_active_profile',
  PROFILES: 'cat_profiles',
  HISTORY: 'cat_history',
  BOOKMARKS: 'cat_bookmarks',
  STREAK: 'cat_streak',
  COMPLETED_DAYS: 'cat_completed_days',
  BANK_VERSION: 'cat_bank_version',
  LAST_SYNC: 'cat_last_sync',
};

const DAILY_DONE_KEY = 'cat_daily_done';
const USER_SCOPED_KEYS = new Set([
  KEYS.USERNAME,
  KEYS.HISTORY,
  KEYS.BOOKMARKS,
  KEYS.STREAK,
  KEYS.COMPLETED_DAYS,
  KEYS.LAST_SYNC,
]);

let syncAdapter = null;
let syncStatusListener = null;
let accountScope = localStorage.getItem(KEYS.ACCOUNT_SCOPE) || 'local';

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function safeScope(scope) {
  return String(scope || 'local').replace(/[^a-zA-Z0-9._:-]/g, '_');
}

function scopedKey(baseKey, scope = accountScope) {
  if (!USER_SCOPED_KEYS.has(baseKey)) return baseKey;
  return `${baseKey}:${safeScope(scope)}`;
}

function dailyDoneKey(scope = accountScope) {
  return `${DAILY_DONE_KEY}:${safeScope(scope)}`;
}

function migrateLegacyKey(baseKey, scope = 'local') {
  const target = scopedKey(baseKey, scope);
  if (localStorage.getItem(target) === null && localStorage.getItem(baseKey) !== null) {
    localStorage.setItem(target, localStorage.getItem(baseKey));
  }
}

function migrateLegacyDaily(scope = 'local') {
  const target = dailyDoneKey(scope);
  if (localStorage.getItem(target) === null && localStorage.getItem(DAILY_DONE_KEY) !== null) {
    localStorage.setItem(target, localStorage.getItem(DAILY_DONE_KEY));
  }
}

function migrateLegacyLocalState() {
  USER_SCOPED_KEYS.forEach((key) => migrateLegacyKey(key, 'local'));
  migrateLegacyDaily('local');
}

function copyScopedLocalState(fromScope, toScope) {
  USER_SCOPED_KEYS.forEach((key) => {
    if (key === KEYS.COMPLETED_DAYS || key === KEYS.STREAK) return;
    const source = scopedKey(key, fromScope);
    const target = scopedKey(key, toScope);
    if (localStorage.getItem(target) === null && localStorage.getItem(source) !== null) {
      localStorage.setItem(target, localStorage.getItem(source));
    }
  });
}

function emitSyncStatus(status) {
  syncStatusListener?.({
    at: new Date().toISOString(),
    ...status,
  });
}

migrateLegacyLocalState();

export const Storage = {
  setSyncAdapter(adapter) {
    syncAdapter = adapter;
  },

  setSyncStatusListener(listener) {
    syncStatusListener = listener;
  },

  getAccountScope() {
    return accountScope;
  },

  setAccountScope(scope = 'local', options = {}) {
    const next = safeScope(scope);
    const previous = accountScope || 'local';
    migrateLegacyLocalState();
    if (options.migrateFromLocal && previous === 'local' && next !== 'local') {
      copyScopedLocalState('local', next);
    }
    accountScope = next;
    localStorage.setItem(KEYS.ACCOUNT_SCOPE, next);
  },

  getBankVersion() {
    return localStorage.getItem(KEYS.BANK_VERSION) || 'unknown';
  },

  setBankVersion(version) {
    if (version) localStorage.setItem(KEYS.BANK_VERSION, version);
  },

  getLastSync() {
    return localStorage.getItem(scopedKey(KEYS.LAST_SYNC));
  },

  setLastSync(date = new Date()) {
    localStorage.setItem(scopedKey(KEYS.LAST_SYNC), date.toISOString());
  },

  getTheme() {
    return localStorage.getItem(KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  getUsername() {
    return localStorage.getItem(scopedKey(KEYS.USERNAME)) || '';
  },

  setUsername(name) {
    const normalized = String(name || '').trim();
    if (normalized) localStorage.setItem(scopedKey(KEYS.USERNAME), normalized);
    else localStorage.removeItem(scopedKey(KEYS.USERNAME));
  },

  getPendingUsername() {
    return localStorage.getItem(KEYS.PENDING_USERNAME) || '';
  },

  setPendingUsername(name) {
    const normalized = String(name || '').trim();
    if (normalized) localStorage.setItem(KEYS.PENDING_USERNAME, normalized);
    else localStorage.removeItem(KEYS.PENDING_USERNAME);
  },

  consumePendingUsername() {
    const value = this.getPendingUsername();
    localStorage.removeItem(KEYS.PENDING_USERNAME);
    return value;
  },

  getActiveProfile() {
    return this.getUsername() || 'User';
  },

  setActiveProfile(name) {
    this.setUsername(name);
  },

  getProfiles() {
    const username = this.getUsername() || 'User';
    return [{ name: username, avatar: username.charAt(0).toUpperCase() }];
  },

  addProfile(name) {
    this.setUsername(name);
  },

  getBookmarks() {
    const raw = localStorage.getItem(scopedKey(KEYS.BOOKMARKS));
    return safeJsonParse(raw, []);
  },

  setBookmarks(bookmarks) {
    localStorage.setItem(scopedKey(KEYS.BOOKMARKS), JSON.stringify(bookmarks || []));
  },

  saveBookmark(question, section, passageTitle = null, passageText = null) {
    const bookmarks = this.getBookmarks();
    if (!bookmarks.some((x) => x.id === question.id)) {
      const normalizedSection = questionSection(question, section || 'varc');
      bookmarks.push({
        id: question.id,
        section: normalizedSection,
        type: questionType(question),
        typeGroup: questionTypeGroup(question),
        typeLabel: questionTypeLabel(question),
        sourceLabel: sourceLabel(question),
        question,
        passageTitle,
        passageText,
        bookmarkedAt: new Date().toISOString(),
      });
      localStorage.setItem(scopedKey(KEYS.BOOKMARKS), JSON.stringify(bookmarks));
      this.syncWithSupabase('bookmark_add', bookmarks.find((x) => x.id === question.id));
    }
  },

  removeBookmark(questionId) {
    const bookmarks = this.getBookmarks().filter((x) => x.id !== questionId);
    localStorage.setItem(scopedKey(KEYS.BOOKMARKS), JSON.stringify(bookmarks));
    this.syncWithSupabase('bookmark_remove', { question_id: questionId });
  },

  isBookmarked(questionId) {
    return this.getBookmarks().some((x) => x.id === questionId);
  },

  getHistory() {
    const raw = localStorage.getItem(scopedKey(KEYS.HISTORY));
    return safeJsonParse(raw, []);
  },

  setHistory(history) {
    localStorage.setItem(scopedKey(KEYS.HISTORY), JSON.stringify(history || []));
  },

  saveAttempt(attempt) {
    const history = this.getHistory();
    const savedAttempt = {
      ...attempt,
      id: attempt.id || Math.random().toString(36).slice(2, 11),
      completedAt: new Date().toISOString(),
    };
    history.push(savedAttempt);
    localStorage.setItem(scopedKey(KEYS.HISTORY), JSON.stringify(history));
    this.updateStreak();
    this.syncWithSupabase('attempt_save', savedAttempt);
  },

  getCompletedDays() {
    const raw = localStorage.getItem(scopedKey(KEYS.COMPLETED_DAYS));
    return safeJsonParse(raw, {});
  },

  setCompletedDays(days) {
    localStorage.setItem(scopedKey(KEYS.COMPLETED_DAYS), JSON.stringify(days || {}));
  },

  getCompletedDayRows() {
    const rows = [];
    const days = this.getCompletedDays();
    Object.entries(days).forEach(([sectionId, completedAt]) => {
      if (!completedAt) return;
      rows.push({
        sectionId,
        dayKey: localDateKey(new Date(completedAt)),
        completedAt,
      });
    });

    const dailyDone = this.getDailyDone();
    Object.entries(dailyDone).forEach(([sectionId, done]) => {
      if (sectionId === '_date' || !done) return;
      rows.push({
        sectionId,
        dayKey: dailyDone._date || localDateKey(),
        completedAt: new Date().toISOString(),
      });
    });
    return rows;
  },

  applyCompletedDayRows(rows = []) {
    const days = this.getCompletedDays();
    const today = localDateKey();
    const dailyDone = { _date: today };

    rows.forEach((row) => {
      const sectionId = row.sectionId || row.section_id;
      const completedAt = row.completedAt || row.completed_at || new Date().toISOString();
      const dayKey = row.dayKey || row.day_key;
      if (!sectionId) return;
      days[sectionId] = completedAt;
      if (dayKey === today) dailyDone[sectionId] = true;
    });

    this.setCompletedDays(days);
    localStorage.setItem(dailyDoneKey(), JSON.stringify(dailyDone));
  },

  completeDay(dayNumber) {
    const days = this.getCompletedDays();
    days[dayNumber] = new Date().toISOString();
    localStorage.setItem(scopedKey(KEYS.COMPLETED_DAYS), JSON.stringify(days));
    this.updateStreak();
    this.syncWithSupabase('day_complete', { sectionId: String(dayNumber) });
  },

  resetDays() {
    localStorage.removeItem(scopedKey(KEYS.COMPLETED_DAYS));
  },

  getDailyDone() {
    const today = localDateKey();
    const raw = localStorage.getItem(dailyDoneKey());
    if (!raw) return { _date: today };
    try {
      const parsed = JSON.parse(raw);
      return parsed._date === today ? parsed : { _date: today };
    } catch {
      return { _date: today };
    }
  },

  setDailyDone(sectionId) {
    const done = this.getDailyDone();
    done[sectionId] = true;
    localStorage.setItem(dailyDoneKey(), JSON.stringify(done));
    this.syncWithSupabase('day_complete', { sectionId, dayKey: done._date });
  },

  clearDailyDone() {
    localStorage.removeItem(dailyDoneKey());
  },

  getStreak() {
    const raw = localStorage.getItem(scopedKey(KEYS.STREAK));
    return safeJsonParse(raw, { current: 0, lastActive: null });
  },

  updateStreak() {
    const streak = this.getStreak();
    const today = new Date().toDateString();
    if (streak.lastActive === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (streak.lastActive === yesterday.toDateString()) streak.current += 1;
    else streak.current = 1;
    streak.lastActive = today;
    localStorage.setItem(scopedKey(KEYS.STREAK), JSON.stringify(streak));
  },

  clearLocal(scope = 'all') {
    if (scope === 'all' || scope === 'history') localStorage.removeItem(scopedKey(KEYS.HISTORY));
    if (scope === 'all' || scope === 'bookmarks') localStorage.removeItem(scopedKey(KEYS.BOOKMARKS));
    if (scope === 'all' || scope === 'daily') {
      localStorage.removeItem(scopedKey(KEYS.COMPLETED_DAYS));
      localStorage.removeItem(dailyDoneKey());
      localStorage.removeItem(scopedKey(KEYS.STREAK));
    }
    if (scope === 'all' || scope === 'settings') {
      localStorage.removeItem(KEYS.THEME);
      localStorage.removeItem(scopedKey(KEYS.USERNAME));
      localStorage.removeItem(scopedKey(KEYS.LAST_SYNC));
      localStorage.removeItem(KEYS.PROFILE);
      localStorage.removeItem(KEYS.PROFILES);
    }
  },

  async syncWithSupabase(action, payload) {
    if (!syncAdapter) return;
    try {
      emitSyncStatus({ state: 'syncing', label: 'Syncing' });
      if (action === 'bookmark_add') await syncAdapter.saveBookmark(payload, this.getBankVersion());
      if (action === 'bookmark_remove') await syncAdapter.removeBookmark(payload.question_id);
      if (action === 'attempt_save') await syncAdapter.saveAttempt(payload, this.getBankVersion());
      if (action === 'day_complete') await syncAdapter.saveCompletedDay(payload);
      this.setLastSync();
      emitSyncStatus({ state: 'synced', label: 'Synced' });
    } catch (error) {
      console.warn(`[Supabase Sync] ${action} failed`, error);
      const localOnly = /sign in/i.test(error?.message || '');
      emitSyncStatus({ state: localOnly ? 'local' : 'error', label: localOnly ? 'Local only' : 'Sync failed', detail: error?.message || String(error) });
    }
  },
};
