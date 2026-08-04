import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import OGAgentAuditLog from "../models/OGAgentAuditLog.js";
import { hasOGAgentPermission, requireOGAgentPermission } from "./ogAgentPermissions.js";

afterEach(() => vi.restoreAllMocks());

describe("OG Agent permissions", () => {
  it("limits Coding Agent writes to actual technical admin roles", () => {
    expect(hasOGAgentPermission({ role: "ADMIN" }, "coding.create_task")).toBe(true);
    expect(hasOGAgentPermission({ role: "ADMIN" }, "coding.apply_patch")).toBe(false);
    expect(hasOGAgentPermission({ role: "SUPER_ADMIN" }, "coding.apply_patch")).toBe(true);
    for (const role of ["VIEWER", "EMPLOYEE", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE", "FINANCE_MANAGER"]) {
      expect(hasOGAgentPermission({ role }, "coding.view"), role).toBe(false);
    }
  });

  it("audits and rejects an authenticated admin without the requested permission", async () => {
    const adminId = new mongoose.Types.ObjectId();
    const auditSpy = vi.spyOn(OGAgentAuditLog, "create").mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    const req = {
      admin: { _id: adminId, role: "VIEWER" },
      user: { id: adminId, role: "VIEWER" },
      ip: "127.0.0.1",
      headers: { "user-agent": "vitest" },
      get: () => "vitest",
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireOGAgentPermission("CHANGE_SETTINGS")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      actorId: adminId,
      eventType: "UNAUTHORIZED_ACTION_ATTEMPTED",
    }));
  });
});
