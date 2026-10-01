import {it,expect} from "vitest";
import {FACE_CAMERA_CONSTRAINTS,faceObservation,advanceFaceChallenge} from "./kycFaceCapture.mjs";
const observation=yaw=>({yaw,x:.5,y:.5,size:.4});
const hold=(state,yaw,n=4)=>{for(let i=0;i<n;i++)state=advanceFaceChallenge(state,observation(yaw));return state;};
it('requests front camera, derives left/right from nose versus eyes, rejects missing landmarks',()=>{
 expect(FACE_CAMERA_CONSTRAINTS.video.facingMode.ideal).toBe('user');
 const face={boundingBox:{x:300,y:200,width:400,height:400},landmarks:[{type:'eye',locations:[{x:420,y:300}]},{type:'eye',locations:[{x:580,y:300}]},{type:'nose',locations:[{x:540,y:370}]}]};
 expect(faceObservation([face],1000,800).yaw).toBeGreaterThan(.2);
 face.landmarks[2].locations[0].x=460;expect(faceObservation([face],1000,800).yaw).toBeLessThan(-.2);
 expect(faceObservation([],1000,800).error).toBeTruthy();
 expect(faceObservation([face,face],1000,800).error).toBeTruthy();
 expect(faceObservation([{...face,landmarks:[]}],1000,800).error).toMatch(/cannot reliably/);
});
it('requires ordered center-left-center-right-center and captures once',()=>{
 let state=hold({},0);expect(state.step).toBe(1);
 state=hold(state,.28);expect(state.step).toBe(2);
 state=hold(state,0);expect(state.step).toBe(3);
 state=hold(state,-.28);expect(state.step).toBe(4);
 state=hold(state,0);expect(state.capture).toBe(true);
 expect(advanceFaceChallenge(state,observation(0)).capture).toBe(false);
});
it('wrong order, quality failures and movement cannot complete challenge',()=>{
 let state=hold({},0);state=hold(state,-.28);expect(state.complete).not.toBe(true);
 state={step:4,count:2,last:observation(0)};
 expect(advanceFaceChallenge(state,{...observation(0),x:.6}).capture).toBe(false);
 expect(advanceFaceChallenge(state,{error:'Improve lighting'}).step).toBe(0);
 expect(hold({},.3,20).complete).not.toBe(true);
});
