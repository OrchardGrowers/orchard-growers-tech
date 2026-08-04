import mongoose from "mongoose";

const ogRepositorySnapshotSchema = new mongoose.Schema({
  codingTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCodingTask", required: true, index: true },
  patchId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCodePatch", default: null },
  snapshotType: { type: String, enum: ["BEFORE_ANALYSIS", "BEFORE_PATCH_APPLY", "AFTER_PATCH_APPLY", "AFTER_VALIDATION", "BEFORE_REVERT", "AFTER_REVERT"], required: true },
  gitCommit: { type: String, maxlength: 64, default: "" },
  branchName: { type: String, maxlength: 250, default: "" },
  gitStatusSummary: { type: String, maxlength: 12000, default: "" },
  workingTreeHash: { type: String, maxlength: 128, default: "" },
  trackedFileHashes: { type: mongoose.Schema.Types.Mixed, default: {} },
  untrackedFilesSummary: { type: [String], default: [] },
  modifiedFiles: { type: [String], default: [] },
  stagedFiles: { type: [String], default: [] },
}, { timestamps: true, collection: "og_repository_snapshots" });

ogRepositorySnapshotSchema.index({ codingTaskId: 1, createdAt: -1 });

export default mongoose.model("OGRepositorySnapshot", ogRepositorySnapshotSchema);
