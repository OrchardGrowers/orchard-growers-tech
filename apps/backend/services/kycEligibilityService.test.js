import { describe, expect, it } from "vitest";
import {
  getKycEligibility,
  getPanValidationErrors,
  hasTransactionEligibleKyc,
  normalizePanNumber,
  validateKycSubmission,
} from "./kycEligibilityService.js";

const completeKyc = (overrides = {}) => ({
  roleType: "buyer",
  status: "APPROVED",
  fullName: "Buyer Account",
  phone: "9876543210",
  address: "Business premises",
  pinCode: "171001",
  idProofType: "Aadhaar",
  idProofNumber: "123456789012",
  idProofImage: "secure/id-proof",
  panNumber: "ABCDE1234F",
  panImage: "secure/pan-card",
  accountNumber: "1234567890",
  ifscCode: "SBIN0000123",
  bankAccountHolderName: "Buyer Account",
  bankName: "State Bank",
  passbookFileUrl: "secure/passbook",
  ...overrides,
});

describe("mandatory PAN KYC eligibility", () => {
  it("blocks KYC submission when PAN number is missing", () => {
    expect(validateKycSubmission(completeKyc({ panNumber: "" }), "buyer")).toMatchObject({
      panNumber: "PAN Number is required.",
    });
  });

  it("blocks KYC submission when PAN card is missing", () => {
    expect(validateKycSubmission(completeKyc({ panImage: "" }), "grower")).toMatchObject({
      panImage: "PAN Card document is required.",
    });
  });

  it("rejects invalid PAN and normalizes lowercase PAN", () => {
    expect(getPanValidationErrors(completeKyc({ panNumber: "INVALID" }), "buyer").panNumber).toMatch(/valid PAN/);
    expect(normalizePanNumber(" abcde1234f ")).toBe("ABCDE1234F");
  });

  it("accepts valid PAN number and document", () => {
    expect(validateKycSubmission(completeKyc(), "buyer")).toEqual({});
  });

  it("does not trust an existing verified flag when PAN is incomplete", () => {
    const user = {
      buyerVerified: true,
      kycByRole: { buyer: completeKyc({ panImage: "" }) },
    };
    expect(getKycEligibility(user, "buyer")).toMatchObject({
      approved: true,
      panUpdateRequired: true,
      eligible: false,
    });
    expect(hasTransactionEligibleKyc(user, "buyer")).toBe(false);
  });

  it("keeps driver eligibility backward compatible because PAN is not mandated for that role", () => {
    const user = {
      driverVerified: true,
      kycByRole: { driver: { roleType: "driver", status: "APPROVED" } },
    };
    expect(hasTransactionEligibleKyc(user, "driver")).toBe(true);
  });
});
