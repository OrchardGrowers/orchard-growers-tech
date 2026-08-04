const SECRET_PATTERNS = [
  [/\b(?:sk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_KEY]"],
  [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]"],
  [/(password|secret|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
];
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /system\s*prompt/gi,
  /you\s+are\s+now\s+(?:an?|the)/gi,
  /reveal\s+(?:your|the)\s+(?:instructions|secrets?)/gi,
];

export const redactFeedbackText = (value, max = 12000) => {
  let text = String(value || "").trim().slice(0, max);
  let redacted = false;
  SECRET_PATTERNS.forEach(([pattern, replacement]) => {
    const next = text.replace(pattern, replacement);
    redacted ||= next !== text;
    text = next;
  });
  INJECTION_PATTERNS.forEach((pattern) => {
    const next = text.replace(pattern, "[UNTRUSTED_INSTRUCTION_REMOVED]");
    redacted ||= next !== text;
    text = next;
  });
  return { text, redacted };
};

export const sanitizeFeedbackPayload = (payload = {}) => {
  let redactionApplied = false;
  const sanitize = (value, max) => {
    const result = redactFeedbackText(value, max);
    redactionApplied ||= result.redacted;
    return result.text;
  };
  const humanImpact = Object.fromEntries(Object.entries(payload.humanImpact || {}).map(([key, value]) => [
    key, Array.isArray(value) ? value.map((item) => sanitize(item, 200)) : sanitize(value, 3000),
  ]));
  return {
    ...payload,
    summary: sanitize(payload.summary, 4000), benefits: sanitize(payload.benefits, 4000), harms: sanitize(payload.harms, 4000),
    missedContext: sanitize(payload.missedContext, 4000), misunderstoodContext: sanitize(payload.misunderstoodContext, 4000),
    correction: sanitize(payload.correction, 4000), futureGuidance: sanitize(payload.futureGuidance, 4000),
    humanImpact,
    redactionApplied,
  };
};
