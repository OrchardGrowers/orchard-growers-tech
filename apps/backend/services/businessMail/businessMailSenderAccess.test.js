import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertBusinessMailSenderAccess,
  getAuthorizedBusinessMailSenderProfiles,
  getBusinessMailSenderAccessSummary,
  isBusinessMailMasterAdmin,
  requireBusinessMailMasterAdmin,
} from "./businessMailSenderAccess.js";

const PROFILE_PREFIXES = [
  "EFRUITMANDI_NO_REPLY",
  "ORCHARD_NO_REPLY",
  "EFRUITMANDI_CAREER",
  "ORCHARD_CAREER",
  "ADMINHO_ORCHARD",
  "SALES_ORCHARD",
  "SUPPORT_EFRUITMANDI",
];
const authorizedAdmin = (overrides = {}) => ({ email: "admin@example.test", role: "ADMIN", ...overrides });
const profileKeys = (profiles) => profiles.map((profile) => profile.key);
const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

beforeEach(() => {
  process.env.BUSINESS_MAIL_MASTER_ADMIN_EMAIL = "adminho@orchardgrowers.in";
  PROFILE_PREFIXES.forEach((key) => { process.env[`BUSINESS_MAIL_${key}_ENABLED`] = "false"; });
  process.env.BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_ORCHARD_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_SALES_ORCHARD_EMAIL = "sales@orchardgrowers.in";
  process.env.BUSINESS_MAIL_SUPPORT_EFRUITMANDI_EMAIL = "support@efruitmandi.live";
  process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_EMAIL = "career@efruitmandi.live";
  process.env.BUSINESS_MAIL_ORCHARD_CAREER_EMAIL = "careers@orchardgrowers.in";
  process.env.BUSINESS_MAIL_ADMINHO_ORCHARD_EMAIL = "adminho@orchardgrowers.in";
});

describe("master-all and login-matched Business Mail sender authorization", () => {
  it("gives the master every globally enabled controlled profile", async () => {
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "true";
    process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "adminho@orchardgrowers.in" })
    );
    expect(profileKeys(profiles)).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
      "EFRUITMANDI_CAREER",
      "SALES_ORCHARD",
    ]);
  });

  it("does not give the master a globally disabled profile", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "adminho@orchardgrowers.in" })
    );
    expect(profileKeys(profiles)).not.toContain("ORCHARD_CAREER");
  });

  it("matches the configured master email case-insensitively", () => {
    expect(isBusinessMailMasterAdmin({ email: " ADMINHO@ORCHARDGROWERS.IN " })).toBe(true);
  });

  it("gives a normal authorized admin both enabled common profiles", async () => {
    expect(profileKeys(await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin()))).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
    ]);
  });

  it("adds one enabled controlled profile matching the normalized login email", async () => {
    process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: " SALES@ORCHARDGROWERS.IN " })
    );
    expect(profileKeys(profiles)).toEqual([
      "EFRUITMANDI_NO_REPLY",
      "ORCHARD_NO_REPLY",
      "SALES_ORCHARD",
    ]);
  });

  it("requires exact email equality and does not use domain or substring matches", async () => {
    process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "other-sales@orchardgrowers.in" })
    );
    expect(profileKeys(profiles)).not.toContain("SALES_ORCHARD");
  });

  it("does not return another administrator's controlled profile", async () => {
    process.env.BUSINESS_MAIL_SUPPORT_EFRUITMANDI_ENABLED = "true";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "sales@orchardgrowers.in" })
    );
    expect(profileKeys(profiles)).not.toContain("SUPPORT_EFRUITMANDI");
  });

  it("ignores legacy career assignments and enabled assignment flags", async () => {
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "true";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(authorizedAdmin({
      businessMailAccess: {
        enabled: true,
        allowedRestrictedSenderProfiles: ["EFRUITMANDI_CAREER"],
      },
    }));
    expect(profileKeys(profiles)).toEqual(["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"]);
  });

  it("returns only common profiles when the login has no controlled profile", async () => {
    expect(profileKeys(await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "unknown@orchardgrowers.in", businessMailAccess: undefined })
    ))).toEqual(["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"]);
  });

  it("does not return a matching controlled profile when globally disabled", async () => {
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "sales@orchardgrowers.in" })
    );
    expect(profileKeys(profiles)).not.toContain("SALES_ORCHARD");
  });

  it("gives an unauthorized role no profiles", async () => {
    process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
    expect(await getAuthorizedBusinessMailSenderProfiles({
      email: "sales@orchardgrowers.in",
      role: "VIEWER",
    })).toEqual([]);
  });

  it("denies an unrelated career profile with the generic access error", async () => {
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "true";
    await expect(assertBusinessMailSenderAccess(authorizedAdmin(), "EFRUITMANDI_CAREER"))
      .rejects.toMatchObject({ statusCode: 403, code: "BUSINESS_MAIL_SENDER_ACCESS_DENIED" });
  });

  it("allows the exact matching personal profile and either common profile", async () => {
    process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
    const admin = authorizedAdmin({ email: "sales@orchardgrowers.in" });
    await expect(assertBusinessMailSenderAccess(admin, "SALES_ORCHARD")).resolves.toMatchObject({ key: "SALES_ORCHARD" });
    await expect(assertBusinessMailSenderAccess(admin, "EFRUITMANDI_NO_REPLY")).resolves.toMatchObject({ key: "EFRUITMANDI_NO_REPLY" });
    await expect(assertBusinessMailSenderAccess(admin, "ORCHARD_NO_REPLY")).resolves.toMatchObject({ key: "ORCHARD_NO_REPLY" });
  });

  it("deduplicates effective profiles by controlled profile key", async () => {
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_ENABLED = "true";
    process.env.BUSINESS_MAIL_EFRUITMANDI_CAREER_EMAIL = "no-reply@efruitmandi.live";
    const profiles = await getAuthorizedBusinessMailSenderProfiles(
      authorizedAdmin({ email: "no-reply@efruitmandi.live" })
    );
    expect(new Set(profileKeys(profiles)).size).toBe(profiles.length);
  });

  it("reports an effective count of two or three from the controlled registry", () => {
    expect(getBusinessMailSenderAccessSummary(authorizedAdmin()).effectiveSenderCount).toBe(2);
    process.env.BUSINESS_MAIL_SALES_ORCHARD_ENABLED = "true";
    expect(getBusinessMailSenderAccessSummary(
      authorizedAdmin({ email: "sales@orchardgrowers.in" })
    ).effectiveSenderCount).toBe(3);
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
    requireBusinessMailMasterAdmin(
      { admin: { email: "ADMINHO@ORCHARDGROWERS.IN" } },
      createResponse(),
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
