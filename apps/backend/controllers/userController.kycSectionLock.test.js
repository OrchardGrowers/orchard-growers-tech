import { afterEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import VerificationRemark from "../models/VerificationRemark.js";
import UserNotification from "../models/UserNotification.js";
import { updateKyc } from "./userController.js";

const USER_ID = "64b000000000000000000000001";

const completeKyc = (status) => ({
  roleType: "buyer",
  status,
  submittedAt: new Date("2026-08-01T10:00:00.000Z"),
  fullName: "Buyer",
  phone: "9876543210",
  email: "buyer@example.com",
  address: "Buyer premises",
  district: "Shimla",
  state: "Himachal Pradesh",
  pinCode: "171001",
  idProofType: "Aadhaar",
  idProofNumber: "123456789012",
  idProofImage: "secure/id",
  panNumber: "ABCDE1234F",
  panImage: "secure/pan",
  bankAccountHolderName: "Buyer",
  bankName: "State Bank",
  accountNumber: "1234567890",
  ifscCode: "SBIN0000123",
  passbookFileUrl: "secure/bank",
  documents: [],
});

const userWithKyc = (status) => ({
  _id: USER_ID,
  name: "Buyer",
  role: "buyer",
  profileTypes: ["buyer"],
  kyc: {},
  kycByRole: { buyer: completeKyc(status) },
});

const response = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const mockSectionEntries = (entries = []) => {
  vi.spyOn(VerificationRemark, "find").mockReturnValue({
    sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(entries) }),
  });
};

afterEach(() => vi.restoreAllMocks());

describe("KYC section update authorization", () => {
  it("rejects a direct API edit to a verified PAN section", async () => {
    vi.spyOn(User, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(userWithKyc("APPROVED")) });
    mockSectionEntries([]);
    const res = response();

    await updateKyc({
      user: { id: USER_ID },
      body: { roleType: "buyer", section: "pan", panNumber: "AAAAA1111A" },
      files: {},
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      msg: "This verification section is locked. It must be reopened by an administrator before changes can be made.",
    });
  });

  it("rejects a direct API edit while the section is under review", async () => {
    vi.spyOn(User, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(userWithKyc("UNDER_REVIEW")) });
    mockSectionEntries([]);
    const res = response();

    await updateKyc({
      user: { id: USER_ID },
      body: { roleType: "buyer", section: "identity", idProofNumber: "123456789012" },
      files: {},
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("updates only a reopened identity section and locks it again as pending", async () => {
    const existingUser = userWithKyc("CORRECTION_REQUIRED");
    vi.spyOn(User, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(existingUser) });
    mockSectionEntries([
      { section: "identity", status: "CHANGES_REQUIRED", source: "ADMIN", remark: "Image blurred.", createdAt: new Date() },
      { section: "pan", status: "VERIFIED", source: "ADMIN", createdAt: new Date() },
      { section: "personal", status: "VERIFIED", source: "ADMIN", createdAt: new Date() },
      { section: "bank", status: "VERIFIED", source: "ADMIN", createdAt: new Date() },
    ]);
    const updatedUser = { ...existingUser, kyc: completeKyc("PENDING") };
    const selectUpdated = vi.fn().mockResolvedValue(updatedUser);
    const update = vi.spyOn(User, "findByIdAndUpdate").mockReturnValue({ select: selectUpdated });
    vi.spyOn(VerificationRemark, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(UserNotification, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    const createEvent = vi.spyOn(VerificationRemark, "create").mockImplementation(async (value) => value);
    const res = response();

    await updateKyc({
      user: { id: USER_ID },
      body: {
        roleType: "buyer",
        section: "identity",
        idProofType: "Aadhaar",
        idProofNumber: "123456789012",
        documents: [],
      },
      files: {},
    }, res);

    expect(update).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      $set: expect.objectContaining({
        "kycByRole.buyer": expect.objectContaining({
          status: "PENDING",
          panNumber: "ABCDE1234F",
          panImage: "secure/pan",
        }),
      }),
    }), { new: true });
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({
      section: "identity",
      status: "PENDING",
      source: "USER",
    }));
    expect(res.json).toHaveBeenCalledWith(updatedUser);
  });
});
