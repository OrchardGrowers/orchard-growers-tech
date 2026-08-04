import mongoose from "mongoose";

export const OG_AGENT_EXTRACTION_STATUSES = ["DRAFT", "SEARCHING", "ANALYZING", "REVIEW_READY", "WAITING_APPROVAL", "IMPORTING", "COMPLETED", "FAILED", "CANCELLED"];
export const OG_AGENT_EXTRACTION_TARGETS = ["GROWER", "BUYER", "BOTH", "CANDIDATE", "INVESTOR", "OTHER_BUSINESS_CONTACTS"];

const extractionFiltersSchema = new mongoose.Schema(
  {
    targetTypes: { type: [{ type: String, enum: OG_AGENT_EXTRACTION_TARGETS }], required: true },
    dateFrom: { type: Date, default: null },
    dateTo: { type: Date, default: null },
    searchTerms: { type: [String], default: [] },
    senderFilter: { type: String, trim: true, maxlength: 320, default: "" },
    subjectFilter: { type: String, trim: true, maxlength: 300, default: "" },
    folderFilter: { type: String, trim: true, maxlength: 120, default: "" },
    maximumMessages: { type: Number, min: 1, max: 250, default: 50 },
    includeSentMessages: { type: Boolean, default: false },
    includeArchivedMessages: { type: Boolean, default: false },
    ignorePreviouslyProcessed: { type: Boolean, default: true },
  },
  { _id: false }
);

const ogAgentLeadExtractionSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", required: true, index: true },
    mailboxSource: { type: String, required: true, trim: true, maxlength: 120, index: true },
    searchQuery: { type: String, trim: true, maxlength: 1000, default: "" },
    filters: { type: extractionFiltersSchema, required: true },
    messageCount: { type: Number, min: 0, default: 0 },
    analyzedMessageCount: { type: Number, min: 0, default: 0 },
    extractedLeadCount: { type: Number, min: 0, default: 0 },
    uniqueLeadCount: { type: Number, min: 0, default: 0 },
    duplicateLeadCount: { type: Number, min: 0, default: 0 },
    failedMessageCount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: OG_AGENT_EXTRACTION_STATUSES, default: "DRAFT", index: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 3000, default: "" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    approvalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
    importSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "og_agent_lead_extractions" }
);

ogAgentLeadExtractionSchema.index({ createdAt: -1 });
ogAgentLeadExtractionSchema.index({ status: 1, createdAt: -1 });
ogAgentLeadExtractionSchema.index({ requestedBy: 1, createdAt: -1 });

export default mongoose.model("OGAgentLeadExtraction", ogAgentLeadExtractionSchema);
