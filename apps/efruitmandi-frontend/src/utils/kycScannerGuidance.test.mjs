import {it,expect} from "vitest";
import {documentGuidance,scannerPresentation} from "./kycScannerGuidance.mjs";
import {advanceScanner} from "./kycCaptureQuality.mjs";
const frame=(x=.2,y=.2,w=.6,h=.6)=>({error:"",corners:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],signature:[80,100,120]});
it.each([
 [frame(.03,.2,.4,.6),'Move camera left'],[frame(.57,.2,.4,.6),'Move camera right'],
 [frame(.2,.03,.6,.4),'Move camera up'],[frame(.2,.57,.6,.4),'Move camera down'],
 [frame(.35,.3,.3,.4),'Move closer'],[frame(.02,.04,.96,.92),'Move back'],
 [frame(0,.2,.5,.5),'Show top-left corner'],
 [{...frame(),verticalText:true},'Rotate document'],
])('gives camera-relative guidance', (result,message)=>expect(documentGuidance(result)).toBe(message));
it('prioritizes mobile orientation',()=>expect(documentGuidance(frame(),{portrait:true})).toBe('Rotate your phone horizontally'));
it('green and capture availability share consecutive readiness and clear on loss',()=>{
 const result=frame();let state={};
 for(let i=0;i<3;i++){state=advanceScanner(state,result);expect(scannerPresentation(result,state).ready).toBe(i===2);}
 expect(scannerPresentation(result,state).color).toBe('#22c55e');
 for(const error of ['Reduce glare','Image is blurred','Show document']){
   const failed={...result,error};const next=advanceScanner(state,failed);expect(scannerPresentation(failed,next).ready).toBe(false);expect(scannerPresentation(failed,next).color).toBe('#f59e0b');
 }
 expect(scannerPresentation(result,advanceScanner(state,{...result,signature:[200,200,200]})).ready).toBe(false);
 expect(scannerPresentation(frame(0),state).ready).toBe(false);
});
