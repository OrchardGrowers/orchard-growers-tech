import express from "express";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import productRoutes from "./productRoutes.js";

const originalJwtSecret = process.env.JWT_SECRET;
const originalAllowTestOtp = process.env.ALLOW_TEST_OTP;
const completeGrowerKyc = (status = "APPROVED") => ({
  roleType: "grower",
  status,
  panNumber: "ABCDE1234F",
  panImage: "secure/pan.jpg",
});

const requestProductCreate = async (user = null) => {
  if (user) {
    vi.spyOn(User, "findById").mockImplementation(() => ({
      select: vi.fn().mockResolvedValue(user),
    }));
  }

  const app = express();
  app.use(express.json());
  app.use("/products", productRoutes);
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
  });

  try {
    const address = server.address();
    const token = user
      ? jwt.sign({ id: String(user._id || "64b000000000000000000001"), role: user.role }, process.env.JWT_SECRET)
      : "";
    const response = await fetch(`http://127.0.0.1:${address.port}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

beforeEach(() => {
  process.env.JWT_SECRET = "lot-listing-test-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (originalAllowTestOtp === undefined) delete process.env.ALLOW_TEST_OTP;
  else process.env.ALLOW_TEST_OTP = originalAllowTestOtp;
});

describe("direct POST /products authorization", () => {
  it("rejects an unauthenticated visitor", async () => {
    await expect(requestProductCreate()).resolves.toMatchObject({ status: 401 });
  });

  it.each([
    ["generic user", { _id: "64b000000000000000000001", role: null, activeRole: "", profileTypes: [] }],
    ["buyer", { _id: "64b000000000000000000002", role: "buyer", activeRole: "buyer", profileTypes: ["buyer"] }],
    ["active buyer with verified grower profile", {
      _id: "64b000000000000000000003",
      role: "buyer",
      activeRole: "buyer",
      profileTypes: ["buyer", "grower"],
      growerVerified: true,
      kycByRole: { grower: completeGrowerKyc() },
    }],
  ])("rejects %s", async (_label, user) => {
    await expect(requestProductCreate(user)).resolves.toMatchObject({
      status: 403,
      body: { code: "GROWER_REQUIRED", msg: "Only verified growers can list fruit lots." },
    });
  });

  it.each([
    ["incomplete", "NOT_SUBMITTED", "KYC_INCOMPLETE", "Please complete your KYC to list a fruit lot."],
    ["pending", "PENDING", "KYC_APPROVAL_REQUIRED", "Your KYC must be approved before you can list a fruit lot."],
    ["rejected", "REJECTED", "KYC_INCOMPLETE", "Please complete your KYC to list a fruit lot."],
  ])("rejects a grower with %s KYC", async (_label, status, code, msg) => {
    const user = {
      _id: "64b000000000000000000004",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
      kycByRole: status === "NOT_SUBMITTED" ? {} : { grower: completeGrowerKyc(status) },
    };
    await expect(requestProductCreate(user)).resolves.toMatchObject({ status: 403, body: { code, msg } });
  });

  it("does not let a stale verified flag override pending canonical KYC status", async () => {
    const user = {
      _id: "64b000000000000000000006",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
      growerVerified: true,
      kycByRole: { grower: completeGrowerKyc("PENDING") },
    };
    await expect(requestProductCreate(user)).resolves.toMatchObject({
      status: 403,
      body: {
        code: "KYC_APPROVAL_REQUIRED",
        msg: "Your KYC must be approved before you can list a fruit lot.",
      },
    });
  });

  it("does not bypass KYC for a development test account", async () => {
    process.env.ALLOW_TEST_OTP = "true";
    const user = {
      _id: "64b000000000000000000007",
      email: "testgrower@efruitmandi.live",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
      kycByRole: { grower: completeGrowerKyc("PENDING") },
    };
    await expect(requestProductCreate(user)).resolves.toMatchObject({
      status: 403,
      body: { code: "KYC_APPROVAL_REQUIRED" },
    });
  });

  it("passes authorization only for a canonically eligible approved grower", async () => {
    const user = {
      _id: "64b000000000000000000005",
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
      kycByRole: { grower: completeGrowerKyc("APPROVED") },
    };
    const result = await requestProductCreate(user);
    expect(result.status).toBe(400);
    expect(result.body.msg).toMatch(/Title, fruit, variety/);
  });
});
