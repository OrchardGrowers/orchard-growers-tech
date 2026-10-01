// Movement heuristic only. Coordinates are from the unmirrored camera image.
export const FACE_CAMERA_CONSTRAINTS={audio:false,video:{facingMode:{ideal:"user"},width:{ideal:1280},height:{ideal:960}}};
export const FACE_STEPS=["Look straight","Turn your face slightly left","Look straight","Now turn slightly right","Hold still"];
const center = locations => ({x:locations.reduce((n,p)=>n+p.x,0)/locations.length,y:locations.reduce((n,p)=>n+p.y,0)/locations.length});
export function faceObservation(faces,width,height) {
  if(faces.length!==1)return {error:faces.length?"Only one face should be visible":"Position your face inside the frame"};
  const face=faces[0],b=face.boundingBox;
  if(!b||b.width<=0||b.height<=0)return {error:"Position your face inside the frame"};
  const size=b.width/width;
  if(size<.22)return {error:"Move closer"};
  if(size>.68)return {error:"Move back"};
  if(Math.abs((b.x+b.width/2)/width-.5)>.13||Math.abs((b.y+b.height/2)/height-.5)>.18)return {error:"Position your face inside the frame"};
  const eyes=(face.landmarks||[]).filter(p=>p.type==="eye"&&p.locations?.length).map(p=>center(p.locations)).sort((a,b)=>a.x-b.x);
  const nose=(face.landmarks||[]).find(p=>p.type==="nose"&&p.locations?.length);
  if(eyes.length!==2||!nose)return {error:"This browser cannot reliably check face movement. Use a supported browser; this step is optional."};
  const distance=eyes[1].x-eyes[0].x;
  if(distance<b.width*.15||Math.abs(eyes[1].y-eyes[0].y)>distance*.25)return {error:"Look straight"};
  return {yaw:(center(nose.locations).x-(eyes[0].x+eyes[1].x)/2)/distance,x:(b.x+b.width/2)/width,y:(b.y+b.height/2)/height,size,box:b};
}
export function advanceFaceChallenge(previous={},observation={}) {
  if(previous.complete)return {...previous,capture:false};
  if(observation.error)return {step:0,count:0,message:observation.error,capture:false};
  const step=previous.step||0,old=previous.last;
  const stable=old && Math.abs(old.x-observation.x)<.025 && Math.abs(old.y-observation.y)<.025 && Math.abs(old.size-observation.size)<.035 && Math.abs(old.yaw-observation.yaw)<.06;
  const centered=Math.abs(observation.yaw)<.12;
  const expected=step===1?observation.yaw>.20:step===3?observation.yaw<-.20:centered;
  // Wrong head-turn order resets the challenge. Translation alone cannot pass.
  if((step===1&&observation.yaw<-.20)||(step===3&&observation.yaw>.20))return {step:0,count:0,last:observation,message:"Look straight",capture:false};
  const count=expected&&stable?(previous.count||0)+1:0;
  if(count>=3){if(step===4)return {step:5,complete:true,capture:true,message:"Face movement completed"};return {step:step+1,count:0,last:observation,message:FACE_STEPS[step+1],capture:false};}
  return {step,count,last:observation,message:FACE_STEPS[step],capture:false};
}
