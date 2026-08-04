import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import OGAgentAuditLog from "../models/OGAgentAuditLog.js";
import OGAgentTask from "../models/OGAgentTask.js";
import { createOGAgentTask, sanitizeOGAgentTaskPayload } from "./ogAgentController.js";

afterEach(() => vi.restoreAllMocks());

describe("OG Agent task controller", () => {
  it("rejects an invalid task type", () => {
    expect(() => sanitizeOGAgentTaskPayload({
      title: "Unsafe task",
      taskType: "DELETE_DATABASE",
      prompt: "This prompt is long enough for request validation.",
    })).toThrow(/taskType must be one of/i);
  });

  it("allows a valid senior admin to create a task and writes an audit record", async () => {
    const adminId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const createdTask = {
      _id: taskId,
      title: "Prepare grower research brief",
      taskType: "GROWER_RESEARCH",
      prompt: "Prepare a research checklist using only the supplied context.",
      status: "DRAFT",
      populate: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(OGAgentTask, "create").mockResolvedValue(createdTask);
    const auditSpy = vi.spyOn(OGAgentAuditLog, "create").mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    const req = {
      body: { title: createdTask.title, taskType: createdTask.taskType, prompt: createdTask.prompt },
      admin: { _id: adminId, role: "ADMIN" },
      ip: "127.0.0.1",
      headers: { "user-agent": "vitest" },
      get: () => "vitest",
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await createOGAgentTask(req, res);

    expect(OGAgentTask.create).toHaveBeenCalledWith(expect.objectContaining({ requestedBy: adminId }));
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ eventType: "TASK_CREATED", taskId }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: createdTask });
  });
});
