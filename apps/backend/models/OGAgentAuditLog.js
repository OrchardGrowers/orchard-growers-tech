import mongoose from "mongoose";

export const OG_AGENT_ACTOR_TYPES = ["ADMIN", "OG_AGENT", "SYSTEM"];

const ogAgentAuditLogSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", default: null, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null, index: true },
    actorType: { type: String, enum: OG_AGENT_ACTOR_TYPES, required: true, index: true },
    eventType: { type: String, required: true, trim: true, maxlength: 120, index: true },
    action: { type: String, required: true, trim: true, maxlength: 300 },
    details: { type: String, trim: true, maxlength: 4000, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, maxlength: 100, default: "" },
    userAgent: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true, collection: "og_agent_audit_logs" }
);

ogAgentAuditLogSchema.index({ createdAt: -1 });
ogAgentAuditLogSchema.index({ taskId: 1, createdAt: 1 });
ogAgentAuditLogSchema.index({ eventType: 1, createdAt: -1 });

export default mongoose.model("OGAgentAuditLog", ogAgentAuditLogSchema);
