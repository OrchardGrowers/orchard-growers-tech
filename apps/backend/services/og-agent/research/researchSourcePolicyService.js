import { createHash } from "node:crypto";
export const sourcePolicyHash = (source) => createHash("sha256").update(JSON.stringify({ id: String(source._id), status: source.status, policyVersion: source.policyVersion, operations: source.allowedOperations, paths: source.allowedPaths, denied: source.deniedPaths, endpoints: source.allowedApiEndpoints, reviewExpiresAt: source.reviewExpiresAt })).digest("hex");
export const assertResearchSourceAllowed = ({ source, operation, task = null }) => {
  const fail = (message, code) => { throw Object.assign(new Error(message), { statusCode: 409, code }); };
  if (!source || source.status !== "ACTIVE") fail("Research source is not active", "RESEARCH_SOURCE_INACTIVE");
  if (["REVIEWED_PROHIBITED", "EXPIRED", "NOT_REVIEWED"].includes(source.termsReviewStatus)) fail("Source terms are not currently approved", "SOURCE_TERMS_BLOCKED");
  if (source.reviewExpiresAt && new Date(source.reviewExpiresAt) <= new Date()) fail("Source review has expired", "SOURCE_REVIEW_EXPIRED");
  if (!source.allowedOperations?.includes(operation)) fail(`Source operation ${operation} is not approved`, "SOURCE_OPERATION_BLOCKED");
  if (source.prohibitedOperations?.includes(operation)) fail(`Source explicitly prohibits ${operation}`, "SOURCE_OPERATION_BLOCKED");
  if (source.robotsPolicy === "DISALLOW_AUTOMATION" && operation === "FETCH_PAGE") fail("Source policy disallows website automation", "ROBOTS_POLICY_BLOCKED");
  if (task && task.maximumPages > source.maximumPagesPerTask) fail("Task page limit exceeds source policy", "SOURCE_LIMIT_EXCEEDED");
  return true;
};
