import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({ find: vi.fn(), findById: vi.fn(), updateOne: vi.fn() }));
vi.mock("../models/Admin.js", () => ({
  default: {
    find: adminMocks.find,
    findById: adminMocks.findById,
    updateOne: adminMocks.updateOne,
  },
}));

import {
  getBusinessMailSenderAccessManagement,
  updateBusinessMailSenderAccess,
} from "./adminBusinessMailController.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BUSINESS_MAIL_MASTER_ADMIN_EMAIL = "adminho@orchardgrowers.in";
  process.env.BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_ORCHARD_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "false";
  process.env.BUSINESS_MAIL_ORCHARD_CAREER_ENABLED = "false";
  process.env.BUSINESS_MAIL_ADMINHO_ORCHARD_ENABLED = "false";
  process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
  process.env.BUSINESS_MAIL_SALES_ORCHARD_EMAIL = "sales@orchardgrowers.in";
  process.env.BUSINESS_MAIL_SUPPORT_EFRUITMANDI_ENABLED = "false";
});

describe("Business Mail effective sender-access management", () => {
  it("reports master-all profiles and two-or-three effective senders without using legacy assignments", async () => {
    const admins = [
      {
        _id: "507f191e810c19729de860ea",
        name: "Sales Admin",
        email: "sales@orchardgrowers.in",
        role: "SALES_EXECUTIVE",
        status: "ACTIVE",
        businessMailAccess: {
          enabled: true,
          allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"],
        },
      },
      {
        _id: "507f1f77bcf86cd799439011",
        name: "Viewer",
        email: "viewer@orchardgrowers.in",
        role: "VIEWER",
        status: "ACTIVE",
      },
    ];
    const lean = vi.fn().mockResolvedValue(admins);
    const sort = vi.fn().mockReturnValue({ lean });
    adminMocks.find.mockReturnValue({ select: vi.fn().mockReturnValue({ sort }) });
    const response = createResponse();

    await getBusinessMailSenderAccessManagement({}, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.assignmentPolicy).toBe("LOGIN_EMAIL_MATCH");
    expect(response.body.restrictedSenderProfiles).toEqual([]);
    expect(response.body.masterSenderProfiles.map((profile) => profile.key)).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
      "SALES_ORCHARD",
    ]);
    expect(response.body.admins[0]).toMatchObject({
      businessMailEligible: true,
      personalSenderAvailable: true,
      effectiveSenderCount: 3,
      matchingPersonalSenderProfile: { key: "SALES_ORCHARD" },
      businessMailAccess: { authoritative: false },
    });
    expect(response.body.admins[0].effectiveSenderProfiles.map((profile) => profile.key))
      .not.toContain("EFRUITMANDI_CAREER");
    expect(response.body.admins[1]).toMatchObject({
      businessMailEligible: false,
      effectiveSenderCount: 0,
    });
  });

  it("keeps the legacy mutation route but rejects obsolete assignments without database writes", () => {
    const response = createResponse();
    updateBusinessMailSenderAccess({
      body: { enabled: true, allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"] },
      params: { adminId: "507f191e810c19729de860ea" },
    }, response);

    expect(response.statusCode).toBe(409);
    expect(response.body.msg).toContain("deprecated");
    expect(adminMocks.findById).not.toHaveBeenCalled();
    expect(adminMocks.updateOne).not.toHaveBeenCalled();
  });
});
