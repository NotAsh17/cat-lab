const VA_GROUPS = {
  para_jumble: ['va_para_jumble_tita', 'va_para_jumble_mcq'],
  odd_one_out: ['va_odd_one_out_tita'],
  summary: ['va_summary_mcq', 'va_summary_tita'],
  placement: ['va_sentence_placement_mcq', 'va_para_completion_mcq'],
  misc: ['va_misc', 'va_misc_mcq', 'va_misc_tita'],
};

export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function seededRng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function next() {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleStable(items, rng) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function qType(q) {
  return q.question_type || q.type || '';
}

function questionOrder(a, b) {
  return Number(a.question_number || a.number || 0) - Number(b.question_number || b.number || 0);
}

function attachPassage(question, passageMap) {
  if (!question.passage_id) return question;
  const passage = passageMap.get(question.passage_id);
  return passage ? { ...question, passage } : question;
}

export function buildIndexes(db) {
  const varcQuestions = db?.varc?.questions || [];
  const passages = db?.varc?.passages || [];
  const qaQuestions = db?.qa?.questions || [];
  const questionMap = new Map([...varcQuestions, ...qaQuestions].map((q) => [q.id, q]));
  const passageMap = new Map(passages.map((p) => [p.id, p]));
  const questionsByPassage = new Map();
  passages.forEach((p) => {
    const ids = p.question_ids || [];
    const questions = ids.map((id) => questionMap.get(id)).filter(Boolean).sort(questionOrder);
    questionsByPassage.set(p.id, questions);
  });
  return { varcQuestions, passages, qaQuestions, questionMap, passageMap, questionsByPassage };
}

function makePaper({ id, seed, blueprintId, shared, durationSec, questions, passageIds = [], bankVersion, warnings = [] }) {
  const sourceMix = {};
  const typeMix = {};
  questions.forEach((q) => {
    sourceMix[q.bank_id || q.source_family || 'unknown'] = (sourceMix[q.bank_id || q.source_family || 'unknown'] || 0) + 1;
    typeMix[qType(q) || 'unknown'] = (typeMix[qType(q) || 'unknown'] || 0) + 1;
  });
  return {
    id,
    seed,
    blueprintId,
    shared,
    bankVersion,
    durationSec,
    questions,
    questionIds: questions.map((q) => q.id),
    passageIds,
    sourceMix,
    typeMix,
    warnings,
  };
}

function renderableQaQuestion(q) {
  const html = `${q.stem_html || ''} ${q.explanation?.html || ''}`;
  return !/https?:\/\//i.test(html) && !/data:image/i.test(html);
}

function qaPapers(db) {
  const indexes = buildIndexes(db);
  const grouped = new Map();
  indexes.qaQuestions.filter(renderableQaQuestion).forEach((q) => {
    const key = `${q.bank_id || 'qa'}::${q.test_id || 'unknown'}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(q);
  });
  return [...grouped.entries()]
    .map(([id, questions]) => ({ id, questions: questions.sort(questionOrder) }))
    .filter((paper) => paper.questions.length === 22);
}

function pickVaSet(varcQuestions, rng, count = 4) {
  const selected = [];
  const used = new Set();
  const byType = new Map();
  varcQuestions.filter((q) => q.subsection === 'VA' || qType(q).startsWith('va_')).forEach((q) => {
    const type = qType(q);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(q);
  });
  const groupOrder = shuffleStable(['para_jumble', 'odd_one_out', 'summary', 'placement'], rng);
  groupOrder.forEach((group) => {
    const pool = shuffleStable(VA_GROUPS[group].flatMap((type) => byType.get(type) || []), rng);
    const q = pool.find((item) => !used.has(item.id));
    if (q && selected.length < count) {
      selected.push(q);
      used.add(q.id);
    }
  });
  if (selected.length < count) {
    const fallback = shuffleStable(varcQuestions.filter((q) => (q.subsection === 'VA' || qType(q).startsWith('va_')) && !used.has(q.id)), rng);
    selected.push(...fallback.slice(0, count - selected.length));
  }
  return selected;
}

export function generateDailySections(db, date = new Date()) {
  const { passages, passageMap, questionsByPassage, varcQuestions } = buildIndexes(db);
  const bankVersion = db?.bank_version || db?.manifest?.bank_version || db?.manifest?.source_count || 'v1';
  const dateKey = todayKey(date);
  const seed = `daily:${dateKey}:${bankVersion}`;
  const rng = seededRng(seed);
  const day = date.getDay();
  const mixed = day === 0 || day === 5 || day === 6;
  const rcCount = mixed ? 1 : 2;
  const eligible = passages.filter((p) => (questionsByPassage.get(p.id) || []).length >= 3);
  const chosenPassages = shuffleStable(eligible, rng).slice(0, rcCount);
  const sections = chosenPassages.map((p, idx) => {
    const questions = (questionsByPassage.get(p.id) || []).map((q) => attachPassage(q, passageMap));
    return {
      id: `daily-${dateKey}-rc${idx + 1}`,
      dailySectionId: `rc${idx + 1}`,
      label: rcCount > 1 ? `RC Passage ${idx + 1}` : 'RC Passage',
      sublabel: p.source_label || p.bank_id || 'Reading Comprehension',
      questionCount: questions.length,
      durationSec: questions.length * 180,
      paper: makePaper({
        id: `daily-${dateKey}-rc${idx + 1}`,
        seed,
        blueprintId: 'daily_rc',
        shared: true,
        durationSec: questions.length * 180,
        questions,
        passageIds: [p.id],
        bankVersion,
      }),
    };
  });
  if (mixed) {
    const questions = pickVaSet(varcQuestions, rng, 4);
    sections.push({
      id: `daily-${dateKey}-va1`,
      dailySectionId: 'va1',
      label: 'Verbal Ability Set',
      sublabel: 'Para jumble, summary, odd-one-out, placement mix',
      questionCount: questions.length,
      durationSec: 900,
      paper: makePaper({
        id: `daily-${dateKey}-va1`,
        seed,
        blueprintId: 'daily_mixed_va',
        shared: true,
        durationSec: 900,
        questions,
        bankVersion,
      }),
    });
  }
  return { seed, dateKey, mixed, sections };
}

export function generatePaper({ db, blueprintId, seed, shared = true, bankVersion, excludeQuestionIds = new Set(), practiceIndex = 0 }) {
  const version = bankVersion || db?.bank_version || 'v1';
  const rng = seededRng(seed || `${blueprintId}:${version}`);
  const { passages, passageMap, questionsByPassage, varcQuestions } = buildIndexes(db);

  if (blueprintId === 'varc_weekly_sectional') {
    const eligible = passages.filter((p) => {
      const qs = questionsByPassage.get(p.id) || [];
      return qs.length >= 3 && qs.every((q) => !excludeQuestionIds.has(q.id));
    });
    const chosen = [];
    let rcCount = 0;
    for (const p of shuffleStable(eligible, rng)) {
      const qs = questionsByPassage.get(p.id) || [];
      if (chosen.length < 4 && rcCount + qs.length <= 18) {
        chosen.push(p);
        rcCount += qs.length;
      }
      if (chosen.length === 4 && rcCount >= 14) break;
    }
    while (chosen.length < 4) {
      const next = shuffleStable(eligible, rng).find((p) => !chosen.some((x) => x.id === p.id));
      if (!next) break;
      chosen.push(next);
      rcCount += (questionsByPassage.get(next.id) || []).length;
    }
    const rcQuestions = chosen.flatMap((p) => (questionsByPassage.get(p.id) || []).map((q) => attachPassage(q, passageMap)));
    const vaNeeded = Math.max(0, 24 - rcQuestions.length);
    const vaQuestions = pickVaSet(varcQuestions.filter((q) => !excludeQuestionIds.has(q.id)), rng, vaNeeded);
    const questions = [...rcQuestions, ...vaQuestions].slice(0, 24);
    return makePaper({
      id: `varc-weekly-${seed}`,
      seed,
      blueprintId,
      shared,
      durationSec: 2400,
      questions,
      passageIds: chosen.map((p) => p.id),
      bankVersion: version,
      warnings: questions.length === 24 ? [] : [`expected_24_got_${questions.length}`],
    });
  }

  if (blueprintId === 'qa_weekly_sectional' || blueprintId === 'qa_practice_sectional') {
    const papers = shuffleStable(qaPapers(db), rng);
    const available = papers.filter((paper) => paper.questions.every((q) => !excludeQuestionIds.has(q.id)));
    const selected = available[practiceIndex % Math.max(1, available.length)] || papers[0];
    const questions = selected ? selected.questions : [];
    return makePaper({
      id: `${blueprintId}-${seed}`,
      seed,
      blueprintId,
      shared,
      durationSec: 2400,
      questions,
      bankVersion: version,
      warnings: questions.length === 22 ? [] : [`expected_22_got_${questions.length}`],
    });
  }

  return makePaper({
    id: `${blueprintId}-${seed}`,
    seed,
    blueprintId,
    shared,
    durationSec: 0,
    questions: [],
    bankVersion: version,
    warnings: ['unknown_blueprint'],
  });
}

export function weeklySeeds(bankVersion, date = new Date()) {
  const { year, week } = getISOWeek(date);
  const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
  return {
    weekKey,
    varc: `varc-weekly:${weekKey}:${bankVersion}`,
    qa: `qa-weekly:${weekKey}:${bankVersion}`,
    qaPractice: (idx) => `qa-practice:${weekKey}:${idx}:${bankVersion}`,
  };
}
