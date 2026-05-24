import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE_DIR = 'C:/Users/Not Ash/Downloads/Telegram Desktop';
const DEFAULT_DB_PATH = path.resolve('public/questions_db.json');
const ASSET_FAMILY = 'simcat_2025_full_mocks';
const ASSET_REL_DIR = `./bank_assets/${ASSET_FAMILY}`;
const SECTION_ORDER = [
  'Verbal Ability & Reading Comprehension',
  'Data Interpretation & Logical Reasoning',
  'Quantitative Ability',
];

const SECTION_META = {
  'Verbal Ability & Reading Comprehension': {
    id: 'varc',
    section: 'VARC',
    title: 'Verbal Ability & Reading Comprehension',
    shortTitle: 'VARC',
    durationSec: 40 * 60,
  },
  'Data Interpretation & Logical Reasoning': {
    id: 'lrdi',
    section: 'LRDI',
    title: 'Data Interpretation & Logical Reasoning',
    shortTitle: 'LRDI',
    durationSec: 40 * 60,
  },
  'Quantitative Ability': {
    id: 'qa',
    section: 'QA',
    title: 'Quantitative Ability',
    shortTitle: 'QA',
    durationSec: 40 * 60,
  },
};

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function extractJsonAfterConst(text) {
  const marker = 'const testData = ';
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error('missing `const testData =` marker');
  let i = markerIndex + marker.length;
  while (text[i] && /\s/.test(text[i])) i += 1;
  if (text[i] !== '{') throw new Error('testData value is not an object literal');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(i, j + 1);
    }
  }
  throw new Error('unterminated testData object');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeMockId(name) {
  const n = String(name || '').match(/simcat\s*(\d+)/i)?.[1] || slugify(name);
  return `simcat2025-${String(n).padStart(2, '0')}`;
}

function simcatNumber(value) {
  return Number(String(value || '').match(/simcat[_\s-]*(\d+)/i)?.[1] || Number.MAX_SAFE_INTEGER);
}

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '...')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
}

function stripHtml(html = '') {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function bodyInner(html = '') {
  let out = String(html || '');
  const bodyMatch = out.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) out = bodyMatch[1];
  out = out
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\sclass="MathJax[^"]*"/gi, '')
    .trim();
  return out;
}

function pBlocks(html = '') {
  return [...String(html).matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((m) => m[0]);
}

function buildContextHtml(rawInstructions, sectionId) {
  const html = bodyInner(rawInstructions);
  if (sectionId !== 'varc') return html;
  const blocks = pBlocks(html);
  if (!blocks.length) return html;
  const firstText = stripHtml(blocks[0]).toLowerCase();
  if (firstText.includes('passage below') || firstText.includes('based on the passage')) {
    return blocks.slice(1).join('\n').trim();
  }
  return html;
}

function isContextualQuestion(sectionId, rawInstructions) {
  const text = stripHtml(rawInstructions);
  if (sectionId === 'lrdi') return text.length > 20;
  if (sectionId === 'varc') {
    return text.length > 250 && /passage|based on/i.test(text);
  }
  return false;
}

function classifyQuestion(sectionId, question, hasContext) {
  const stemText = stripHtml(question.question_text || '').toLowerCase();
  if (sectionId === 'qa') return question.is_input_type ? 'qa_tita' : 'qa_mcq';
  if (sectionId === 'lrdi') return question.is_input_type ? 'lrdi_tita' : 'lrdi_mcq';
  if (hasContext) return question.is_input_type ? 'rc_tita' : 'rc_mcq';
  if (/odd\s+(sentence|one)|odd\s+one\s+out/.test(stemText)) return question.is_input_type ? 'va_odd_one_out_tita' : 'va_misc_mcq';
  if (/jumbled|properly sequenced|coherent paragraph|proper order/.test(stemText)) return question.is_input_type ? 'va_para_jumble_tita' : 'va_para_jumble_mcq';
  if (/summar(?:y|ies)|captures?\s+the\s+(author|essence|position)/.test(stemText)) return question.is_input_type ? 'va_summary_tita' : 'va_summary_mcq';
  if (/missing sentence|which blank|sentence would best fit|complete(?:s)? the paragraph/.test(stemText)) return 'va_sentence_placement_mcq';
  return question.is_input_type ? 'va_misc_tita' : 'va_misc_mcq';
}

function firstAnswer(correctResponse) {
  const value = Array.isArray(correctResponse) ? correctResponse.flat(Infinity)[0] : correctResponse;
  return value === undefined || value === null ? '' : String(value).trim();
}

function imageExtension(mime) {
  if (/jpe?g/i.test(mime)) return 'jpg';
  if (/webp/i.test(mime)) return 'webp';
  if (/gif/i.test(mime)) return 'gif';
  return 'png';
}

async function rewriteDataImages(html, assetRoot, assetUrlRoot) {
  const dataUrlPattern = /(<img\b[^>]*?\bsrc=["'])(data:image\/([^;"']+);base64,([^"']+))(["'][^>]*>)/gi;
  const replacements = [];
  let match;
  while ((match = dataUrlPattern.exec(html)) !== null) {
    const [, prefix, dataUrl, mimePart, base64, suffix] = match;
    const hash = crypto.createHash('sha256').update(base64).digest('hex').slice(0, 16);
    const ext = imageExtension(mimePart);
    const name = `${hash}.${ext}`;
    const filePath = path.join(assetRoot, name);
    replacements.push({ dataUrl, replacement: `${prefix}${assetUrlRoot}/${name}${suffix}`, filePath, base64 });
  }

  let output = html;
  for (const item of replacements) {
    await fs.mkdir(path.dirname(item.filePath), { recursive: true });
    try {
      await fs.access(item.filePath);
    } catch {
      await fs.writeFile(item.filePath, Buffer.from(item.base64, 'base64'));
    }
    output = output.split(item.dataUrl).join(item.replacement.match(/src=["']([^"']+)/)?.[1] || item.dataUrl);
  }
  return output;
}

function sourceQuestionPath(fileName, originalId) {
  return `Telegram Desktop/${fileName}#question-${originalId}`;
}

function sectionInstruction(sectionId, questionType) {
  if (sectionId === 'lrdi') return 'Refer to the data and answer the following question.';
  if (sectionId === 'qa') return '';
  if (questionType.startsWith('rc_')) return 'Read the passage and answer the following question.';
  return '';
}

async function normalizeQuestion({
  question,
  fileName,
  mock,
  mockId,
  sectionMeta,
  sectionIndex,
  globalIndex,
  localIndex,
  contextId,
  assetRoot,
}) {
  const hasContext = Boolean(contextId);
  const type = classifyQuestion(sectionMeta.id, question, hasContext);
  const answer = firstAnswer(question.correct_response);
  const stemHtml = await rewriteDataImages(bodyInner(question.question_text || ''), assetRoot, ASSET_REL_DIR);
  const solutionHtml = await rewriteDataImages(bodyInner(question.solution || ''), assetRoot, ASSET_REL_DIR);
  const options = await Promise.all((question.options || []).map(async (html, idx) => ({
    key: String(idx + 1),
    html: await rewriteDataImages(bodyInner(html), assetRoot, ASSET_REL_DIR),
    text: stripHtml(html),
  })));

  const out = {
    id: `${mockId}-q${String(globalIndex + 1).padStart(3, '0')}`,
    bank_id: ASSET_FAMILY,
    section: sectionMeta.section,
    subsection: sectionMeta.title,
    type,
    question_type: type,
    test_id: mockId,
    mock_id: mockId,
    number: globalIndex + 1,
    question_number: globalIndex + 1,
    section_number: localIndex + 1,
    section_id: sectionMeta.id,
    section_title: sectionMeta.title,
    stem: stripHtml(question.question_text || ''),
    stem_text: stripHtml(question.question_text || ''),
    stem_html: stemHtml,
    options,
    answer,
    answer_key: answer,
    answer_index: options.findIndex((o) => String(o.key) === String(answer)),
    confidence: 0.95,
    source_family: ASSET_FAMILY,
    source_label: mock.name,
    stable_id: `${ASSET_FAMILY}:${mockId}:q${String(globalIndex + 1).padStart(3, '0')}`,
    source: {
      source_name: ASSET_FAMILY,
      stable_id: `${ASSET_FAMILY}:${mockId}:q${String(globalIndex + 1).padStart(3, '0')}`,
      file: sourceQuestionPath(fileName, question.id),
      original_question_id: question.id,
      section: sectionMeta.title,
      section_order: sectionIndex + 1,
      section_question_number: localIndex + 1,
    },
    explanation: {
      html: solutionHtml,
      text: stripHtml(question.solution || ''),
      source: 'source_html_solution',
      status: 'source_html_solution',
    },
    marks: question.marks ?? 3,
    negative_marks: question.negative_marks ?? (question.is_input_type ? 0 : 1),
    is_input_type: Boolean(question.is_input_type),
    is_multi_select: Boolean(question.is_multi_select),
    instruction: sectionInstruction(sectionMeta.id, type),
  };

  if (contextId) out.passage_id = contextId;
  return out;
}

async function normalizeMock(filePath, dbAssetRoot) {
  const fileName = path.basename(filePath);
  const raw = await fs.readFile(filePath, 'utf8');
  const source = JSON.parse(extractJsonAfterConst(raw));
  const mockId = normalizeMockId(source.name);
  const assetRoot = path.join(dbAssetRoot, ASSET_FAMILY);
  const contextMap = new Map();
  const contexts = [];
  const sections = [];
  let globalIndex = 0;

  for (let sectionIndex = 0; sectionIndex < SECTION_ORDER.length; sectionIndex += 1) {
    const sourceSectionName = SECTION_ORDER[sectionIndex];
    const sectionMeta = SECTION_META[sourceSectionName];
    const ids = source.sections?.[sourceSectionName] || [];
    const questions = [];

    for (let localIndex = 0; localIndex < ids.length; localIndex += 1) {
      const originalId = String(ids[localIndex]);
      const question = source.questions?.[originalId];
      if (!question) continue;
      let contextId = null;
      if (isContextualQuestion(sectionMeta.id, question.instructions || '')) {
        const contextHtmlSource = buildContextHtml(question.instructions || '', sectionMeta.id);
        const contextKey = `${sectionMeta.id}:${stripHtml(contextHtmlSource).slice(0, 500)}`;
        if (!contextMap.has(contextKey)) {
          const nextIndex = [...contextMap.values()].filter((id) => id.includes(`-${sectionMeta.id}`)).length + 1;
          contextId = `${mockId}-${sectionMeta.id}-set${String(nextIndex).padStart(2, '0')}`;
          contextMap.set(contextKey, contextId);
          const rewrittenHtml = await rewriteDataImages(contextHtmlSource, assetRoot, ASSET_REL_DIR);
          contexts.push({
            id: contextId,
            bank_id: ASSET_FAMILY,
            mock_id: mockId,
            section: sectionMeta.section,
            section_id: sectionMeta.id,
            source_label: `${source.name} ${sectionMeta.shortTitle} Set ${nextIndex}`,
            title: `${sectionMeta.shortTitle} Set ${nextIndex}`,
            html: rewrittenHtml,
            paragraphs: sectionMeta.id === 'varc' ? pBlocks(rewrittenHtml).map(stripHtml).filter(Boolean) : [],
            source: {
              file: sourceQuestionPath(fileName, question.id),
              section: sectionMeta.title,
            },
          });
        } else {
          contextId = contextMap.get(contextKey);
        }
      }

      questions.push(await normalizeQuestion({
        question,
        fileName,
        mock: source,
        mockId,
        sectionMeta,
        sectionIndex,
        globalIndex,
        localIndex,
        contextId,
        assetRoot,
      }));
      globalIndex += 1;
    }

    sections.push({
      id: sectionMeta.id,
      section: sectionMeta.section,
      title: sectionMeta.title,
      shortTitle: sectionMeta.shortTitle,
      durationSec: sectionMeta.durationSec,
      questionCount: questions.length,
      questions,
    });
  }

  const questionCount = sections.reduce((sum, s) => sum + s.questions.length, 0);
  return {
    id: mockId,
    bank_id: ASSET_FAMILY,
    title: source.name,
    source_file: sourceQuestionPath(fileName, 'testData'),
    durationSec: 120 * 60,
    sectionOrder: sections.map((s) => s.id),
    sections,
    contexts,
    questionCount,
    sourceCounts: Object.fromEntries(sections.map((s) => [s.id, s.questionCount])),
    warnings: questionCount === 68 ? [] : [`source_question_count_${questionCount}`],
  };
}

async function main() {
  const sourceDir = argValue('--source-dir', DEFAULT_SOURCE_DIR);
  const dbPath = path.resolve(argValue('--db', DEFAULT_DB_PATH));
  const assetRoot = path.join(path.dirname(dbPath), 'bank_assets');
  const files = (await fs.readdir(sourceDir))
    .filter((file) => file.toLowerCase().endsWith('.html') && /simcat/i.test(file))
    .sort((a, b) => simcatNumber(a) - simcatNumber(b) || a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) throw new Error(`No SIMCAT HTML files found in ${sourceDir}`);

  const db = JSON.parse(await fs.readFile(dbPath, 'utf8'));
  const mocks = [];
  for (const file of files) {
    mocks.push(await normalizeMock(path.join(sourceDir, file), assetRoot));
  }
  mocks.sort((a, b) => simcatNumber(a.title) - simcatNumber(b.title) || a.title.localeCompare(b.title, undefined, { numeric: true }));

  db.mocks = db.mocks || {};
  db.mocks.full = mocks;
  db.generated_at = new Date().toISOString();
  db.manifest = db.manifest || {};
  db.manifest.full_mock_count = mocks.length;
  db.manifest.full_mock_question_count = mocks.reduce((sum, mock) => sum + mock.questionCount, 0);
  db.manifest.full_mock_source_counts = Object.fromEntries(mocks.map((mock) => [mock.id, mock.sourceCounts]));
  db.manifest.asset_count = (db.manifest.asset_count || 0) + 0;

  await fs.writeFile(dbPath, `${JSON.stringify(db)}\n`, 'utf8');
  console.log(JSON.stringify({
    sourceDir,
    dbPath,
    mocks: mocks.length,
    questions: db.manifest.full_mock_question_count,
    warnings: mocks.flatMap((mock) => mock.warnings.map((warning) => `${mock.id}:${warning}`)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
