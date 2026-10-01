import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), recognize: vi.fn(), terminate: vi.fn(), create: vi.fn() }));
vi.mock("axios", () => ({ default: { get: mocks.get } }));
vi.mock("./cloudinaryService.js", () => ({ getCloudinaryPrivateDownloadUrls: () => ["https://example.invalid/private"] }));
vi.mock("tesseract.js", () => ({ createWorker: mocks.create }));
import sharp from "sharp";
import { verifyKycDocumentContent } from "./kycDocumentOcr.js";
afterEach(() => vi.useRealTimers());
it("validates only the final face JPEG without invoking document OCR", async () => {
  const before = mocks.recognize.mock.calls.length;
  const image = await sharp({ create: { width: 800, height: 800, channels: 3, background: "white" } }).jpeg().toBuffer();
  mocks.get.mockResolvedValue({ data: image });
  await expect(verifyKycDocumentContent({ secure_url: "private" }, "Live Face Capture")).resolves.toEqual({});
  for (const data of [Buffer.from("invalid"), await sharp(image).png().toBuffer(), await sharp(image).resize(200).jpeg().toBuffer()]) {
    mocks.get.mockResolvedValue({ data });
    await expect(verifyKycDocumentContent({ secure_url: "private" }, "Live Face Capture")).rejects.toThrow();
  }
  expect(mocks.recognize).toHaveBeenCalledTimes(before);
});
it("reuses the worker, hides OCR failures and cleans up after idle", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const image = await sharp({ create: { width: 800, height: 800, channels: 3, background: "white" } }).jpeg().toBuffer();
  mocks.get.mockResolvedValue({ data: image });
  mocks.terminate.mockResolvedValue();
  mocks.create.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
  mocks.recognize.mockResolvedValue({ data: { text: "INCOME TAX PERMANENT ACCOUNT NUMBER ABCDE1234F", confidence: 95 } });
  await verifyKycDocumentContent({ secure_url: "private" }, "PAN Card");
  await verifyKycDocumentContent({ secure_url: "private" }, "PAN Card");
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.recognize).toHaveBeenCalledTimes(2);
  mocks.recognize.mockRejectedValueOnce(new Error("PRIVATE OCR CONTENT"));
  await expect(verifyKycDocumentContent({ secure_url: "private" }, "PAN Card")).rejects.toThrow("Document text could not be read clearly");
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
  await verifyKycDocumentContent({ secure_url: "private" }, "PAN Card");
  await vi.advanceTimersByTimeAsync(30000);
  expect(mocks.terminate).toHaveBeenCalledTimes(2);
});
