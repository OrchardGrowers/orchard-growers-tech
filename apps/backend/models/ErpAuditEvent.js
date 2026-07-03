import mongoose from "mongoose";

const erpAuditEventSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers", "admin"],
      default: "efruitmandi",
      index: true,
    },
    module: { type: String, trim: true, required: true, index: true },
    action: { type: String, trim: true, required: true, index: true },
    entityType: { type: String, trim: true, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
    actorAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", index: true },
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
      index: true,
    },
    before: { type: mongoose.Schema.Types.Mixed, default: undefined },
    after: { type: mongoose.Schema.Types.Mixed, default: undefined },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

erpAuditEventSchema.index({ createdAt: -1 });
erpAuditEventSchema.index({ module: 1, action: 1, createdAt: -1 });
erpAuditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("ErpAuditEvent", erpAuditEventSchema);
