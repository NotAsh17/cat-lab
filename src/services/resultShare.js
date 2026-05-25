import { Storage } from './storage';

export function formatDuration(secs = 0) {
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`;
}

export function dailyAttemptMeta(attempt) {
  if (!attempt) return { dayKey: null, sectionId: null };
  const joined = [attempt.dailyDayKey, attempt.dailySectionId, attempt.paperId, attempt.testId, attempt.id]
    .filter(Boolean)
    .join(' ');
  const match = joined.match(/daily-(\d{4}-\d{2}-\d{2})-(rc\d+|va\d+)/i);
  return {
    dayKey: attempt.dailyDayKey || match?.[1] || null,
    sectionId: attempt.dailySectionId || match?.[2]?.toLowerCase() || null,
  };
}

export function findDailyAttempt(history = [], dayKey, sectionId) {
  const normalizedSection = String(sectionId || '').toLowerCase();
  return [...history]
    .filter((attempt) => {
      if (attempt.testType && attempt.testType !== 'daily_practice') return false;
      const meta = dailyAttemptMeta(attempt);
      return meta.dayKey === dayKey && meta.sectionId === normalizedSection;
    })
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))[0] || null;
}

function dateLabel(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return 'Practice';
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
}

function dailySectionLabel(attempt) {
  const meta = dailyAttemptMeta(attempt);
  if (meta.sectionId?.startsWith('rc')) return `RC ${meta.sectionId.replace('rc', '')}`;
  if (meta.sectionId?.startsWith('va')) return 'VA Set';
  return attempt?.paper?.blueprintId || attempt?.testType || 'Practice';
}

export function attemptShareTitle(attempt) {
  if (attempt?.testType === 'daily_practice') {
    return `CAT Daily Practice - ${dateLabel(dailyAttemptMeta(attempt).dayKey)} - ${dailySectionLabel(attempt)}`;
  }
  if (attempt?.testType === 'varc_sectional') return 'CAT VARC Sectional';
  if (attempt?.testType === 'qa_sectional') return 'CAT QA Sectional';
  if (attempt?.testType === 'full_mock') return 'CAT Full Mock';
  return 'CAT Practice Result';
}

export function scoreFields(attempt) {
  const attempted = (attempt?.correct || 0) + (attempt?.wrong || 0);
  const accuracy = attempted ? Math.round(((attempt.correct || 0) / attempted) * 100) : 0;
  const pace = attempted ? Math.round((attempt.timeUsed || 0) / attempted) : 0;
  return {
    attempted,
    accuracy,
    pace,
    score: `${attempt?.score || 0} / ${attempt?.max || 0}`,
    correct: String(attempt?.correct || 0),
    wrong: String(attempt?.wrong || 0),
    skipped: String(attempt?.skipped || 0),
    time: formatDuration(attempt?.timeUsed || 0),
  };
}

export function discordScoreMessage(attempt) {
  const fields = scoreFields(attempt);
  const name = Storage.getUsername() || 'CAT Student';
  return [
    `**${attemptShareTitle(attempt)}**`,
    `Player: ${name}`,
    `Score: **${fields.score}** | Accuracy: **${fields.accuracy}%** | Time: **${fields.time}**`,
    `Correct: ${fields.correct} | Wrong: ${fields.wrong} | Skipped: ${fields.skipped} | Pace: ${fields.pace}s/q`,
    `Paper: \`${attempt?.paperId || attempt?.testId || 'local-practice'}\``,
  ].join('\n');
}

export function discordEmbedPayload(attempt) {
  const fields = scoreFields(attempt);
  const name = Storage.getUsername() || 'CAT Student';
  return {
    content: `${name} completed ${attemptShareTitle(attempt)}.`,
    embeds: [
      {
        title: attemptShareTitle(attempt),
        color: 13211210,
        fields: [
          { name: 'Player', value: name, inline: true },
          { name: 'Score', value: fields.score, inline: true },
          { name: 'Accuracy', value: `${fields.accuracy}%`, inline: true },
          { name: 'Correct', value: fields.correct, inline: true },
          { name: 'Wrong', value: fields.wrong, inline: true },
          { name: 'Skipped', value: fields.skipped, inline: true },
          { name: 'Time', value: fields.time, inline: true },
          { name: 'Pace', value: `${fields.pace}s/q`, inline: true },
        ],
        footer: { text: `CAT Catalyst | ${attempt?.paperId || attempt?.testId || 'local-practice'}` },
      },
    ],
  };
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea copy path for stricter browser contexts.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
