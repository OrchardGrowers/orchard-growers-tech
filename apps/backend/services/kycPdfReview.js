import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { matchKycDocument, extractKycFields } from "./kycDocumentMatching.js";

// Bound PDF parsing separately from the API thread. Only structured results
// leave this worker; image-only/encrypted/unreadable PDFs fail closed.
export function reviewReadablePdf(bytes, expected) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { kycPdfReview: true, bytes, expected }, execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128 }, stdout: true, stderr: true,
    });
    worker.stdout.resume(); worker.stderr.resume();
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Unreadable PDF")); }, 15000);
    const finish = (result) => { clearTimeout(timer); void worker.terminate(); result?.error ? reject(new Error("Unreadable PDF")) : resolve(result); };
    worker.once("message", finish);
    worker.once("error", () => finish({error:true}));
    worker.once("exit", () => { clearTimeout(timer); reject(new Error("PDF worker closed")); });
  });
}
if (!isMainThread && workerData?.kycPdfReview) {
  try {
    const { default: parse } = await import("pdf-parse/lib/pdf-parse.js");
    const result = await parse(Buffer.from(workerData.bytes), { max: 5, version: "v2.0.550" });
    if (!result.text?.trim() || result.text.length > 100000 || result.numpages > 5) throw new Error();
    const data = {text:result.text,confidence:100};
    parentPort.postMessage({match:matchKycDocument(workerData.expected,data),fields:extractKycFields(workerData.expected,data)});
  } catch { parentPort.postMessage({error:true}); }
}
