import { afterEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import VerificationRemark from "../models/VerificationRemark.js";
import { getMyKyc, toPublicProfile } from "./userController.js";

afterEach(() => vi.restoreAllMocks());

describe("PAN data access boundaries", () => {
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
});
