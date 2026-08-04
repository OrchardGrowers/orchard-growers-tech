import mongoose from "mongoose";
import { BUSINESS_LEAD_TYPES } from "./BusinessLead.js";
import { CALLING_CAMPAIGN_PURPOSES, CALLING_LANGUAGES } from "./OGCallingCampaign.js";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 }, purpose: { type: String, enum: CALLING_CAMPAIGN_PURPOSES, required: true, index: true }, leadType: { type: String, enum: BUSINESS_LEAD_TYPES, required: true, index: true }, language: { type: String, enum: CALLING_LANGUAGES, required: true, index: true },
  version: { type: Number, min: 1, default: 1 }, status: { type: String, enum: ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"], default: "DRAFT", index: true },
  introduction: { type: String, trim: true, maxlength: 3000, required: true }, verificationQuestions: { type: [String], default: [] }, qualificationQuestions: { type: [String], default: [] }, platformExplanation: { type: String, trim: true, maxlength: 3000, default: "" },
  objectionResponses: { type: [{ objection: { type: String, maxlength: 500 }, response: { type: String, maxlength: 1000 } }], default: [] }, closingStatement: { type: String, trim: true, maxlength: 2000, default: "" }, prohibitedStatements: { type: [String], default: [] }, complianceDisclosure: { type: String, trim: true, maxlength: 2000, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true, collection: "og_call_script_templates", optimisticConcurrency: true });
schema.index({ purpose: 1, leadType: 1, language: 1, status: 1 });
export default mongoose.model("OGCallScriptTemplate", schema);
