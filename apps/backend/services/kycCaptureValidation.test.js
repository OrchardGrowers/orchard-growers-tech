import { describe, it, expect, vi } from "vitest";
import { validateNewKycCaptures } from "./kycCaptureValidation.js";
import { checkCaptureQuality } from "../../efruitmandi-frontend/src/utils/kycCaptureQuality.mjs";
const doc = { label: "pan", captureMethod: "live-camera", documentType: "PAN Card", mimeType: "image/jpeg", sizeBytes: 1000, publicId: "efruitmandi/kyc/buyer/u/pan", url: "https://res.cloudinary.com/demo/image/authenticated/v1/pan.jpg" };
const asset = { type: "authenticated", resource_type: "image", format: "jpg", bytes: 1000, width: 1280, height: 960, secure_url: doc.url };
const check = (document = doc, lookup = async () => asset, extra = {}) => validateNewKycCaptures({ roleType: "buyer", userId: "u", body: { documents: [document] }, ...extra }, lookup, async () => {});
describe("KYC camera validation", () => {
  it("accepts provider-verified captures for both roles", async () => {
    await check();
    await check({ ...doc, publicId: "efruitmandi/kyc/grower/u/pan" }, undefined, { roleType: "grower" });
  });
  it.each([{ captureMethod: undefined }, { documentType: "Passport" }, { label: "unknown" }, { mimeType: "application/pdf" }, { sizeBytes: 11000000 }, { publicId: "someone-else" }])("rejects invalid submission %j", async (change) => { await expect(check({ ...doc, ...change })).rejects.toThrow(); });
  it.each([{ type: "upload" }, { bytes: 11000000 }, { width: 200 }, { format: "pdf" }, { secure_url: "other" }])("rejects invalid stored asset %j", async (change) => { await expect(check(doc, async () => ({ ...asset, ...change }))).rejects.toThrow(); });
  it("rejects mismatched ID, GST without number and offline multipart", async () => {
    await expect(check({ ...doc, label: "idProof", documentType: "Passport" })).rejects.toThrow("does not match");
    await expect(check({ ...doc, label: "gstCertificate", documentType: "GST Certificate" })).rejects.toThrow("GST number");
    await expect(check(doc, undefined, { files: { panImage: [{}] } })).rejects.toThrow("live camera");
  });
  it("preserves historical records without provider lookup", async () => {
    const old = { label: "pan", url: "old.pdf" }; const lookup = vi.fn();
    await check(old, lookup, { existingKyc: { documents: [old] } }); expect(lookup).not.toHaveBeenCalled();
  });
  it("does not change driver behavior", async () => { await check({}, undefined, { roleType: "driver" }); });
  it("rejects low resolution, darkness, glare and blank/blurred frames", () => {
    const frame = (v) => ({ width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4).fill(v) });
    expect(checkCaptureQuality(frame(100), 320, 240)).toMatch(/resolution/);
    expect(checkCaptureQuality(frame(0), 1280, 960)).toBe("Improve lighting");
    expect(checkCaptureQuality(frame(255), 1280, 960)).toBe("Reduce glare");
    expect(checkCaptureQuality(frame(120), 1280, 960)).toMatch(/blurred/);
    const sharp = frame(100); for (let i = 0; i < sharp.data.length; i += 4) { const v = ((i / 4) % 3) * 80; sharp.data.fill(v, i, i + 3); }
    expect(checkCaptureQuality(sharp, 1280, 960)).toBe("");
  });
});


describe("server-side OCR integration", () => {
  it("runs content matching after provider validation and propagates mismatch", async () => {
    const verify = vi.fn().mockRejectedValue(Object.assign(new Error("Captured document does not match the selected document type. Please recapture the correct document."), { statusCode: 400 }));
    await expect(validateNewKycCaptures({ roleType: "buyer", userId: "u", body: { documents: [doc] } }, async () => asset, verify)).rejects.toMatchObject({ statusCode: 400 });
    expect(verify).toHaveBeenCalledWith(asset, "PAN Card");
  });
  it("never runs OCR for historical records, drivers or invalid images", async () => {
    const verify = vi.fn();
    await validateNewKycCaptures({ roleType: "driver" }, undefined, verify);
    await validateNewKycCaptures({ roleType: "buyer", body: { documents: [doc] }, existingKyc: { documents: [doc] } }, undefined, verify);
    await expect(validateNewKycCaptures({ roleType: "buyer", userId: "u", body: { documents: [doc] } }, async () => ({ ...asset, width: 100 }), verify)).rejects.toThrow();
    expect(verify).not.toHaveBeenCalled();
  });
});
