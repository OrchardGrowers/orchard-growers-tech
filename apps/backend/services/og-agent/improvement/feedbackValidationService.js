import { createHash } from "node:crypto";
import { OG_AGENT_ASSESSMENTS, OG_AGENT_GUIDANCE_SCOPES, OG_AGENT_REVIEW_DECISIONS } from "../../../models/ogAgentImprovementSchemas.js";

const fail = (message, code = "FEEDBACK_VALIDATION_ERROR", statusCode = 400) => {
  const error = new Error(message); error.code = code; error.statusCode = statusCode; throw error;
};
const isText = (value) => typeof value === "string" && value.trim().length > 0;
export const stableHash = (value) => createHash("sha256").update(JSON.stringify(value, Object.keys(value || {}).sort())).digest("hex");

export const validateStructuredFeedback = (input = {}, { riskLevel = "LOW" } = {}) => {
  const reviewDecision = String(input.reviewDecision || "").toUpperCase();
  const assessment = String(input.assessment || "").toUpperCase();
  if (!OG_AGENT_REVIEW_DECISIONS.includes(reviewDecision)) fail("A supported reviewDecision is required");
  if (!OG_AGENT_ASSESSMENTS.includes(assessment)) fail("A supported assessment is required");
  if (!isText(input.summary)) fail("A feedback summary is required");
  if (["REJECT_AND_TEACH", "REQUEST_REVISION"].includes(reviewDecision) && !isText(input.correction) && !isText(input.futureGuidance)) {
    fail("Teaching or revision decisions require a correction or future guidance");
  }
  const conditions = Array.isArray(input.conditions) ? input.conditions : [];
  if (reviewDecision === "APPROVE_WITH_CONDITIONS" && !conditions.some((item) => isText(item?.condition))) {
    fail("Conditional approval requires at least one verifiable condition", "CONDITIONS_REQUIRED");
  }
  const severity = String(input.humanImpact?.severity || "NONE").toUpperCase();
  if (assessment === "RISKY" && (!isText(input.harms) || ["NONE", "LOW"].includes(severity))) {
    fail("A risky assessment requires a harm explanation and medium-or-higher severity", "RISK_ASSESSMENT_INCOMPLETE");
  }
  const specialistReviewRequired = Boolean(input.specialistReviewRequired || severity === "CRITICAL" || riskLevel === "HIGH" && assessment === "RISKY");
  if (severity === "CRITICAL" && reviewDecision !== "ESCALATE_FOR_REVIEW") {
    fail("Critical human impact must be escalated for specialist review", "CRITICAL_IMPACT_REQUIRES_ESCALATION", 409);
  }
  const confidence = Number(input.confidence ?? 50);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) fail("confidence must be between 0 and 100");
  const guidanceScope = String(input.guidanceScope || "TASK_TYPE").toUpperCase();
  if (!OG_AGENT_GUIDANCE_SCOPES.includes(guidanceScope)) fail("guidanceScope is invalid");
  return { ...input, reviewDecision, assessment, conditions, severity, specialistReviewRequired, confidence, guidanceScope };
};

export const mapReviewDecisionToApprovalStatus = (decision) => {
  if (["APPROVE", "APPROVE_WITH_CONDITIONS"].includes(decision)) return "APPROVED";
  if (decision === "ESCALATE_FOR_REVIEW") return "ESCALATED";
  return "REJECTED";
};

export const assertApprovalConditionsSatisfied = (approval, executionContext = {}) => {
  const conditions = approval?.conditions || [];
  const unmet = conditions.filter((item) => {
    if (item.satisfied) return false;
    if (item.verificationType === "FIELD_PRESENT") return !executionContext[item.field];
    if (item.verificationType === "FIELD_EQUALS") return executionContext[item.field] !== item.expectedValue;
    return true;
  });
  if (unmet.length) fail(`Approval conditions are not satisfied: ${unmet.map((item) => item.condition).join("; ")}`, "APPROVAL_CONDITIONS_UNMET", 409);
  return true;
};
