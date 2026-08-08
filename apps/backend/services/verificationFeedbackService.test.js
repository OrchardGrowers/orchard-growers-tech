import { afterEach, describe, expect, it, vi } from "vitest";
import UserNotification from "../models/UserNotification.js";
import VerificationRemark from "../models/VerificationRemark.js";
import {
  getVerificationFeedback,
  markVerificationResubmitted,
  normalizeVerificationSection,
  recordAdminVerificationRemark,
  VERIFICATION_SECTION_CONFIG,
} from "./verificationFeedbackService.js";

const USER_ID = "64b000000000000000000000001";
const ADMIN_ID = "64b000000000000000000000002";
const REMARK_ID = "64b000000000000000000000003";

afterEach(() => vi.restoreAllMocks());

describe("verification feedback service", () => {
  it("persists an admin remark and notifies only the affected user with the section route", async () => {
    vi.spyOn(VerificationRemark, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    vi.spyOn(UserNotification, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    vi.spyOn(VerificationRemark, "create").mockImplementation(async (value) => ({
      ...value,
      _id: REMARK_ID,
    }));
    const createNotification = vi.spyOn(UserNotification, "create").mockImplementation(async (value) => value);

    const result = await recordAdminVerificationRemark({
      userId: USER_ID,
      section: "kyc",
      status: "CORRECTION_REQUIRED",
      remark: "Aadhaar image is unclear.",
      createdBy: ADMIN_ID,
      roleType: "grower",
      entityId: USER_ID,
    });

    expect(result.verificationRemark).toMatchObject({
      user: USER_ID,
      section: "kyc",
      status: "CHANGES_REQUIRED",
      remark: "Aadhaar image is unclear.",
      createdBy: ADMIN_ID,
      actionUrl: "/kyc",
    });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      user: USER_ID,
      type: "VERIFICATION_REMARK",
      section: "kyc",
      status: "CHANGES_REQUIRED",
      actionUrl: "/kyc",
    }));
  });

  it("routes a PAN-specific admin remark to the user's secure KYC section", async () => {
    vi.spyOn(VerificationRemark, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    vi.spyOn(UserNotification, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    vi.spyOn(VerificationRemark, "create").mockImplementation(async (value) => ({ ...value, _id: REMARK_ID }));
    const createNotification = vi.spyOn(UserNotification, "create").mockImplementation(async (value) => value);

    await recordAdminVerificationRemark({
      userId: USER_ID,
      section: "pan",
      status: "CORRECTION_REQUIRED",
      remark: "PAN number does not match the uploaded PAN card.",
      createdBy: ADMIN_ID,
      roleType: "buyer",
    });

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      user: USER_ID,
      section: "pan",
      actionUrl: "/kyc#pan",
      message: expect.stringContaining("PAN number does not match"),
    }));
  });

  it("keeps KYC and profile feedback isolated by section", async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ lean });
    const find = vi.spyOn(VerificationRemark, "find").mockReturnValue({ sort });

    await getVerificationFeedback({ userId: USER_ID, section: "profile", roleType: "buyer" });

    expect(find).toHaveBeenCalledWith({ user: USER_ID, section: "profile", roleType: "buyer" });
    expect(VERIFICATION_SECTION_CONFIG.profile.actionUrl).toBe("/get-verified");
    expect(VERIFICATION_SECTION_CONFIG.kyc.actionUrl).toBe("/kyc");
  });

  it("resolves old active feedback and appends a resubmission audit event", async () => {
    const updateMany = vi.spyOn(VerificationRemark, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    const resolveNotifications = vi.spyOn(UserNotification, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    const create = vi.spyOn(VerificationRemark, "create").mockImplementation(async (value) => value);

    await markVerificationResubmitted({
      userId: USER_ID,
      section: "kyc",
      roleType: "grower",
      entityId: USER_ID,
    });

    expect(updateMany).toHaveBeenCalledWith(
      { user: USER_ID, section: "kyc", roleType: "grower", resolvedAt: null },
      { $set: { resolvedAt: expect.any(Date) } }
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      user: USER_ID,
      section: "kyc",
      status: "PENDING",
      source: "USER",
      remark: "Updated verification information submitted.",
      resolvedAt: expect.any(Date),
    }));
    expect(resolveNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ user: USER_ID, section: "kyc", resolvedAt: null }),
      { $set: { resolvedAt: expect.any(Date) } }
    );
  });

  it("marks a verified result resolved so an old warning is not active", async () => {
    vi.spyOn(VerificationRemark, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(UserNotification, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    const createRemark = vi.spyOn(VerificationRemark, "create").mockImplementation(async (value) => ({
      ...value,
      _id: REMARK_ID,
    }));
    vi.spyOn(UserNotification, "create").mockImplementation(async (value) => value);

    await recordAdminVerificationRemark({
      userId: USER_ID,
      section: "profile",
      status: "APPROVED",
      createdBy: ADMIN_ID,
      roleType: "buyer",
    });

    expect(createRemark).toHaveBeenCalledWith(expect.objectContaining({
      status: "VERIFIED",
      resolvedAt: expect.any(Date),
    }));
  });

  it("rejects unknown sections instead of accepting arbitrary values", () => {
    expect(() => normalizeVerificationSection("private-dashboard")).toThrow("Invalid verification section");
  });
});
