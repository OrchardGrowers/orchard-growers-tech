import { useEffect, useRef, useState } from "react";
import { inspectDocumentFrame, CAPTURE_GUIDANCE, canUseCapture } from "../utils/kycCaptureQuality.mjs";

export default function KycCameraCapture({ disabled, documentTypes, onCapture }) {
  const video = useRef(null);
  const stream = useRef(null);
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const stable = useRef({ count: 0, bounds: null });
  const [detected, setDetected] = useState(false);
  const [busy, setBusy] = useState(false);
  const typesKey = documentTypes.join("|");
  const stop = () => { generation.current++; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
  useEffect(() => () => stop(), []);
  useEffect(() => { stop(); setOpen(false); setPreview(null); setDetected(false); setDocumentType(typesKey.split("|")[0]); }, [typesKey]);
  useEffect(() => { if (disabled) { stop(); setOpen(false); } }, [disabled]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { stop(); setOpen(false); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const start = async () => {
    stop(); const request = generation.current;
    setPreview(null); setDetected(false); stable.current = { count: 0, bounds: null }; setOpen(true); setMessage("Move document inside frame");
    setDocumentType(documentTypes[0]);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
      if (request !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    } catch { if (request === generation.current) { stop(); setMessage("Camera unavailable. Allow camera access on HTTPS and retry."); } }
  };
  useEffect(() => {
    if (!open || preview) return undefined;
    const interval = setInterval(() => {
      const v = video.current;
      if (!v?.videoWidth || !stream.current || busy) return;
      const sample = document.createElement("canvas"); sample.width = 320; sample.height = Math.round(320*v.videoHeight/v.videoWidth);
      const ctx = sample.getContext("2d"); ctx.drawImage(v,0,0,sample.width,sample.height);
      const result = inspectDocumentFrame(ctx.getImageData(0,0,sample.width,sample.height),v.videoWidth,v.videoHeight);
      const prior = stable.current.bounds;
      const steady = result.bounds && prior && ["x","y","width","height"].every((key) => Math.abs(result.bounds[key]-prior[key]) < .025);
      stable.current = { bounds:result.bounds, count: result.error ? 0 : steady ? stable.current.count+1 : 1 };
      setDetected(!result.error && stable.current.count >= 3);
      setMessage(result.error || (stable.current.count >= 3 ? "Document detected" : "Hold steady"));
    }, 500);
    return () => clearInterval(interval);
  }, [open, preview, busy]);
  const capture = async () => {
    const v = video.current;
    if (!v?.videoWidth || !stream.current || busy || !detected) return;
    setBusy(true); setMessage("Checking image...");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      canvas.getContext("2d").drawImage(v, 0, 0);
      const sample = document.createElement("canvas"); sample.width = 320; sample.height = Math.round(320 * canvas.height / canvas.width);
      const ctx = sample.getContext("2d"); ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
      const { error, bounds } = inspectDocumentFrame(ctx.getImageData(0, 0, sample.width, sample.height), canvas.width, canvas.height);
      if (error) { setMessage(error); return; }
      const cropped = document.createElement("canvas");
      cropped.width = Math.round(canvas.width*bounds.width); cropped.height = Math.round(canvas.height*bounds.height);
      cropped.getContext("2d").drawImage(canvas,canvas.width*bounds.x,canvas.height*bounds.y,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
      const request = generation.current;
      const blob = await new Promise((resolve) => cropped.toBlob(resolve, "image/jpeg", 0.9));
      if (request !== generation.current) return;
      if (!blob || blob.size > 10 * 1024 * 1024) { setMessage("Retake: image is too large"); return; }
      setPreview({ blob, url: URL.createObjectURL(blob), checked: true, documentType }); stop(); setMessage("Captured. Document type will be checked when KYC is submitted.");
    } catch { setMessage("Unable to capture. Retake the document."); } finally { setBusy(false); }
  };
  const buttonStyle = "mt-2 rounded-md bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50";
  return <span className="block" onClick={(event) => event.stopPropagation()}>
    {!open ? <button type="button" disabled={disabled} className={buttonStyle} onClick={start}>Open camera</button> : <span className="block">
      {documentTypes.length > 1 && <select disabled={Boolean(preview)} aria-label="Document type" value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-2 rounded border p-2">{documentTypes.map((type) => <option key={type}>{type}</option>)}</select>}
      <span className="block text-xs">{CAPTURE_GUIDANCE[documentType]} Keep all 4 corners visible, text in focus and information uncovered. Avoid glare/shadows.</span>
      <span className="relative mt-2 block">
        {preview ? <img src={preview.url} alt="Captured document" className="w-full" /> : <video ref={video} muted playsInline className="w-full" />}
        <span aria-hidden="true" className="pointer-events-none absolute inset-[5%] rounded border-2 border-amber-500" />
      </span>
      <span role="status" className="block text-xs">{message}</span>
      {preview ? <>

        <button type="button" className={buttonStyle} onClick={start}>Retake</button>{" "}
        <button type="button" className={buttonStyle} disabled={!canUseCapture({ checked: preview.checked, busy, disabled, expected: documentType, capturedType: preview.documentType })} onClick={() => {
          const file = new File([preview.blob], "kyc-capture.jpg", { type: "image/jpeg" });
          file.captureMethod = "live-camera"; file.documentType = documentType;
          onCapture(file); setPreview(null); setOpen(false);
        }}>Use capture</button>
      </> : <button type="button" className={buttonStyle} disabled={busy || disabled || !detected} onClick={capture}>Capture</button>}{" "}
      <button type="button" className={buttonStyle} onClick={() => { stop(); setPreview(null); setOpen(false); }}>Cancel</button>
    </span>}
  </span>;
}
