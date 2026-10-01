import KycScannerOverlay from "./KycScannerOverlay";
import { documentGuidance, scannerPresentation } from "../utils/kycScannerGuidance.mjs";
import { useEffect, useRef, useState } from "react";
import { inspectDocumentFrame, CAPTURE_GUIDANCE, canUseCapture, requestContinuousFocus, advanceScanner } from "../utils/kycCaptureQuality.mjs";

export default function KycCameraCapture({ disabled, documentTypes, onCapture, openLabel = "Open camera" }) {
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
  const [outline,setOutline]=useState(null);
  const [portrait,setPortrait]=useState(false);
  const [ratio,setRatio]=useState(4/3);
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
    setPreview(null); setOutline(null); setDetected(false); stable.current = { count: 0, bounds: null }; setOpen(true); setMessage("Show document");
    setDocumentType(documentTypes[0]);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
      if (request !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      await requestContinuousFocus(media.getVideoTracks()[0]);
      if (request !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
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
      const guidance=documentGuidance(result,{portrait});
      stable.current = advanceScanner(stable.current,{...result,error:guidance});
      const state=scannerPresentation(result,stable.current,{portrait});
      setRatio(v.videoWidth/v.videoHeight);setOutline(result.corners?{corners:result.corners,color:state.color}:null);
      setDetected(state.ready);setMessage(state.message);
    }, 500);
    return () => clearInterval(interval);
  }, [open, preview, busy, portrait]);
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
      const result = inspectDocumentFrame(ctx.getImageData(0, 0, sample.width, sample.height), canvas.width, canvas.height);
      const {bounds,rotation}=result;
      const error=documentGuidance(result,{portrait});
      stable.current=advanceScanner(stable.current,{...result,error});
      if (error || !stable.current.ready) { setDetected(false);setOutline(current=>current?{...current,color:"#f59e0b"}:null);setMessage(error || "Hold steady"); return; }
      const cropped = document.createElement("canvas");
      cropped.width = Math.round(canvas.width*bounds.width); cropped.height = Math.round(canvas.height*bounds.height);
      cropped.getContext("2d").drawImage(canvas,canvas.width*bounds.x,canvas.height*bounds.y,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
      let processed = cropped;
      if (rotation) {
        const angle=-rotation*Math.PI/180, adjusted=document.createElement("canvas");
        adjusted.width=Math.ceil(Math.abs(cropped.width*Math.cos(angle))+Math.abs(cropped.height*Math.sin(angle)));
        adjusted.height=Math.ceil(Math.abs(cropped.height*Math.cos(angle))+Math.abs(cropped.width*Math.sin(angle)));
        const context=adjusted.getContext("2d");context.fillStyle="white";context.fillRect(0,0,adjusted.width,adjusted.height);
        context.translate(adjusted.width/2,adjusted.height/2);context.rotate(angle);context.drawImage(cropped,-cropped.width/2,-cropped.height/2);processed=adjusted;
      }
      const request = generation.current;
      const blob = await new Promise((resolve) => processed.toBlob(resolve, "image/jpeg", 0.9));
      if (request !== generation.current) return;
      if (!blob || blob.size > 10 * 1024 * 1024) { setMessage("Retake: image is too large"); return; }
      setPreview({ blob, url: URL.createObjectURL(blob), checked: true, documentType }); stop(); setMessage("Captured. Process the document to read and review details.");
    } catch { setMessage("Unable to capture. Retake the document."); } finally { setBusy(false); }
  };
  const buttonStyle = "mt-2 rounded-md bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50";
  return <span className="block" onClick={(event) => event.stopPropagation()}>
    {!open ? <button type="button" disabled={disabled} className={buttonStyle} onClick={start}>{openLabel}</button> : <KycScannerOverlay onClose={() => { stop(); setPreview(null); setOpen(false); }} onOrientationChange={(value)=>{setPortrait(value);setDetected(false);stable.current={};}}>
      {documentTypes.length > 1 && <select disabled={Boolean(preview)} aria-label="Document type" value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-2 rounded border p-2">{documentTypes.map((type) => <option key={type}>{type}</option>)}</select>}
      <span className="block text-xs">{CAPTURE_GUIDANCE[documentType]} The guide is optional. Keep text in focus and information uncovered. Avoid glare/shadows.</span>
      <span className="relative mx-auto mt-2 block" style={{width:`min(100%, calc(62dvh * ${ratio}))`}}>
        {preview ? <img src={preview.url} alt="Captured document" className="w-full" /> : <video ref={video} muted playsInline className="w-full" />}
        {!preview && outline && <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full"><polygon points={outline.corners.map(p=>`${p.x*100},${p.y*100}`).join(" ")} fill="none" stroke={outline.color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
      </span>
      <span role="status" className="block text-xs">{message}</span>
      {preview ? <>

        <button type="button" className={buttonStyle} disabled={busy} onClick={start}>Retake</button>{" "}
        <button type="button" className={buttonStyle} disabled={!canUseCapture({ checked: preview.checked, busy, disabled, expected: documentType, capturedType: preview.documentType })} onClick={async () => {
          const file = new File([preview.blob], "kyc-capture.jpg", { type: "image/jpeg" });
          file.captureMethod = "live-camera"; file.documentType = documentType;
          setBusy(true); setMessage("Reading document... Checking document type...");
          try {
            const result = await onCapture(file);
            if (result?.error || result !== true) { setMessage(result?.error || "Unable to read document. Please recapture."); setPreview((current)=>current ? {...current,checked:false} : null); }
            else { setPreview(null); setOpen(false); }
          } finally { setBusy(false); }
        }}>{busy ? "Reading document..." : "Process document"}</button>
      </> : <button type="button" className={buttonStyle} disabled={busy || disabled || !detected} onClick={capture}>Capture</button>}{" "}
      <button type="button" className={buttonStyle} disabled={busy} onClick={() => { stop(); setPreview(null); setOpen(false); }}>Cancel</button>
    </KycScannerOverlay>}
  </span>;
}
