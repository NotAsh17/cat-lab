function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function decodeBasicHtml(value = '') {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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

export function stripLeadingOptionKey(value = '', key = '') {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return value;
  return String(value || '').replace(new RegExp(`^\\s*${escapeRegExp(cleanKey)}\\s*(?:[).:\\-]\\s*|\\s+)`, 'i'), '');
}

export function stripLeadingOptionKeyFromHtml(html = '', key = '') {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return sanitizeHtml(html);
  const safe = sanitizeHtml(html);
  const tagPrefix = '\\s*(?:<(?:p|span|div|strong|b|table|tbody|tr|td)[^>]*>\\s*)*';
  return safe
    .replace(new RegExp(`^(${tagPrefix})${escapeRegExp(cleanKey)}(?:\\s|&nbsp;|&#160;)*(?:[).:\\-](?:\\s|&nbsp;|&#160;)*)?`, 'i'), '$1')
    .replace(new RegExp(`^(${tagPrefix})(?:\\s|&nbsp;|&#160;)+`, 'i'), '$1');
}

export function optionDisplayKey(option, idx = 0) {
  const key = String(option?.key ?? '').trim();
  return key && /^[a-z0-9]{1,3}$/i.test(key) ? key : String.fromCharCode(65 + idx);
}

export function shouldStripOptionKeys(options = []) {
  const usable = (options || []).filter((option) => option?.key !== undefined && option?.key !== null && (option.text || option.html));
  if (usable.length < 2) return false;
  return usable.every((option) => {
    const key = String(option.key || '').trim();
    if (!key || !/^[a-z0-9]{1,3}$/i.test(key)) return false;
    const plain = option.html ? htmlToPlainText(option.html) : String(option.text || '');
    return new RegExp(`^\\s*${escapeRegExp(key)}\\s*(?:[).:\\-]|\\s)\\s*\\S`, 'i').test(plain);
  });
}
