import { afterEach, describe, expect, it, vi } from "vitest";
import Product from "../models/Product.js";
import {
  canAccessNonPublicLot,
  getProductById,
  sanitizePublicGrowerVerification,
  sanitizePublicParty,
  serializeProduct,
} from "./productController.js";

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("product detail public access prerequisites", () => {
  it("returns 404 for a malformed ObjectId without querying MongoDB", async () => {
    const findById = vi.spyOn(Product, "findById");
    const res = createResponse();

    await getProductById({ params: { id: "not-an-object-id" }, query: {} }, res);

    expect(findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ msg: "Product not found" });
  });

  it("returns 500 when the product lookup fails", async () => {
    vi.spyOn(Product, "findById").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const res = createResponse();

    await getProductById({
      params: { id: "64b000000000000000000001" },
      query: { platform: "efruitmandi" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ msg: "database unavailable" });
  });

  it("recognizes the owner, accepted buyer, or an authenticated admin as a non-public viewer", () => {
    const product = {
      createdBy: "64b000000000000000000001",
      acceptedBuyerId: "64b000000000000000000003",
    };
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000001", role: "grower" })).toBe(true);
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000002", role: "ADMIN" })).toBe(true);
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000003", role: "buyer" })).toBe(true);
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000002", role: "buyer" })).toBe(false);
    expect(canAccessNonPublicLot(product, null)).toBe(false);
  });

  it("enforces private base pricing in the actual public Product serializer", () => {
    const product = {
      _id: "64b000000000000000000010",
      createdBy: "64b000000000000000000001",
      createdSource: "grower",
      basePrice: 125,
      finalPrice: 175,
    };
    expect(serializeProduct(product, null)).not.toHaveProperty("basePrice");
    expect(serializeProduct(product, { id: "buyer", role: "buyer" })).not.toHaveProperty("basePrice");
    expect(serializeProduct(product, { id: product.createdBy, role: "grower" }).basePrice).toBe(125);
    expect(serializeProduct(product, { id: "admin", role: "ADMIN" }).basePrice).toBe(125);
    expect(serializeProduct(product, null).finalPrice).toBe(175);
  });

  it("adds only the normalized Grower badge state to public marketplace parties", () => {
    const party = sanitizePublicGrowerVerification({
      _id: "64b000000000000000000001",
      role: "grower",
      orchardName: "Safe Orchard",
      phone: "9999999999",
      growerVerified: true,
      growerOgVerified: true,
      kycByRole: {
        grower: {
          status: "APPROVED",
          panNumber: "ABCDE1234F",
          panImage: "private-pan",
        },
      },
      ogVerificationByRole: {
        grower: { status: "APPROVED", requestId: "request-1", decidedAt: new Date() },
      },
    });

    expect(party.growerVerificationLevel).toBe("OG_VERIFIED");
    expect(party).not.toHaveProperty("kycByRole");
    expect(party).not.toHaveProperty("ogVerificationByRole");
    expect(party).not.toHaveProperty("growerVerified");
    expect(party).not.toHaveProperty("growerOgVerified");
    expect(party).not.toHaveProperty("phone");
    expect(JSON.stringify(party)).not.toContain("ABCDE1234F");
    expect(JSON.stringify(party)).not.toContain("private-pan");
  });

  it("shows the owner their record but gives buyers, other growers, and visitors the same sanitized history", () => {
    const historical = {
      _id: "64b000000000000000000010",
      createdBy: "64b000000000000000000001",
      fruitName: "Pear",
      variety: "Bartlett",
      quantity: 40,
      unit: "boxes",
      location: "Secret Road, Kullu, Himachal Pradesh, 175101",
      status: "EXPIRED",
      active: false,
      basePrice: 500,
      reservePrice: 600,
      acceptedBuyerId: "64b000000000000000000099",
      privateNotes: "do not publish",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-02T10:00:00.000Z",
    };

    const ownerView = serializeProduct(
      historical,
      { id: historical.createdBy, role: "grower" },
      null,
      { offerCount: 2 }
    );
    expect(ownerView).toMatchObject({
      _id: historical._id,
      basePrice: 500,
      historical: true,
      readOnly: true,
      tradable: false,
      offerCount: 2,
    });

    const publicViews = [
      serializeProduct(historical, { id: "buyer", role: "buyer" }, null, { offerCount: 2 }),
      serializeProduct(historical, { id: "other-grower", role: "grower" }, null, { offerCount: 2 }),
      serializeProduct(historical, null, null, { offerCount: 2 }),
    ];
    expect(publicViews[0]).toEqual(publicViews[1]);
    expect(publicViews[1]).toEqual(publicViews[2]);
    for (const view of publicViews) {
      expect(view).toMatchObject({
        fruitName: "Pear",
        variety: "Bartlett",
        offerCount: 2,
        historyOutcome: "No Deal Confirmed",
        readOnly: true,
        tradable: false,
      });
      expect(view).not.toHaveProperty("_id");
      expect(view).not.toHaveProperty("basePrice");
      expect(view).not.toHaveProperty("reservePrice");
      expect(view).not.toHaveProperty("acceptedBuyerId");
      expect(view).not.toHaveProperty("privateNotes");
    }
  });
});

describe("public party role boundary", () => {
  const buyer = {
    role: "buyer", profileTypes: ["buyer", "grower"], orchardName: "Other role orchard",
    buyerVerified: true, buyerOgVerified: true, isKycVerified: true, isOgVerified: false,
    isTrusted: true, growerVerificationLevel: "OG_VERIFIED",
    kycByRole: { buyer: { status: "APPROVED", panNumber: "ABCDE1234F", panImage: "secret" } },
    panNumber: "ABCDE1234F", panImage: "secret", phone: "secret", contact: "secret",
    email: "secret", bankDetails: { account: "secret" }, paymentDetails: "secret",
    adminNotes: "secret", accountNumber: "secret", unknownPrivateField: "secret",
  };
  it("preserves Buyer public flags and removes private fields and Grower state", () => {
    const result = sanitizePublicParty(buyer);
    expect(result).toMatchObject({ buyerVerified: true, buyerOgVerified: true, isKycVerified: true, isOgVerified: false, isTrusted: true });
    expect(result).not.toHaveProperty("growerVerificationLevel");
    expect(sanitizePublicGrowerVerification({ ...buyer, profileTypes: ["buyer"] })).not.toHaveProperty("growerVerificationLevel");
    expect(JSON.stringify(result)).not.toMatch(/secret|ABCDE1234F/);
    expect(sanitizePublicParty({ ...buyer, role: "grower" }, "buyer").role).toBe("buyer");
    expect(serializeProduct({ status: "LIVE", createdBy: { role: "grower" }, acceptedBuyerId: buyer }, null).acceptedBuyerId).toEqual(result);
  });
  it("preserves Buyer approval from an OG request without leaking its metadata", () => {
    const result = sanitizePublicParty({ ...buyer, ogVerificationByRole: { buyer: { requestId: "private-request", status: "APPROVED", adminNotes: "secret" } } });
    expect(result.ogVerified).toBe(true);
    expect(result).not.toHaveProperty("ogVerificationByRole");
  });
  it("never promotes Grower state from Buyer or ambiguous legacy KYC", () => {
    for (const kyc of [undefined, buyer.kycByRole.buyer, { ...buyer.kycByRole.buyer, roleType: "buyer" }]) {
      const result = sanitizePublicGrowerVerification({ ...buyer, kyc, growerVerified: true, growerOgVerified: true });
      expect(result.growerVerificationLevel).toBe("REGISTERED");
      expect(result).not.toHaveProperty("isKycVerified");
      expect(result).not.toHaveProperty("isOgVerified");
      expect(JSON.stringify(result)).not.toMatch(/secret|ABCDE1234F/);
    }
  });
});
