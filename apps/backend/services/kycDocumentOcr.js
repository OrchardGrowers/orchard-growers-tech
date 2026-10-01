import { reviewReadablePdf } from "./kycPdfReview.js";
import { tmpdir } from "node:os";
import axios from "axios";
import sharp from "sharp";
import { getCloudinaryPrivateDownloadUrls } from "./cloudinaryService.js";
import { matchKycDocument, extractKycFields, MISMATCH, UNREADABLE } from "./kycDocumentMatching.js";

let worker;
let queue = Promise.resolve();
let pending = 0;
let idleTimer;
const fail = (message = UNREADABLE) => Object.assign(new Error(message), { statusCode: 400 });
const dispose = async () => {
  const current = worker;
  worker = undefined;
  if (current) await current.terminate().catch(() => {});
};

// One serialized local worker, bounded queue and idle cleanup. No OCR text is
// persisted, logged, attached to metadata or returned to the caller.
export function verifyKycDocumentContent(asset, expected) {
  if (pending >= 4) return Promise.reject(fail());
  pending++;
  clearTimeout(idleTimer);
  const job = queue.then(async () => {
    let timer;
    let cancelled = false;
    try {
      const work = async () => {
        const urls = getCloudinaryPrivateDownloadUrls(asset.secure_url);
        let response;
        for (const url of urls) {
          try { response = await axios.get(url, { responseType: "arraybuffer", timeout: 12000, maxContentLength: 10 * 1024 * 1024, maxRedirects: 0 }); break; } catch { if (cancelled) throw fail(); }
        }
        if (!response) throw fail();
        const bytes = Buffer.from(response.data);
        if (asset.resource_type === "raw") {
          if (!["GST Certificate", "Trade Licence"].includes(expected) || bytes.subarray(0,5).toString() !== "%PDF-") throw fail();
          return reviewReadablePdf(bytes, expected);
        }
        const metadata = await sharp(bytes, {limitInputPixels:25000000}).metadata();
        if (!["jpeg", "png"].includes(metadata.format)) throw fail();
        if (expected === "Live Face Capture") {
          // This validates the final stored image, not identity or browser movement.
          if(metadata.format!=="jpeg" || Math.min(metadata.width||0,metadata.height||0)<720)throw fail();
          await sharp(bytes,{limitInputPixels:25000000}).stats();
          return {match:"match",fields:{}};
        }
        const image = await sharp(response.data, { limitInputPixels: 25000000 }).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).grayscale().normalize().png().toBuffer();
        if (cancelled) throw fail();
        if (!worker) {
          const { createWorker } = await import("tesseract.js");
          const created = await createWorker("eng", 1, { cachePath: tmpdir(), logger: () => {}, errorHandler: () => {} });
          if (cancelled) { await created.terminate(); throw fail(); }
          worker = created;
        }
        const { data } = await worker.recognize(image);
        return { match: matchKycDocument(expected, data), fields: extractKycFields(expected, data) };
      };
      const result = await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => { cancelled = true; reject(fail()); }, 45000); })]);
      if (result.match !== "match") throw fail(result.match === "mismatch" ? MISMATCH : UNREADABLE);
      return result.fields;
    } catch (error) {
      await dispose();
      const optional = ["GST Certificate", "Trade Licence"].includes(expected);
      throw fail(error.message === MISMATCH ? `Wrong document detected. Please ${optional ? "scan or upload" : "capture"} your ${expected}.` : optional ? "Document could not be read. Please scan or upload a clearer image or a readable text PDF (maximum 5 pages)." : UNREADABLE);
    } finally {
      clearTimeout(timer);
    }
  });
  queue = job.catch(() => {}).finally(() => {
    pending--;
    if (!pending) { idleTimer = setTimeout(() => { void dispose(); }, 30000); idleTimer.unref?.(); }
  });
  return job;
}
