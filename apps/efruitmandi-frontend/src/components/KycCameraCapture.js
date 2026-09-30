import { useEffect, useRef, useState } from "react";
import { checkCaptureQuality } from "../utils/kycCaptureQuality.mjs";

export default function KycCameraCapture({ disabled, documentTypes, onCapture }) {
  const video = useRef(null);
  const stream = useRef(null);
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [fits, setFits] = useState(false);
  const [busy, setBusy] = useState(false);
  const stop = () => { generation.current++; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
  useEffect(() => () => stop(), []);
  useEffect(() => { if (disabled) { stop(); setOpen(false); } }, [disabled]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { stop(); setOpen(false); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const start = async () => {
    stop(); const request = generation.current;
    setPreview(null); setFits(false); setOpen(true); setMessage("Move document inside frame");
    setDocumentType(documentTypes[0]);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
      if (request !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    } catch { if (request === generation.current) { stop(); setMessage("Camera unavailable. Allow camera access on HTTPS and retry."); } }
  };
  const capture = async () => {
    const v = video.current;
    if (!v?.videoWidth || !stream.current || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      canvas.getContext("2d").drawImage(v, 0, 0);
      const sample = document.createElement("canvas"); sample.width = 320; sample.height = Math.round(320 * canvas.height / canvas.width);
      const ctx = sample.getContext("2d"); ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
      const error = checkCaptureQuality(ctx.getImageData(0, 0, sample.width, sample.height), canvas.width, canvas.height);
      if (error) { setMessage(error); return; }
      const request = generation.current;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (request !== generation.current) return;
      if (!blob || blob.size > 10 * 1024 * 1024) { setMessage("Retake: image is too large"); return; }
      setPreview({ blob, url: URL.createObjectURL(blob) }); stop(); setMessage("Document ready");
    } catch { setMessage("Unable to capture. Retake the document."); } finally { setBusy(false); }
  };
  const buttonStyle = "mt-2 rounded-md bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50";
  return <span className="block" onClick={(event) => event.stopPropagation()}>
    {!open ? <button type="button" disabled={disabled} className={buttonStyle} onClick={start}>Open camera</button> : <span className="block">
      {documentTypes.length > 1 && <select aria-label="Document type" value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-2 rounded border p-2">{documentTypes.map((type) => <option key={type}>{type}</option>)}</select>}
      <span className="relative mt-2 block">
        {preview ? <img src={preview.url} alt="Captured document" className="w-full" /> : <video ref={video} muted playsInline className="w-full" />}
        <span aria-hidden="true" className="pointer-events-none absolute inset-[5%] rounded border-2 border-green-500" />
      </span>
      <span role="status" className="block text-xs">{message}</span>
      {preview ? <>
        <label className="block text-xs"><input type="checkbox" checked={fits} onChange={(event) => setFits(event.target.checked)} /> All corners are visible, text is readable, and the document fills the frame.</label>
        <button type="button" className={buttonStyle} onClick={start}>Retake</button>{" "}
        <button type="button" className={buttonStyle} disabled={!fits || disabled} onClick={() => {
          const file = new File([preview.blob], "kyc-capture.jpg", { type: "image/jpeg" });
          file.captureMethod = "live-camera"; file.documentType = documentType;
          onCapture(file); setPreview(null); setOpen(false);
        }}>Use capture</button>
      </> : <button type="button" className={buttonStyle} disabled={busy || disabled} onClick={capture}>Capture</button>}{" "}
      <button type="button" className={buttonStyle} onClick={() => { stop(); setPreview(null); setOpen(false); }}>Cancel</button>
    </span>}
  </span>;
}
