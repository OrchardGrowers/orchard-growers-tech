// Rear-camera semantics: move the camera toward the document's current position.
export function documentGuidance(result, {portrait=false}={}) {
  if(portrait)return "Rotate your phone horizontally";
  if(result.error)return /blurred|focus/.test(result.error)?"Move slightly and wait for focus":result.error;
  const q=result.corners;
  if(!q?.length)return "Show document edges";
  const names=["top-left","top-right","bottom-right","bottom-left"];
  for(let i=0;i<4;i++)if(q[i].x<.015||q[i].x>.985||q[i].y<.015||q[i].y>.985)return "Show "+names[i]+" corner";
  const xs=q.map(p=>p.x),ys=q.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
  if(w*h>.85)return "Move back";
  if(w*h<.20)return "Move closer";
  if(result.verticalText)return "Rotate document";
  const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
  if(x<.36)return "Move camera left";
  if(x>.64)return "Move camera right";
  if(y<.34)return "Move camera up";
  if(y>.66)return "Move camera down";
  if(Math.abs(result.rotation||0)>22)return "Straighten document";
  return "";
}
export function scannerPresentation(result, stability, options) {
  const guidance=documentGuidance(result,options);
  const ready=!guidance && stability.ready;
  return {ready,color:ready?"#22c55e":"#f59e0b",message:guidance || (ready?"Ready to capture":"Hold steady")};
}
