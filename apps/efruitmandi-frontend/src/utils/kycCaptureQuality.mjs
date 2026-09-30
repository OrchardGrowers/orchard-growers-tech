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
  if (sum / gray.length > 235 || light / gray.length > 0.65) return "Reduce glare";
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
  "PAN Card": "Place your PAN Card inside the frame.",
  Aadhaar: "Place your Aadhaar Card inside the frame.",
  "Voter ID": "Place your Voter ID Card inside the frame.",
  "Driving Licence": "Place your Driving Licence inside the frame.",
  Passport: "Open the passport photo/details page and place it inside the frame.",
  "GST Certificate": "Place the GST registration certificate/document inside the frame.",
  "Bank Passbook": "Open the account-details page of the passbook and place it inside the frame.",
  "Cancelled Cheque": "Place the complete cancelled cheque inside the frame.",
};

// Conservative axis-aligned page detection. Tilted/low-contrast pages require
// repositioning; this geometric gate never establishes document identity.
export function inspectDocumentFrame(frame, sourceWidth, sourceHeight) {
  const { width: w, height: h, data } = frame;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = .299 * data[4*i] + .587 * data[4*i+1] + .114 * data[4*i+2];
  const g = (x,y) => gray[y*w+x];
  const boundary = (vertical, from, to) => {
    let best = { pos: 0, score: 0 };
    const length = vertical ? h : w;
    for (let p = from; p <= to; p++) {
      let hits = 0, total = 0;
      for (let k = Math.floor(length*.25); k < length*.75; k++) {
        const delta = vertical ? Math.abs(g(p+2,k)-g(p-2,k)) : Math.abs(g(k,p+2)-g(k,p-2));
        hits += delta > 28; total++;
      }
      if (hits / total > best.score) best = { pos: p, score: hits / total };
    }
    return best;
  };
  const left = boundary(true, Math.ceil(w*.07), Math.floor(w*.3));
  const right = boundary(true, Math.ceil(w*.7), Math.floor(w*.93));
  const top = boundary(false, Math.ceil(h*.07), Math.floor(h*.3));
  const bottom = boundary(false, Math.ceil(h*.7), Math.floor(h*.93));
  if ([left,right,top,bottom].some((b) => b.score < .72)) return { error: "Place the document inside the frame" };
  const x = left.pos+3, y = top.pos+3, width = right.pos-x-3, height = bottom.pos-y-3;
  if (width*height < w*h*.4) return { error: "Move document closer" };
  // Require continuous outer edges, including the corner regions.
  let covered = 0, total = 0;
  for(let a=x; a<x+width; a++) for(const b of [top.pos,bottom.pos]) {covered += Math.abs(g(a,b+2)-g(a,b-2))>28;total++;}
  for(let b=y; b<y+height; b++) for(const a of [left.pos,right.pos]) {covered += Math.abs(g(a+2,b)-g(a-2,b))>28;total++;}
  if(covered/total < .75) return { error: "Show all 4 corners" };
  const pixels = new Uint8ClampedArray(width*height*4);
  let textEdges = 0;
  for(let b=0;b<height;b++) for(let a=0;a<width;a++) {
    const src=((y+b)*w+x+a)*4; pixels.set(data.subarray(src,src+4),(b*width+a)*4);
    if(a>1 && b>1 && Math.abs(g(x+a,y+b)-g(x+a-1,y+b))>30) textEdges++;
  }
  const error = checkCaptureQuality({data:pixels,width,height},sourceWidth*width/w,sourceHeight*height/h);
  if(error) return {error};
  const density = textEdges/(width*height);
  if(density < .015 || density > .3) return {error:"Text is not readable"};
  return {error:"", bounds:{x:x/w,y:y/h,width:width/w,height:height/h}};
}

export function canUseCapture({ checked, busy, disabled, expected, capturedType }) {
  return Boolean(checked && !busy && !disabled && expected === capturedType);
}
