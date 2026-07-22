import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("../models/Admin.js", () => ({
  default: {
    findById: adminMocks.findById,
    updateOne: adminMocks.updateOne,
  },
}));

import { updateBusinessMailSenderAccess } from "./adminBusinessMailController.js";

const MASTER_ID = "507f1f77bcf86cd799439011";
const TARGET_ID = "507f191e810c19729de860ea";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const createRequest = (body) => ({
  body,
  params: { adminId: TARGET_ID },
  user: { id: MASTER_ID, role: "ADMIN" },
  admin: { _id: MASTER_ID, email: "MASTER@EXAMPLE.TEST", role: "ADMIN" },
});

let target;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BUSINESS_MAIL_MASTER_ADMIN_EMAIL = "master@example.test";
  target = {
    _id: TARGET_ID,
    name: "Assigned Admin",
    email: "assigned@example.test",
    role: "ADMIN",
    businessMailAccess: undefined,
    auditLogs: [],
    save: vi.fn().mockResolvedValue(undefined),
  };
  adminMocks.findById.mockResolvedValue(target);
});

describe("Business Mail sender-access management", () => {
  it("lets the configured master assign restricted profile keys with server-owned approval data", async () => {
    const response = createResponse();
    await updateBusinessMailSenderAccess(
      createRequest({
        enabled: true,
        allowedRestrictedSenderProfiles: ["efruitmandi_career", "ORCHARD_CAREER"],
      }),
      response
    );

    expect(response.statusCode).toBe(200);
    expect(target.businessMailAccess).toMatchObject({
      enabled: true,
      allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER", "ORCHARD_CAREER"],
      approvedBy: MASTER_ID,
    });
    expect(target.businessMailAccess.approvedAt).toBeInstanceOf(Date);
    expect(target.auditLogs.at(-1)).toMatchObject({
      action: "BUSINESS_MAIL_ACCESS_ASSIGNED",
      by: MASTER_ID,
      to: {
        targetAdminId: TARGET_ID,
        enabled: true,
        allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER", "ORCHARD_CAREER"],
      },
    });
    expect(target.save).toHaveBeenCalledOnce();
  });

  it("lets the configured master revoke access and clears stored sender assignments", async () => {
    target.businessMailAccess = {
      enabled: true,
      allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"],
      approvedBy: MASTER_ID,
      approvedAt: new Date("2026-07-20T00:00:00.000Z"),
    };
    const response = createResponse();
    await updateBusinessMailSenderAccess(
      createRequest({ enabled: false, allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"] }),
      response
    );

    expect(response.statusCode).toBe(200);
    expect(target.businessMailAccess.enabled).toBe(false);
    expect(target.businessMailAccess.allowedRestrictedSenderProfiles).toEqual([]);
    expect(target.auditLogs.at(-1).action).toBe("BUSINESS_MAIL_ACCESS_REVOKED");
  });

  it("rejects arbitrary sender keys without changing the target admin", async () => {
    const response = createResponse();
    await updateBusinessMailSenderAccess(
      createRequest({ enabled: true, allowedRestrictedSenderProfiles: ["CUSTOM_FROM_ADDRESS"] }),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(adminMocks.findById).not.toHaveBeenCalled();
    expect(target.save).not.toHaveBeenCalled();
  });

  it("rejects common no-reply profiles because they are automatic", async () => {
    const response = createResponse();
    await updateBusinessMailSenderAccess(
      createRequest({ enabled: true, allowedRestrictedSenderProfiles: ["EFRUITMANDI_NO_REPLY"] }),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(adminMocks.findById).not.toHaveBeenCalled();
    expect(target.save).not.toHaveBeenCalled();
  });

  it("rejects client-supplied approval or master fields", async () => {
    const response = createResponse();
    await updateBusinessMailSenderAccess(
      createRequest({
        enabled: true,
        allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"],
        approvedBy: TARGET_ID,
        isMaster: true,
      }),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(target.save).not.toHaveBeenCalled();
  });
});
