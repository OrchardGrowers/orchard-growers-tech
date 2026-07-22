import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({ findById: vi.fn() }));
vi.mock("../../models/Admin.js", () => ({ default: { findById: adminMocks.findById } }));

import {
  assertBusinessMailSenderAccess,
  getAuthorizedBusinessMailSenderProfiles,
  isBusinessMailMasterAdmin,
  normalizeBusinessMailRestrictedSenderProfileKeys,
  requireBusinessMailMasterAdmin,
} from "./businessMailSenderAccess.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";
const authorizedAdmin = (overrides = {}) => ({
  email: "admin@example.test",
  role: "ADMIN",
  ...overrides,
});
const profileKeys = (profiles) => profiles.map((profile) => profile.key);
const queryResult = (value) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
});
const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BUSINESS_MAIL_MASTER_ADMIN_EMAIL = "master@example.test";
  process.env.BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_ORCHARD_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "true";
  process.env.BUSINESS_MAIL_ORCHARD_CAREER_ENABLED = "true";
});

describe("Business Mail common and restricted sender authorization", () => {
  it("gives the configured master every globally enabled profile case-insensitively", async () => {
    const master = authorizedAdmin({ email: "MASTER@EXAMPLE.TEST" });
    expect(isBusinessMailMasterAdmin(master)).toBe(true);
    expect(profileKeys(await getAuthorizedBusinessMailSenderProfiles(master))).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
      "EFRUITMANDI_CAREER",
      "ORCHARD_CAREER",
    ]);
    expect(adminMocks.findById).not.toHaveBeenCalled();
  });

  it("does not give the master a globally disabled profile", async () => {
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "false";
    const master = authorizedAdmin({ email: "master@example.test" });
    expect(profileKeys(await getAuthorizedBusinessMailSenderProfiles(master))).not.toContain("EFRUITMANDI_CAREER");
    await expect(assertBusinessMailSenderAccess(master, "EFRUITMANDI_CAREER"))
      .rejects.toMatchObject({ statusCode: 403, code: "BUSINESS_MAIL_SENDER_ACCESS_DENIED" });
  });

  it("gives a regular authorized admin both globally enabled common profiles", async () => {
    expect(profileKeys(await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({ businessMailAccess: undefined })))).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
    ]);
  });

  it("gives common profiles when no database assignment exists", async () => {
    adminMocks.findById.mockReturnValue(queryResult({ _id: ADMIN_ID, role: "ADMIN", email: "legacy@example.test" }));
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({ _id: ADMIN_ID }));
    expect(profileKeys(profiles)).toEqual(["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"]);
  });

  it("does not give a regular admin an unassigned career profile", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({
      businessMailAccess: { enabled: true, allowedRestrictedSenderProfiles: [] },
    }));
    expect(profileKeys(profiles)).not.toContain("EFRUITMANDI_CAREER");
  });

  it("adds an explicitly assigned restricted profile while retaining common profiles", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({
      businessMailAccess: {
        enabled: true,
        allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"],
      },
    }));
    expect(profileKeys(profiles)).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
      "EFRUITMANDI_CAREER",
    ]);
  });

  it("omits an assigned restricted profile when it is globally disabled", async () => {
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "false";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({
      businessMailAccess: { enabled: true, allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"] },
    }));
    expect(profileKeys(profiles)).toEqual(["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"]);
  });

  it("keeps common profiles when restricted sender access is disabled", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({
      businessMailAccess: { enabled: false, allowedRestrictedSenderProfiles: ["ORCHARD_CAREER"] },
    }));
    expect(profileKeys(profiles)).toEqual(["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"]);
  });

  it("normalizes restricted profile keys case-insensitively", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({
      businessMailAccess: { enabled: true, allowedRestrictedSenderProfiles: ["orchard_career"] },
    }));
    expect(profileKeys(profiles)).toContain("ORCHARD_CAREER");
  });

  it("treats a legacy admin without businessMailAccess as eligible for common profiles", async () => {
    adminMocks.findById.mockReturnValue(queryResult({ _id: ADMIN_ID, email: "existing@example.test", role: "ADMIN" }));
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({ id: ADMIN_ID }));
    expect(profileKeys(profiles)).toEqual(["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"]);
  });

  it("gives no profiles to a role without Business Mail module access", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles({
      email: "viewer@example.test",
      role: "VIEWER",
      businessMailAccess: { enabled: true, allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"] },
    });
    expect(profiles).toEqual([]);
  });

  it("authorizes a regular admin to send from a common profile without an assignment", async () => {
    const profile = await assertBusinessMailSenderAccess(
      authorizedAdmin({ businessMailAccess: undefined }),
      "efruitmandi_no_reply"
    );
    expect(profile.key).toBe("EFRUITMANDI_NO_REPLY");
  });

  it("rejects a regular admin sending from an unassigned restricted profile", async () => {
    await expect(assertBusinessMailSenderAccess(
      authorizedAdmin({ businessMailAccess: undefined }),
      "EFRUITMANDI_CAREER"
    )).rejects.toMatchObject({ statusCode: 403, code: "BUSINESS_MAIL_SENDER_ACCESS_DENIED" });
  });

  it("rejects common profile keys in the restricted assignment allowlist", () => {
    expect(() => normalizeBusinessMailRestrictedSenderProfileKeys(["EFRUITMANDI_NO_REPLY"]))
      .toThrow("Common sender profiles are automatic");
  });
});

describe("Business Mail master management guard", () => {
  it("rejects a non-master administrator", () => {
    const response = createResponse();
    const next = vi.fn();
    requireBusinessMailMasterAdmin({ admin: { email: "other@example.test" } }, response, next);
    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows the configured master case-insensitively", () => {
    const next = vi.fn();
    requireBusinessMailMasterAdmin({ admin: { email: "MASTER@EXAMPLE.TEST" } }, createResponse(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
