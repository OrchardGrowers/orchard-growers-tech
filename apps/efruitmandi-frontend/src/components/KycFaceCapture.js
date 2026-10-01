import { useEffect, useRef, useState } from "react";
import KycScannerOverlay from "./KycScannerOverlay";
import { checkCaptureQuality } from "../utils/kycCaptureQuality.mjs";
import { FACE_CAMERA_CONSTRAINTS, FACE_STEPS, faceObservation, advanceFaceChallenge } from "../utils/kycFaceCapture.mjs";
export default function KycFaceCapture({disabled,onCapture}) {
  const video=useRef(null),stream=useRef(null),generation=useRef(0),detector=useRef(null),challenge=useRef({}),running=useRef(false);
  const [open,setOpen]=useState(false),[message,setMessage]=useState(""),[step,setStep]=useState(0),[ratio,setRatio]=useState(3/4);
  const stop=()=>{generation.current++;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;detector.current=null;challenge.current={};};
  const close=()=>{stop();setOpen(false);};
  useEffect(()=>()=>stop(),[]);
  useEffect(()=>{if(disabled)close();},[disabled]);
  useEffect(()=>{const hide=()=>{if(document.hidden)close();};document.addEventListener("visibilitychange",hide);return()=>document.removeEventListener("visibilitychange",hide);},[]);
  const start=async()=>{
    stop();setMessage("Position your face inside the frame");setStep(0);setOpen(true);
    const request=generation.current;
    try {
      if(!window.FaceDetector){setMessage("Face movement capture is unavailable in this browser. This step is optional.");return;}
      detector.current=new window.FaceDetector({fastMode:false,maxDetectedFaces:3});
      const media=await navigator.mediaDevices.getUserMedia(FACE_CAMERA_CONSTRAINTS);
      if(request!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;video.current.srcObject=media;await video.current.play();
    } catch {if(request===generation.current){stop();setMessage("Camera or face detection unavailable. Allow camera access or use a supported browser.");}}
  };
  useEffect(()=>{
    if(!open)return undefined;
    const timer=setInterval(async()=>{
      const v=video.current;
      if(running.current||!v?.videoWidth||!stream.current||!detector.current||challenge.current.complete)return;
      running.current=true;const request=generation.current;
      try {
        // A single in-memory frame is reused for detection, quality and final capture.
        const canvas=document.createElement("canvas");canvas.width=v.videoWidth;canvas.height=v.videoHeight;canvas.getContext("2d").drawImage(v,0,0);
        const faces=await detector.current.detect(canvas);
        if(request!==generation.current)return;
        const observation=faceObservation(faces,canvas.width,canvas.height);
        if(!observation.error){
          const b=observation.box,sample=document.createElement("canvas");sample.width=160;sample.height=160;
          const ctx=sample.getContext("2d");ctx.drawImage(canvas,b.x,b.y,b.width,b.height,0,0,160,160);
          observation.error=checkCaptureQuality(ctx.getImageData(0,0,160,160),canvas.width,canvas.height,false);
        }
        challenge.current=advanceFaceChallenge(challenge.current,observation);
        setRatio(canvas.width/canvas.height);setMessage(challenge.current.message);setStep(challenge.current.step);
        if(challenge.current.capture){
          setMessage("Capturing...");
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.9));
          if(request!==generation.current)return;
          if(!blob||blob.size>10*1024*1024)throw new Error();
          // Only this final image leaves the browser. No video or intermediate frames.
          const file=new File([blob],"live-face.jpg",{type:"image/jpeg"});file.captureMethod="live-camera";file.documentType="Live Face Capture";
          stream.current.getTracks().forEach(t=>t.stop());stream.current=null;
          const result=await onCapture(file);
          if(request!==generation.current)return;
          setMessage(result===true?"Face captured. Face movement completed.":result?.error||"Capture failed. Try again.");
        }
      } catch {if(request===generation.current){stop();setMessage("Face movement could not be checked. Try again on a supported browser.");}}
      finally {running.current=false;}
    },350);
    return()=>clearInterval(timer);
  },[open,onCapture]);
  return <span className="block">
    {!open?<button type="button" disabled={disabled} onClick={start} className="rounded bg-green-700 px-3 py-2 text-white">Start Live Face Capture</button>:<KycScannerOverlay orientation="portrait" onClose={close}>
      <h2 className="font-bold">Live Face Capture</h2>
      <p className="text-xs">Optional movement check; not identity verification.</p>
      <video ref={video} muted playsInline className="mx-auto block" style={{width:`min(100%, calc(65dvh * ${ratio}))`,transform:"scaleX(-1)"}} />
      <p role="status" className="my-2 font-bold">{message}</p>
      <p className="text-sm">{FACE_STEPS.map((_,i)=>i<step?"✓":"○").join(" ")}</p>
      <button type="button" onClick={start} className="m-2 rounded border px-3 py-2">Restart</button>
      <button type="button" onClick={close} className="m-2 rounded bg-green-700 px-3 py-2 text-white">Close</button>
    </KycScannerOverlay>}
  </span>;
}
