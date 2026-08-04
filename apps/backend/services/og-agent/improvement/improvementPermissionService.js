const FORBIDDEN_CONTENT = /(disable|bypass|remove)\s+(?:the\s+)?(?:human\s+)?(approval|permission|security)|grant\s+(itself|agent)|deploy\s+production|push\s+git/i;
export const assertSafeImprovementContent = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  if (FORBIDDEN_CONTENT.test(text)) { const error = new Error("Improvement content cannot change permissions, security controls, approval rules, or deployment authority"); error.code = "PROHIBITED_SELF_MODIFICATION"; error.statusCode = 403; throw error; }
  return true;
};
