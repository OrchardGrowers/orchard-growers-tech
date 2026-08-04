import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import OGAgentApproval from "../../models/OGAgentApproval.js";
import OGAgentSettings from "../../models/OGAgentSettings.js";
import OGAgentTask from "../../models/OGAgentTask.js";
import { createApprovalForTask, decideOGAgentApproval } from "./ogAgentApprovalService.js";
import { sanitizeAuditValue } from "./ogAgentAuditService.js";
import executeOGAgentTask from "./ogAgentExecutionService.js";
import { assertOGAgentTaskTransition } from "./ogAgentOrchestrator.js";
import planOGAgentTask from "./ogAgentPlanner.js";
import { enforcePhase1Settings } from "./ogAgentSettingsService.js";
import { detectProhibitedAction, listOGAgentTools } from "./ogAgentToolRegistry.js";

afterEach(() => vi.restoreAllMocks());

const task = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: "Weekly operations report",
  taskType: "REPORT_GENERATION",
  prompt: "Prepare an executive report from the information provided in this task only.",
  requestedBy: new mongoose.Types.ObjectId(),
  plan: [{ tool: "report_generation" }],
  ...overrides,
});

describe("OG Agent Phase 1 safety foundation", () => {
  it("applies safe model defaults", async () => {
    const document = new OGAgentTask(task({ plan: undefined }));
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.status).toBe("DRAFT");
    expect(document.riskLevel).toBe("LOW");

    const settings = new OGAgentSettings();
    await expect(settings.validate()).resolves.toBeUndefined();
    expect(settings.allowEmailSending).toBe(false);
    expect(settings.allowAICalling).toBe(false);
    expect(settings.allowCodeExecution).toBe(false);
    expect(settings.allowProductionDeployment).toBe(false);

    settings.allowEmailSending = true;
    await expect(settings.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("plans and runs a low-risk read-only report", async () => {
    const reportTask = task();
    const planned = await planOGAgentTask(reportTask);
    expect(planned.riskLevel).toBe("LOW");
    expect(planned.approvalRequired).toBe(false);
    expect(planned.tool.name).toBe("report_generation");
    expect(planned.plan).toHaveLength(3);

    const result = await executeOGAgentTask(reportTask, { allowReportGeneration: true });
    expect(result.summary).toMatch(/preview generated/i);
    expect(result.data).toMatchObject({
      observations: expect.any(Array),
      recommendations: expect.any(Array),
    });
  });

  it("routes the medium-risk external action demo to approval without a real action", async () => {
    const planned = await planOGAgentTask(task({
      taskType: "GENERAL",
      prompt: "Run the external action demo so that we can inspect the approval workflow.",
    }));
    expect(planned.tool.name).toBe("external_action_demo");
    expect(planned.riskLevel).toBe("MEDIUM");
    expect(planned.approvalRequired).toBe(true);

    const result = await planned.tool.execute({ task: task({ prompt: "external action demo" }) });
    expect(result.data.performedExternalAction).toBe(false);

    const approvalId = new mongoose.Types.ObjectId();
    vi.spyOn(OGAgentApproval, "findOneAndUpdate").mockResolvedValue({ _id: approvalId, status: "PENDING" });
    await expect(createApprovalForTask({ task: task(), tool: planned.tool })).resolves.toMatchObject({
      _id: approvalId,
      status: "PENDING",
    });
    expect(OGAgentApproval.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "external_action_demo", status: "PENDING" }),
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ riskLevel: "MEDIUM" }) }),
      expect.any(Object)
    );
  });

  it("blocks prohibited actions and exposes no executable tool for them", async () => {
    expect(detectProhibitedAction("Please deploy to production now")).toBe("deploy_production");
    expect(detectProhibitedAction("Run a terminal command to change the server")).toBe("execute_terminal_command");
    const planned = await planOGAgentTask(task({ prompt: "Please send an email to every buyer immediately." }));
    expect(planned.blockedAction).toBe("send_email");
    expect(planned.tool).toBeNull();
    expect(listOGAgentTools().some((tool) => tool.name === "send_email")).toBe(false);
  });

  it("forces prohibited settings off even when the API payload requests true", () => {
    expect(enforcePhase1Settings({
      agentEnabled: true,
      allowEmailSending: true,
      allowAICalling: true,
      allowCodeExecution: true,
      allowProductionDeployment: true,
    })).toMatchObject({
      agentEnabled: true,
      allowEmailSending: false,
      allowAICalling: false,
      allowCodeExecution: false,
      allowProductionDeployment: false,
    });
  });

  it("rejects invalid task transitions", () => {
    expect(() => assertOGAgentTaskTransition("DRAFT", "RUNNING")).toThrow(/cannot transition/i);
    expect(() => assertOGAgentTaskTransition("COMPLETED", "RUNNING")).toThrow(/cannot transition/i);
    expect(() => assertOGAgentTaskTransition("QUEUED", "RUNNING")).not.toThrow();
  });

  it("prevents an approval from being decided twice", async () => {
    const approval = { _id: new mongoose.Types.ObjectId() };
    const reviewerId = new mongoose.Types.ObjectId();
    vi.spyOn(OGAgentApproval, "findOneAndUpdate")
      .mockResolvedValueOnce({ ...approval, status: "APPROVED" })
      .mockResolvedValueOnce(null);

    await expect(decideOGAgentApproval({ approval, decision: "APPROVED", reviewerId })).resolves.toMatchObject({ status: "APPROVED" });
    await expect(decideOGAgentApproval({ approval, decision: "APPROVED", reviewerId })).rejects.toMatchObject({ code: "APPROVAL_ALREADY_DECIDED" });
  });

  it("redacts secrets from audit metadata", () => {
    expect(sanitizeAuditValue({ token: "secret", nested: { Authorization: "Bearer abc", safe: "ok" } })).toEqual({
      token: "[REDACTED]",
      nested: { Authorization: "[REDACTED]", safe: "ok" },
    });
  });
});
