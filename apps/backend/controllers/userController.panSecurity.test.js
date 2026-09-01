import { afterEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import VerificationRemark from "../models/VerificationRemark.js";
import { getMyKyc, getProfile, toPublicProfile } from "./userController.js";

afterEach(() => vi.restoreAllMocks());

describe("PAN data access boundaries", () => {
  it("returns only correlated, minimal account authorization fields", async () => {
    const owner = {
      _id: "local-user-12345678",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
      phone: "9999999999",
      email: "private@example.test",
      kycByRole: { grower: { panNumber: "ABCDE1234F" } },
    };
    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockResolvedValue(owner),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await getProfile(
      { user: { id: owner._id }, query: { authorizationOnly: "1" } },
      res
    );

    expect(res.json).toHaveBeenCalledWith({
      identityRef: "12345678",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
    });
    const serialized = JSON.stringify(res.json.mock.calls[0][0]);
    expect(serialized).not.toContain("9999999999");
    expect(serialized).not.toContain("private@example.test");
    expect(serialized).not.toContain("ABCDE1234F");
  });

  it("never serializes PAN details or documents into a public profile", () => {
    const profile = toPublicProfile({
      _id: "user-1",
      role: "grower",
      profileTypes: ["grower"],
      orchardName: "Secure Orchard",
      publicProfileRoles: ["grower"],
      growerVerified: true,
      kycByRole: {
        grower: {
          status: "APPROVED",
          district: "Shimla",
          state: "Himachal Pradesh",
          panNumber: "ABCDE1234F",
          panImage: "https://private.example/pan.jpg",
        },
      },
    }, "grower");

    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("ABCDE1234F");
    expect(serialized).not.toContain("pan.jpg");
    expect(profile).not.toHaveProperty("panNumber");
    expect(profile).not.toHaveProperty("panImage");
  });

  it("loads secure KYC only for req.user.id and ignores another requested user id", async () => {
    const owner = {
      _id: "owner-1",
      role: "buyer",
      profileTypes: ["buyer"],
      kyc: {},
      kycByRole: {
        buyer: {
          roleType: "buyer",
          status: "APPROVED",
          panNumber: "ABCDE1234F",
          panImage: "secure/pan-card",
        },
      },
    };
    const select = vi.fn().mockResolvedValue(owner);
    const findById = vi.spyOn(User, "findById").mockReturnValue({ select });
    vi.spyOn(VerificationRemark, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await getMyKyc(
      { user: { id: "owner-1" }, query: { roleType: "buyer", userId: "other-user" } },
      res
    );

    expect(findById).toHaveBeenCalledWith("owner-1");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      kyc: expect.objectContaining({ panNumber: "ABCDE1234F" }),
    }));
  });

  it("returns canonical lot-listing authorization for an approved grower", async () => {
    const owner = {
      _id: "grower-1",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
      growerVerified: true,
      kyc: {},
      kycByRole: {
        grower: {
          roleType: "grower",
          status: "APPROVED",
          panNumber: "ABCDE1234F",
          panImage: "secure/pan-card",
        },
      },
    };
    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockResolvedValue(owner),
    });
    vi.spyOn(VerificationRemark, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await getMyKyc(
      {
        user: { id: "grower-1" },
        query: { roleType: "grower", authorizationOnly: "1" },
      },
      res
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      eligibility: {
        status: "APPROVED",
        approved: true,
        panComplete: true,
        eligible: true,
      },
      lotListingAuthorization: {
        allowed: true,
        code: "AUTHORIZED",
        message: "",
      },
    }));
    const authorizationPayload = res.json.mock.calls[0][0];
    expect(authorizationPayload.user.identityRef).toBe("grower-1");
    const serialized = JSON.stringify(authorizationPayload);
    expect(serialized).not.toContain("ABCDE1234F");
    expect(serialized).not.toContain("secure/pan-card");
    expect(authorizationPayload).not.toHaveProperty("kyc");
    expect(authorizationPayload.user).not.toHaveProperty("phone");
    expect(authorizationPayload.user).not.toHaveProperty("email");
  });
});
