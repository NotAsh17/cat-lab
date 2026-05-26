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

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPill(ctx, x, y, label, value, color) {
  roundedRect(ctx, x, y, 188, 76, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#ded7c8';
  ctx.stroke();
  ctx.fillStyle = '#6c6253';
  ctx.font = '700 17px Bookerly, Georgia, serif';
  ctx.fillText(label, x + 22, y + 28);
  ctx.fillStyle = color;
  ctx.font = '700 28px Bookerly, Georgia, serif';
  ctx.fillText(value, x + 22, y + 59);
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    const dataUrl = canvas.toDataURL('image/png');
    fetch(dataUrl)
      .then((response) => response.blob())
      .then(resolve)
      .catch(() => canvas.toBlob((blob) => resolve(blob), 'image/png', 0.96));
  });
}

export async function createScoreCardBlob(attempt) {
  await document.fonts?.ready;
  const fields = scoreFields(attempt);
  const name = Storage.getUsername() || 'CAT Student';
  const title = attemptShareTitle(attempt);
  const canvas = document.createElement('canvas');
  canvas.width = 920;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#efe7d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  roundedRect(ctx, 24, 24, 872, 472, 24);
  ctx.fillStyle = '#fbf7ef';
  ctx.fill();
  ctx.strokeStyle = '#c9964a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#8a5a14';
  ctx.font = '700 19px Bookerly, Georgia, serif';
  ctx.fillText('CAT CATALYST', 60, 72);

  ctx.fillStyle = '#1f2428';
  ctx.font = '700 34px Bookerly, Georgia, serif';
  ctx.fillText(title, 60, 121);

  ctx.fillStyle = '#5d6470';
  ctx.font = '400 23px Bookerly, Georgia, serif';
  ctx.fillText(`Player: ${name}`, 60, 160);

  roundedRect(ctx, 60, 196, 312, 176, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#ded7c8';
  ctx.stroke();
  ctx.fillStyle = '#6c6253';
  ctx.font = '700 19px Bookerly, Georgia, serif';
  ctx.fillText('SCORE', 90, 237);
  ctx.fillStyle = Number(attempt?.score || 0) >= 0 ? '#e0b06a' : '#c45050';
  ctx.font = '700 74px Bookerly, Georgia, serif';
  ctx.fillText(String(attempt?.score || 0), 88, 318);
  ctx.fillStyle = '#7a7164';
  ctx.font = '700 30px Bookerly, Georgia, serif';
  ctx.fillText(`/ ${attempt?.max || 0}`, 196, 318);
  ctx.fillStyle = '#5d6470';
  ctx.font = '400 18px Bookerly, Georgia, serif';
  ctx.fillText(`${fields.accuracy}% accuracy`, 90, 350);

  drawPill(ctx, 404, 196, 'Correct', fields.correct, '#3d9e6b');
  drawPill(ctx, 612, 196, 'Wrong', fields.wrong, '#c45050');
  drawPill(ctx, 404, 292, 'Skipped', fields.skipped, '#69717d');
  drawPill(ctx, 612, 292, 'Time', fields.time, '#8a5a14');

  ctx.strokeStyle = '#ded7c8';
  ctx.beginPath();
  ctx.moveTo(60, 408);
  ctx.lineTo(860, 408);
  ctx.stroke();

  ctx.fillStyle = '#6c6253';
  ctx.font = '700 17px Bookerly, Georgia, serif';
  ctx.fillText('PACE', 60, 444);
  ctx.fillStyle = '#1f2428';
  ctx.font = '700 23px Bookerly, Georgia, serif';
  ctx.fillText(`${fields.pace}s/q`, 116, 444);

  ctx.fillStyle = '#6c6253';
  ctx.font = '700 17px Bookerly, Georgia, serif';
  ctx.fillText('PAPER', 232, 444);
  ctx.fillStyle = '#1f2428';
  ctx.font = '400 20px Consolas, Monaco, monospace';
  ctx.fillText(String(attempt?.paperId || attempt?.testId || 'local-practice').slice(0, 48), 296, 444);

  ctx.fillStyle = '#8a8174';
  ctx.font = '400 15px Bookerly, Georgia, serif';
  ctx.fillText('Generated for Discord sharing', 60, 478);

  return canvasToBlob(canvas);
}

export function scoreCardFilename(attempt) {
  const raw = String(attempt?.paperId || attempt?.testId || attempt?.id || 'local-practice')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `cat-catalyst-${raw || 'score-card'}.png`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createScoreCardFile(attempt) {
  const blob = await createScoreCardBlob(attempt);
  if (!blob) return null;
  return {
    blob,
    filename: scoreCardFilename(attempt),
    url: URL.createObjectURL(blob),
  };
}

export function revokeScoreCardFile(file) {
  if (file?.url) URL.revokeObjectURL(file.url);
}

export function saveScoreCardFile(file) {
  if (!file?.blob) return 'failed';
  downloadBlob(file.blob, file.filename || 'cat-catalyst-score-card.png');
  return 'download';
}

export async function downloadScoreCard(attempt) {
  const file = await createScoreCardFile(attempt);
  const status = saveScoreCardFile(file);
  revokeScoreCardFile(file);
  return status;
}
