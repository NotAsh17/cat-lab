const KEYS = {
  THEME: 'cat_theme',
  PROFILE: 'cat_active_profile',
  PROFILES: 'cat_profiles',
  HISTORY: 'cat_history',
  BOOKMARKS: 'cat_bookmarks',
  STREAK: 'cat_streak',
  COMPLETED_DAYS: 'cat_completed_days',
};

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const Storage = {
  getTheme() {
    return localStorage.getItem(KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  getActiveProfile() {
    return localStorage.getItem(KEYS.PROFILE) || 'User';
  },

  setActiveProfile(name) {
    localStorage.setItem(KEYS.PROFILE, name);
  },

  getProfiles() {
    const list = localStorage.getItem(KEYS.PROFILES);
    if (!list) {
      const defaults = [{ name: 'User', avatar: 'U' }];
      localStorage.setItem(KEYS.PROFILES, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(list);
  },

  addProfile(name) {
    const profiles = this.getProfiles();
    if (!profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      profiles.push({ name, avatar: name.charAt(0).toUpperCase() });
      localStorage.setItem(KEYS.PROFILES, JSON.stringify(profiles));
    }
  },

  getBookmarks() {
    const raw = localStorage.getItem(KEYS.BOOKMARKS);
    return raw ? JSON.parse(raw) : [];
  },

  saveBookmark(question, section, passageTitle = null, passageText = null) {
    const bookmarks = this.getBookmarks();
    if (!bookmarks.some((x) => x.id === question.id)) {
      bookmarks.push({
        id: question.id,
        section,
        question,
        passageTitle,
        passageText,
        bookmarkedAt: new Date().toISOString(),
      });
      localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
      this.syncWithSupabase('bookmark_add', { question_id: question.id });
    }
  },

  removeBookmark(questionId) {
    const bookmarks = this.getBookmarks().filter((x) => x.id !== questionId);
    localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    this.syncWithSupabase('bookmark_remove', { question_id: questionId });
  },

  isBookmarked(questionId) {
    return this.getBookmarks().some((x) => x.id === questionId);
  },

  getHistory() {
    const raw = localStorage.getItem(KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  },

  saveAttempt(attempt) {
    const history = this.getHistory();
    history.push({
      ...attempt,
      id: attempt.id || Math.random().toString(36).slice(2, 11),
      completedAt: new Date().toISOString(),
    });
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    this.updateStreak();
    this.syncWithSupabase('attempt_save', attempt);
  },

  getCompletedDays() {
    const raw = localStorage.getItem(KEYS.COMPLETED_DAYS);
    return raw ? JSON.parse(raw) : {};
  },

  completeDay(dayNumber) {
    const days = this.getCompletedDays();
    days[dayNumber] = new Date().toISOString();
    localStorage.setItem(KEYS.COMPLETED_DAYS, JSON.stringify(days));
    this.updateStreak();
    this.syncWithSupabase('day_complete', { day: dayNumber });
  },

  resetDays() {
    localStorage.removeItem(KEYS.COMPLETED_DAYS);
  },

  getDailyDone() {
    const today = localDateKey();
    const raw = localStorage.getItem('cat_daily_done');
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
    localStorage.setItem('cat_daily_done', JSON.stringify(done));
  },

  clearDailyDone() {
    localStorage.removeItem('cat_daily_done');
  },

  getStreak() {
    const raw = localStorage.getItem(KEYS.STREAK);
    return raw ? JSON.parse(raw) : { current: 0, lastActive: null };
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
    localStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
  },

  async syncWithSupabase(action, payload) {
    console.log(`[Supabase Sync] Action: ${action}`, payload);
  },
};
