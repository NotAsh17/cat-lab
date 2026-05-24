export function isTitaQuestion(question) {
  const type = question?.question_type || question?.type || '';
  return type.endsWith('_tita') || type === 'qa_tita';
}

export function questionType(question) {
  return question?.question_type || question?.type || '';
}

export function isQaQuestion(question) {
  const type = questionType(question);
  return question?.section === 'QA' || type.startsWith('qa_');
}

export function correctAnswer(question) {
  return String(question?.answer_key || question?.answer || question?.answer_value || '').trim();
}

export function answerOutcome(question, userAnswer) {
  const skipped = userAnswer === undefined || userAnswer === '';
  if (skipped) return 'skipped';
  const expected = correctAnswer(question);
  const given = String(userAnswer).trim();
  if (isTitaQuestion(question)) {
    return given.toLowerCase() === expected.toLowerCase() ? 'correct' : 'wrong';
  }
  return String(userAnswer) === expected ? 'correct' : 'wrong';
}

export function sourceLabel(question) {
  return question?.source_label || question?.source_family || question?.bank_id || question?.test_id || 'Source';
}

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function stripGenericVaInstruction(text = '', question = null) {
  const type = questionType(question);
  let output = String(text || '').trim();
  if (!output) return output;

  const paraJumble = type === 'va_para_jumble_tita' || type === 'va_para_jumble_mcq';
  const oddOneOut = type === 'va_odd_one_out_tita';
  const summary = type === 'va_summary_mcq' || type === 'va_summary_tita';
  const completion = type === 'va_para_completion_mcq' || type === 'va_sentence_placement_mcq';

  if (paraJumble) {
    output = output
      .replace(/^Directions?\s+for\s+question\s*\(?\d+\)?\s*:\s*/i, '')
      .replace(/^The\s+(?:four|five|\d+)\s+sentences\s*\([^)]*labelled[^)]*\)\s+given\s+in\s+this\s+question,\s+when\s+properly\s+sequenced,\s+form\s+a\s+coherent\s+paragraph\.\s*(?:Each\s+sentence\s+is\s+labelled\s+with\s+a\s+number\.\s*)?Decide\s+on\s+the\s+proper\s+(?:sequence\s+of\s+)?order\s+(?:for|of)\s+the\s+sentences\s+and\s+key\s+in\s+this\s+sequence\s+of\s+(?:four|five|\d+)\s+numbers\s+as\s+your\s+answer\.?\s*/i, '')
      .replace(/^The\s+(?:four|five|\d+)\s+sentences\s*\([^)]*labelled[^)]*\)\s+given\s+in\s+this\s+question,\s+when\s+properly\s+sequenced,\s+form\s+a\s+coherent\s+paragraph\.\s*(?:Each\s+sentence\s+is\s+labelled\s+with\s+a\s+number\.\s*)?Decide\s+on\s+the\s+proper\s+(?:sequence\s+of\s+)?order\s+of\s+the\s+sentences\s+and\s+key\s+in\s+this\s+sequence\s+of\s+(?:four|five|\d+)\s+numbers\s+as\s+your\s+Answer:\s*/i, '');
  }

  if (oddOneOut) {
    output = output
      .replace(/^Directions?\s+for\s+question\s*\(?\d+\)?\s*:\s*/i, '')
      .replace(/^Five\s+sentences\s+related\s+to\s+a\s+topic\s+are\s+given\s+below\.\s+Four\s+of\s+them\s+can\s+be\s+put\s+together\s+to\s+form\s+a\s+meaningful\s+and\s+coherent\s+short\s+paragraph\.\s+Identify\s+the\s+odd\s+one\s+out\.?\s*/i, '');
  }

  if (summary) {
    output = output
      .replace(/^Directions?\s+for\s+question\s*\(?\d+\)?\s*:\s*/i, '')
      .replace(/^The\s+passage\s+given\s+below\s+is\s+followed\s+by\s+four\s+(?:alternate\s+)?summaries\.\s+Choose\s+the\s+option\s+that\s+best\s+captures\s+the\s+(?:essence\s+of\s+the\s+passage|author'?s\s+position)\.?\s*/i, '');
  }

  if (completion) {
    output = output.replace(/^Directions?\s+for\s+question\s*\(?\d+\)?\s*:\s*/i, '');
  }

  return output.trim();
}

export function stripLeadingInstruction(text = '', question = null) {
  let output = String(text || '').trim();
  if (!output || !question) return output;
  const candidates = [
    question.instruction,
    question.structured?.instruction,
  ]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (output.startsWith(candidate)) {
      output = output.slice(candidate.length).trim();
      break;
    }
    const normCandidate = normalizeText(candidate);
    const normOutput = normalizeText(output);
    if (normCandidate && normOutput.startsWith(normCandidate)) {
      output = output.replace(new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim();
      break;
    }
  }
  return stripGenericVaInstruction(output, question);
}

export function displayInstruction(question, index = null) {
  const type = questionType(question);
  const n = index === null ? '' : ` ${index + 1}`;
  if (type.startsWith('rc_')) {
    return 'Read the passage and answer the following question.';
  }
  if (type === 'va_para_jumble_tita' || type === 'va_para_jumble_mcq') {
    return `Directions for question${n}: Arrange the given sentences to form a coherent paragraph.`;
  }
  if (type === 'va_odd_one_out_tita') {
    return `Directions for question${n}: Four of the five sentences form a coherent paragraph. Identify the odd sentence out.`;
  }
  if (type === 'va_summary_mcq' || type === 'va_summary_tita') {
    return `Directions for question${n}: Read the paragraph and choose the option that best captures the author's position.`;
  }
  if (type === 'va_sentence_placement_mcq') {
    return `Directions for question${n}: Decide where the missing sentence fits best in the paragraph.`;
  }
  if (type === 'va_para_completion_mcq') {
    return `Directions for question${n}: Choose the option that best completes the paragraph.`;
  }
  return question?.instruction || '';
}

export function questionPreview(question, length = 80) {
  const raw = stripLeadingInstruction(
    question?.stem || question?.stem_text || question?.structured?.prompt || question?.id || '',
    question,
  ).replace(/<[^>]+>/g, ' ');
  const text = normalizeText(raw || question?.id || '');
  return text.length > length ? `${text.slice(0, length)}...` : text;
}
