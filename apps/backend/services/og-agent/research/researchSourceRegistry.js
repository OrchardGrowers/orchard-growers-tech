import OGResearchSource from "../../../models/OGResearchSource.js";
export const listActiveResearchSources = (filter = {}) => OGResearchSource.find({ ...filter, status: "ACTIVE", reviewExpiresAt: { $gt: new Date() } }).sort({ sourceReliability: 1, name: 1 });
export const getConfiguredResearchSource = async (sourceId) => { const source = await OGResearchSource.findById(sourceId); if (!source) throw Object.assign(new Error("Research source was not found"), { statusCode: 404, code: "RESEARCH_SOURCE_NOT_FOUND" }); return source; };
