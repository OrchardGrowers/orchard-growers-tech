import { afterEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import { getKycRequestByAdmin, reviewKycRequest } from "./adminController.js";

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

afterEach(() => vi.restoreAllMocks());

describe("admin PAN verification", () => {
  it("requires a remark when a verified PAN section is reopened", async () => {
    const user = {
      _id: "64b000000000000000000000001",
      role: "buyer",
      profileTypes: ["buyer"],
      kyc: {},
      kycByRole: {
        buyer: {
          roleType: "buyer",
          status: "APPROVED",
          adminReviews: [],
        },
      },
    };
    vi.spyOn(User, "findById").mockResolvedValue(user);
    const res = createResponse();

    await reviewKycRequest({
      params: { userId: `${user._id}:buyer` },
      body: { action: "CORRECTION_REQUIRED", section: "pan", note: "" },
      user: { id: "64b000000000000000000000002", role: "SUPER_ADMIN" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      msg: "Admin remarks are required for rejection or correction.",
    });
  });

  it("does not allow admin approval when mandatory PAN data is missing", async () => {
    const user = {
      _id: "64b000000000000000000000001",
      role: "buyer",
      profileTypes: ["buyer"],
      kyc: {},
      kycByRole: {
        buyer: {
          roleType: "buyer",
          status: "PENDING",
          fullName: "Buyer",
          phone: "9876543210",
          address: "Buyer premises",
          pinCode: "171001",
          idProofType: "Aadhaar",
          idProofNumber: "123456789012",
          idProofImage: "secure/id-proof",
          panNumber: "",
          panImage: "",
          accountNumber: "1234567890",
          ifscCode: "SBIN0000123",
          bankAccountHolderName: "Buyer",
          bankName: "State Bank",
          passbookFileUrl: "secure/passbook",
        },
      },
    };
    vi.spyOn(User, "findById").mockResolvedValue(user);
    const res = createResponse();

    await reviewKycRequest({
      params: { userId: `${user._id}:buyer` },
      body: { action: "APPROVE" },
      user: { id: "64b000000000000000000000002", role: "SUPER_ADMIN" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errors: {
        panNumber: "PAN Number is required.",
        panImage: "PAN Card document is required.",
      },
    }));
  });

  it("returns PAN number and secure document reference only through the authorized admin KYC endpoint", async () => {
    const user = {
      _id: "64b000000000000000000000001",
      kyc: {
        status: "PENDING",
        panNumber: "ABCDE1234F",
        panImage: "secure/pan-card",
      },
    };
    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(user),
      }),
    });
    const res = createResponse();

    await getKycRequestByAdmin({
      params: { id: String(user._id) },
      user: { id: "64b000000000000000000000002", role: "VERIFICATION_OFFICER" },
    }, res);

    expect(res.json).toHaveBeenCalledWith(user);
  });
});
