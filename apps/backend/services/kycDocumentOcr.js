import { tmpdir } from "node:os";
import axios from "axios";
import sharp from "sharp";
import { getCloudinaryPrivateDownloadUrls } from "./cloudinaryService.js";
import { matchKycDocument, MISMATCH, UNREADABLE } from "./kycDocumentMatching.js";

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
        const url = getCloudinaryPrivateDownloadUrls(asset.secure_url)[0];
        if (!url) throw fail();
        const response = await axios.get(url, { responseType: "arraybuffer", timeout: 12000, maxContentLength: 10 * 1024 * 1024, maxRedirects: 0 });
        const image = await sharp(response.data, { limitInputPixels: 25000000 }).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).grayscale().normalize().png().toBuffer();
        if (cancelled) throw fail();
        if (!worker) {
          const { createWorker } = await import("tesseract.js");
          const created = await createWorker("eng", 1, { cachePath: tmpdir(), logger: () => {}, errorHandler: () => {} });
          if (cancelled) { await created.terminate(); throw fail(); }
          worker = created;
        }
        const { data } = await worker.recognize(image);
        return matchKycDocument(expected, data);
      };
      const result = await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => { cancelled = true; reject(fail()); }, 45000); })]);
      if (result !== "match") throw fail(result === "mismatch" ? MISMATCH : UNREADABLE);
    } catch (error) {
      await dispose();
      throw fail(error.message === MISMATCH ? MISMATCH : UNREADABLE);
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
