import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({ findById: vi.fn() }));
vi.mock("../models/Admin.js", () => ({ default: { findById: adminMocks.findById } }));

import protect, { authorize } from "../middleware/authMiddleware.js";
import { ensureActiveAdmin } from "./adminRoutes.js";
import { BUSINESS_MAIL_ACCESS_ROLES } from "./adminBusinessMailRoutes.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

beforeEach(() => vi.clearAllMocks());

describe("Admin Business Mail security chain", () => {
  it("rejects unauthenticated requests through existing protection", async () => {
    const response = createResponse();
    await protect({ headers: {} }, response, vi.fn());
    expect(response.statusCode).toBe(401);
  });

  it("rejects a role outside the Business Mail allowlist", () => {
    const response = createResponse();
    authorize(...BUSINESS_MAIL_ACCESS_ROLES)(
      { user: { id: "admin", role: "VIEWER" } },
      response,
      vi.fn()
    );
    expect(response.statusCode).toBe(403);
  });

  it("allows an authorized role to reach the next middleware", () => {
    const next = vi.fn();
    authorize(...BUSINESS_MAIL_ACCESS_ROLES)(
      { user: { id: "admin", role: "SUPPORT_EXECUTIVE" } },
      createResponse(),
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects inactive admins through the existing active-admin check", async () => {
    adminMocks.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        email: "inactive@example.test",
        status: "SUSPENDED",
        role: "ADMIN",
        adminClass: "CLASS_I",
      }),
    });
    const response = createResponse();
    await ensureActiveAdmin(
      { user: { id: "507f1f77bcf86cd799439011", role: "ADMIN" } },
      response,
      vi.fn()
    );
    expect(response.statusCode).toBe(403);
  });
});

