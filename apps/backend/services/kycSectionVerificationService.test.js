import { describe, expect, it } from "vitest";
import {
  assertKycSectionEditable,
  buildKycSectionStates,
  getKycSectionPayloadViolations,
  getKycSectionsForRole,
  KYC_LOCKED_MESSAGE,
  validateKycSection,
} from "./kycSectionVerificationService.js";

const completeBuyerKyc = {
  roleType: "buyer",
  status: "APPROVED",
  fullName: "Buyer",
  phone: "9876543210",
  address: "Buyer premises",
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
};

const event = (section, status, options = {}) => ({
  _id: `${section}-${status}`,
  section,
  status,
  source: options.source || "ADMIN",
  remark: options.remark || "",
  createdAt: options.createdAt || new Date("2026-08-08T10:00:00.000Z"),
  resolvedAt: options.resolvedAt ?? null,
});

describe("KYC section verification state", () => {
  it("reopens only rejected Aadhaar/identity while verified PAN remains locked", () => {
    const states = buildKycSectionStates({
      roleType: "buyer",
      kyc: completeBuyerKyc,
      entries: [
        event("identity", "CHANGES_REQUIRED", { remark: "Aadhaar image is blurred." }),
        event("pan", "VERIFIED"),
        event("personal", "VERIFIED"),
        event("bank", "VERIFIED"),
      ],
    });

    expect(states.identity).toMatchObject({ status: "CHANGES_REQUIRED", editable: true });
    expect(states.identity.latestRemark.remark).toBe("Aadhaar image is blurred.");
    expect(states.pan).toMatchObject({ status: "VERIFIED", editable: false });
  });

  it("preserves review history and uses the latest resubmission state", () => {
    const states = buildKycSectionStates({
      roleType: "buyer",
      kyc: { ...completeBuyerKyc, status: "PENDING" },
      entries: [
        event("identity", "PENDING", { source: "USER", createdAt: new Date("2026-08-08T12:00:00.000Z") }),
        event("identity", "CHANGES_REQUIRED", { remark: "Image blurred.", createdAt: new Date("2026-08-08T11:00:00.000Z") }),
        event("identity", "VERIFIED", { createdAt: new Date("2026-08-08T10:00:00.000Z") }),
      ],
    });

    expect(states.identity).toMatchObject({ status: "PENDING", editable: false, latestRemark: null });
    expect(states.identity.history).toHaveLength(3);
  });

  it("allows a previously verified PAN section to be reopened without unlocking other sections", () => {
    const states = buildKycSectionStates({
      roleType: "buyer",
      kyc: completeBuyerKyc,
      entries: [
        event("pan", "CHANGES_REQUIRED", { remark: "PAN card is unreadable." }),
        event("identity", "VERIFIED"),
      ],
    });

    expect(states.pan.editable).toBe(true);
    expect(states.identity.editable).toBe(false);
    expect(states.bank).toMatchObject({ status: "VERIFIED", editable: false });
    expect(states.pan.actionUrl).toBe("/kyc#pan");
  });

  it("rejects direct edits to verified and under-review sections", () => {
    expect(() => assertKycSectionEditable({ status: "VERIFIED", editable: false })).toThrow(KYC_LOCKED_MESSAGE);
    expect(() => assertKycSectionEditable({ status: "UNDER_REVIEW", editable: false })).toThrow(KYC_LOCKED_MESSAGE);
  });

  it("enforces editability for every section lifecycle state", () => {
    const states = Object.fromEntries(
      ["PENDING", "UNDER_REVIEW", "CHANGES_REQUIRED", "REJECTED", "VERIFIED"].map((status) => {
        const result = buildKycSectionStates({
          roleType: "buyer",
          kyc: { ...completeBuyerKyc, status: "PENDING" },
          entries: [event("bank", status)],
        });
        return [status, result.bank.editable];
      })
    );
    expect(states).toEqual({
      PENDING: false,
      UNDER_REVIEW: false,
      CHANGES_REQUIRED: true,
      REJECTED: true,
      VERIFIED: false,
    });
  });

  it("rejects fields and files outside the reopened section", () => {
    expect(getKycSectionPayloadViolations({
      section: "identity",
      body: { idProofNumber: "123456789012", panNumber: "ABCDE1234F" },
      files: { panImage: [{}] },
    })).toEqual(["panNumber", "panImage"]);
  });

  it("validates only the resubmitted section", () => {
    const kyc = { ...completeBuyerKyc, idProofImage: "", panNumber: "" };
    expect(validateKycSection(kyc, "buyer", "identity")).toEqual({ idProof: "ID proof image is required." });
    expect(validateKycSection(kyc, "buyer", "pan")).toEqual({ panNumber: "PAN Number is required." });
  });

  it("uses the smallest applicable role sections", () => {
    expect(getKycSectionsForRole("buyer")).toEqual(["personal", "identity", "pan", "bank"]);
    expect(getKycSectionsForRole("grower")).toEqual(["personal", "identity", "pan", "bank", "business"]);
    expect(getKycSectionsForRole("driver")).toEqual(["personal", "identity", "bank", "driver"]);
  });
});
