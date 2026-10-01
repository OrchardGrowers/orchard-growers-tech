// Quality heuristics only; these do not identify or authenticate a document.
export function checkCaptureQuality({ data, width, height }, sourceWidth, sourceHeight) {
  if (Math.min(sourceWidth, sourceHeight) < 720) return "Move closer or use a higher resolution camera";
  let sum = 0, dark = 0, light = 0, edges = 0, edgeSquares = 0, count = 0;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const v = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    gray[i] = v; sum += v; dark += v < 35; light += v > 248;
  }
  if (sum / gray.length < 65 || dark / gray.length > 0.65) return "Improve lighting";
  if (light / gray.length > 0.9) return "Reduce glare";
  const regions = [0, 0, 0, 0];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const edge = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
    if (Math.abs(edge) > 25) regions[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)]++;
    edges += edge; edgeSquares += edge * edge; count++;
  }
  if (!count || edgeSquares / count - (edges / count) ** 2 < 90) return "Image is blurred. Hold camera steady";
  if (regions.filter((amount) => amount > count * 0.005).length < 3) return "Move document inside frame";
  return "";
}

export const CAPTURE_GUIDANCE = {
  "Trade Licence": "Show the complete Trade Licence with its licence number and issuing authority.",
  "PAN Card": "Place your PAN Card inside the frame.",
  Aadhaar: "Place your Aadhaar Card inside the frame.",
  "Voter ID": "Place your Voter ID Card inside the frame.",
  "Driving Licence": "Place your Driving Licence inside the frame.",
  Passport: "Open the passport photo/details page and place it inside the frame.",
  "GST Certificate": "Place the GST registration certificate/document inside the frame.",
  "Bank Passbook": "Open the account-details page of the passbook and place it inside the frame.",
  "Cancelled Cheque": "Place the complete cancelled cheque inside the frame.",
};

// Text-like connected components are the processing gate; geometry only helps crop.
export function inspectDocumentFrame(frame, sourceWidth, sourceHeight) {
  const {width:w,height:h,data}=frame;
  const quality=checkCaptureQuality(frame,sourceWidth,sourceHeight);
  if(quality) return {error:quality.includes("blurred") ? "Hold steady or move the document slightly for focus." : quality};
  const gray=new Float32Array(w*h); let mean=0;
  for(let i=0;i<gray.length;i++){gray[i]=.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2];mean+=gray[i];}
  const threshold=Math.min(175,Math.max(55,mean/gray.length-30));
  function components(predicate) {
    const seen=new Uint8Array(w*h),out=[];
    for(let i=0;i<seen.length;i++) {
      if(seen[i] || !predicate(gray[i])) continue;
      const queue=[i]; seen[i]=1; let minX=w,maxX=0,minY=h,maxY=0;
      for(let n=0;n<queue.length;n++) {
        const at=queue[n],x=at%w,y=Math.floor(at/w);
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const a=x+dx,b=y+dy,k=b*w+a;
          if(a>=0 && a<w && b>=0 && b<h && !seen[k] && predicate(gray[k])){seen[k]=1;queue.push(k);}
        }
      }
      out.push({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,count:queue.length});
    }
    return out;
  }
  const chars=components(v=>v<threshold).filter(c=>c.count>=3 && c.width>=2 && c.width<w*.065 && c.height>=2 && c.height<h*.12 && c.count/(c.width*c.height)>.18);
  if(chars.length<12 || chars.length>650) return {error: gray.filter(v=>v>248).length/gray.length>.35 ? "Reduce glare" : "Show document"};
  let best={score:0,angle:0};
  for(let degrees=-25;degrees<=25;degrees+=5){
    const angle=degrees*Math.PI/180,rows=new Map();
    for(const c of chars){const y=(c.y+c.height/2)*Math.cos(angle)-(c.x+c.width/2)*Math.sin(angle);const bin=Math.round(y/7);rows.set(bin,(rows.get(bin)||0)+1);}
    const lines=[...rows.values()].filter(n=>n>=4);
    const score=lines.length>=3?lines.reduce((a,b)=>a+b,0):0;
    if(score>best.score)best={score,angle:degrees};
  }
  if(best.score<12 || best.score<chars.length*.55) return {error:"Text is not readable"};
  const minX=Math.min(...chars.map(c=>c.x)),maxX=Math.max(...chars.map(c=>c.x+c.width));
  const minY=Math.min(...chars.map(c=>c.y)),maxY=Math.max(...chars.map(c=>c.y+c.height));
  if((maxX-minX)*(maxY-minY)<w*h*.06) return {error:"Move closer"};
  const page=components(v=>v>175).filter(c=>c.x<=minX && c.y<=minY && c.x+c.width>=maxX && c.y+c.height>=maxY && c.count/(c.width*c.height)>.6 && c.width*c.height>w*h*.2).sort((a,b)=>a.count-b.count)[0];
  let bounds={x:0,y:0,width:1,height:1};
  if(page){const x=Math.max(0,page.x-w*.035),y=Math.max(0,page.y-h*.035);bounds={x:x/w,y:y/h,width:(Math.min(w,page.x+page.width+w*.035)-x)/w,height:(Math.min(h,page.y+page.height+h*.035)-y)/h};}
  if(Math.min(sourceWidth*bounds.width,sourceHeight*bounds.height)<720) bounds={x:0,y:0,width:1,height:1};
  return {error:"",bounds,rotation:Math.abs(best.angle)<=20?best.angle:0, signature:Array.from({length:128},(_,i)=>gray[Math.floor(i*gray.length/128)])};
}

export function canUseCapture({ checked, busy, disabled, expected, capturedType }) {
  return Boolean(checked && !busy && !disabled && expected === capturedType);
}

export async function requestContinuousFocus(track) {
  try {
    if (track?.getCapabilities?.().focusMode?.includes("continuous")) {
      await track.applyConstraints({ advanced: [{ focusMode:"continuous" }] });
    }
  } catch { /* Optional camera control; preserve camera on unsupported devices. */ }
}

export function advanceScanner(previous = {}, result = {}) {
  const a=previous.signature || [],b=result.signature || [];
  const motion=a.length===b.length && a.length ? a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length : Infinity;
  const count=result.error ? 0 : motion<12 ? (previous.count||0)+1 : 1;
  return {count,signature:b,ready:count>=3 && !result.error};
}
