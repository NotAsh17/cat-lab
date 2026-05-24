import { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { questionPreview, questionType, stripLeadingInstruction } from '../services/questionUtils';
import { stripLeadingOptionKey, stripLeadingOptionKeyFromHtml } from '../services/optionRenderUtils';

function sanitizeHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<input\b[^>]*>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/<select[\s\S]*?<\/select>/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\sstyle='[^']*'/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function classNames(...items) {
  return items.filter(Boolean).join(' ');
}

export function BlockRenderer({ block, compact = false }) {
  const [zoomed, setZoomed] = useState(false);
  if (!block) return null;
  const kind = block.kind || block.type;
  if (kind === 'image') {
    const src = block.asset_url || block.url;
    if (!src) return null;
    return (
      <figure className={classNames('my-3', compact && 'my-2')}>
        <div className="relative inline-block max-w-full">
          <img
            src={src}
            alt={block.role || 'source image'}
            className="max-w-full rounded-md border border-border-subtle bg-white object-contain"
            loading="lazy"
          />
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="absolute right-2 top-2 rounded-md border border-border-subtle bg-bg-base/85 p-1.5 text-text-muted shadow-sm backdrop-blur hover:text-text-main"
            title="Zoom image"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {zoomed && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-6" onClick={() => setZoomed(false)}>
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="absolute right-5 top-5 rounded-lg border border-white/20 bg-black/50 p-2 text-white"
              title="Close zoom"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={src}
              alt={block.role || 'source image zoomed'}
              className="max-h-[92vh] max-w-[94vw] rounded-lg bg-white object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </figure>
    );
  }
  if (kind === 'html') {
    return (
      <div
        className="source-html text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html || block.text || '') }}
      />
    );
  }
  const text = block.text || '';
  if (!text) return null;
  return (
    <p className={classNames('whitespace-pre-wrap leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
      {text}
    </p>
  );
}

export function PassageDisplay({ passage, fontSize = 'text-base' }) {
  if (!passage) return null;
  const paragraphs = passage.paragraphs?.length ? passage.paragraphs : String(passage.passage || '').split(/\n\s*\n/).filter(Boolean);
  return (
    <div className={`${fontSize} font-serif leading-relaxed text-text-main/90 space-y-6 max-w-2xl`}>
      {paragraphs.map((p, idx) => (
        <p key={idx} className="indent-8 text-justify">
          {p}
        </p>
      ))}
    </div>
  );
}

function renderMediaList(media = []) {
  return media.map((m, idx) => <BlockRenderer key={`${m.asset_url || m.name || idx}-${idx}`} block={{ ...m, kind: 'image' }} />);
}

function StatementList({ statements }) {
  if (!Array.isArray(statements) || statements.length === 0) return null;
  return (
    <div className="space-y-3 my-4">
      {statements.map((s, idx) => {
        const label = s.label || s.key || s.number || `S${idx + 1}`;
        const content = typeof s === 'string' ? s : (s.text || s.content || '');
        return (
          <div key={`${label}-${idx}`} className="flex gap-3">
            <span className="font-mono text-[11px] text-brand-gold mt-0.5 min-w-8">[{label}]</span>
            <span className="text-sm leading-relaxed">{content}</span>
          </div>
        );
      })}
    </div>
  );
}

function parseInlineStatements(text = '') {
  const src = String(text || '').trim();
  if (!src) return { prompt: '', statements: [] };
  const matches = [...src.matchAll(/(?:^|\s)(?:\(?([1-6])\)?[.)])\s+/g)];
  if (matches.length < 4) return { prompt: src, statements: [] };

  const statements = [];
  matches.forEach((match, idx) => {
    const label = match[1];
    const start = match.index + match[0].length;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : src.length;
    const textPart = src.slice(start, end).trim();
    if (label && textPart) statements.push({ label, text: textPart });
  });

  const labels = statements.map((item) => item.label).join('');
  const sequential = labels.startsWith('1234') || labels.startsWith('12345');
  if (!sequential || statements.length < 4) return { prompt: src, statements: [] };
  return {
    prompt: src.slice(0, matches[0].index).trim(),
    statements,
  };
}

function decodeBasicHtml(value = '') {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function htmlToPlainText(html = '') {
  return decodeBasicHtml(
    sanitizeHtml(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function parseSentencePlacement(question) {
  const raw = question.stem_html ? htmlToPlainText(question.stem_html) : (question.stem || question.stem_text || '');
  const cleaned = stripLeadingInstruction(raw, question)
    .replace(/\[quizky-text\]/gi, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const markers = [...cleaned.matchAll(/\b(Sentence|Paragraph|Passage)\s*:\s*/gi)];
  const firstSentence = markers.find((m) => m[1].toLowerCase() === 'sentence');
  if (!firstSentence) return null;

  const firstIndex = markers.indexOf(firstSentence);
  const nextMarker = markers
    .slice(firstIndex + 1)
    .find((m) => {
      const label = m[1].toLowerCase();
      if (label === 'paragraph' || label === 'passage') return true;
      if (label !== 'sentence') return false;
      const afterMarker = cleaned.slice(m.index + m[0].length, m.index + m[0].length + 32);
      return /_{2,}\s*[1-4]\s*_{2,}/.test(afterMarker);
    });
  if (!nextMarker) return null;

  const sentence = cleaned.slice(firstSentence.index + firstSentence[0].length, nextMarker.index).trim();
  const paragraph = cleaned.slice(nextMarker.index + nextMarker[0].length).trim();
  if (!sentence || !paragraph) return null;

  return {
    sentence,
    paragraph: paragraph
      .replace(/_{2,}\s*([1-4])\s*_{2,}\.?/g, '\n____$1____ ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim(),
  };
}

export function QuestionStem({ question }) {
  if (!question) return null;
  const display = question.display || {};
  const cropFirst = display.primary_display === 'source_pdf_crops' || display.stem_display === 'source_pdf_stem_snapshot';
  const type = questionType(question);
  const stemText = stripLeadingInstruction(question.stem || question.question || question.stem_text || '', question);
  const isVaStatementQuestion = type === 'va_para_jumble_tita' || type === 'va_para_jumble_mcq' || type === 'va_odd_one_out_tita';
  const isSentencePlacement = type === 'va_sentence_placement_mcq';
  if (cropFirst && question.stem_media?.length) {
    return <div className="space-y-3">{renderMediaList(question.stem_media)}</div>;
  }

  if (isSentencePlacement) {
    const parsed = parseSentencePlacement(question);
    if (parsed) {
      return (
        <div className="text-sm md:text-[15px] text-text-main leading-relaxed mb-6 font-serif space-y-5">
          <p className="font-semibold">There is a sentence that is missing in the paragraph below. Look at the paragraph and decide in which blank the following sentence would best fit.</p>
          <div>
            <h3 className="font-bold mb-2">Sentence:</h3>
            <p className="whitespace-pre-wrap">{parsed.sentence}</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Paragraph:</h3>
            <p className="whitespace-pre-wrap">{parsed.paragraph}</p>
          </div>
        </div>
      );
    }
  }

  if (isVaStatementQuestion && question.structured?.statements?.length) {
    return (
      <div className="text-sm md:text-[15px] text-text-main leading-relaxed mb-6 font-serif">
        <StatementList statements={question.structured.statements} />
      </div>
    );
  }

  if (isVaStatementQuestion) {
    const parsed = parseInlineStatements(stemText || question.structured?.prompt || '');
    if (parsed.statements.length) {
      return (
        <div className="text-sm md:text-[15px] text-text-main leading-relaxed mb-6 font-serif">
          {parsed.prompt && <p className="whitespace-pre-wrap mb-4">{parsed.prompt}</p>}
          <StatementList statements={parsed.statements} />
        </div>
      );
    }
  }

  if (question.stem_html) {
    return (
      <div
        className="source-html text-sm md:text-[15px] text-text-main leading-relaxed mb-6"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.stem_html) }}
      />
    );
  }
  if (question.structured?.statements?.length) {
    const prompt = stripLeadingInstruction(question.structured.prompt || '', question);
    return (
      <div className="text-sm md:text-[15px] text-text-main leading-relaxed mb-6 font-serif">
        {prompt && !isVaStatementQuestion && <p className="whitespace-pre-wrap mb-4">{prompt}</p>}
        <StatementList statements={question.structured.statements} />
      </div>
    );
  }

  return (
    <div className="text-sm md:text-[15px] text-text-main leading-relaxed mb-6 whitespace-pre-wrap font-serif select-text">
      {stemText || question.structured?.prompt || question.id}
    </div>
  );
}

export function OptionContent({ option, stripSourceKey = false }) {
  if (!option) return null;
  if (option.media?.length) return <div className="space-y-2">{renderMediaList(option.media)}</div>;
  if (option.html) {
    return (
      <span
        className="source-html option-html"
        dangerouslySetInnerHTML={{ __html: stripSourceKey ? stripLeadingOptionKeyFromHtml(option.html, option.key) : sanitizeHtml(option.html) }}
      />
    );
  }
  return <span>{stripSourceKey ? stripLeadingOptionKey(option.text, option.key) : option.text}</span>;
}

export function QuestionExplanation({ question }) {
  const explanation = question?.explanation;
  if (!explanation) return null;
  const display = question.display || {};
  const cropFirst = display.primary_display === 'source_pdf_crops' || display.explanation_display === 'source_pdf_explanation_snapshot';
  const flow = Array.isArray(explanation.flow) ? explanation.flow : [];
  const imageFlow = flow.filter((b) => (b.kind || b.type) === 'image');

  if (cropFirst) {
    const media = explanation.media?.length ? explanation.media : imageFlow;
    return media.length ? <div className="space-y-3">{renderMediaList(media)}</div> : null;
  }

  if (flow.length) {
    return (
      <div className="space-y-4">
        {flow.map((block, idx) => (
          <div key={idx} className="text-text-muted">
            <BlockRenderer block={block} />
          </div>
        ))}
      </div>
    );
  }

  if (explanation.structured?.paragraphs?.length) {
    return (
      <div className="space-y-3">
        {explanation.structured.paragraphs.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
        {explanation.structured.option_analyses?.map((item, idx) => (
          <p key={`oa-${idx}`}>
            <span className="font-mono text-brand-gold">[{(item.keys || []).join(', ')}]</span> {item.text}
          </p>
        ))}
        {explanation.structured.conclusion && <p>{explanation.structured.conclusion}</p>}
      </div>
    );
  }

  if (explanation.html) {
    return (
      <div
        className="source-html text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanation.html) }}
      />
    );
  }

  return <div className="whitespace-pre-wrap">{explanation.text || explanation.source_text}</div>;
}

export function QuestionPreviewText({ question, length = 80 }) {
  return questionPreview(question, length);
}
