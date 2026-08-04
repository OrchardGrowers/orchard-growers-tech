const decodeEntities = (value) => String(value || "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code) || 32));

export const sanitizeEmailContent = (input, { maximumLength = 20000 } = {}) => {
  const source = String(input || "").replace(/\u0000/g, " ");
  const withoutActiveContent = source
    .replace(/<(script|style|iframe|object|embed|svg|canvas)[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(img|video|audio|source|link|meta)\b[^>]*>/gi, " ")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ");
  const text = decodeEntities(withoutActiveContent.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<[^>]+>/g, " "));
  const withoutQuotedHistory = text.split(/\n\s*(?:On .+ wrote:|From:\s.+\nSent:\s|-----Original Message-----)/i)[0];
  return withoutQuotedHistory
    .replace(/^>.*$/gm, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, maximumLength);
};

export const createEvidenceSnippet = (text, terms = [], maximumLength = 900) => {
  const safe = sanitizeEmailContent(text, { maximumLength: 20000 });
  if (!safe) return "";
  const lower = safe.toLowerCase();
  const term = terms.map((item) => String(item || "").toLowerCase()).find((item) => item && lower.includes(item));
  const index = term ? lower.indexOf(term) : 0;
  const start = Math.max(0, index - 180);
  return safe.slice(start, start + maximumLength).trim();
};
