import { describe, it, expect } from "vitest";
import { inspectDocumentFrame, canUseCapture, CAPTURE_GUIDANCE, advanceScanner, requestContinuousFocus } from "./kycCaptureQuality.mjs";
function scene(kind) {
  const width=320,height=240,data=new Uint8ClampedArray(width*height*4);
  let seed=1234;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    let v=45;
    if(kind==='random') {seed=(seed*1664525+1013904223)>>>0;v=seed%220;}
    if(kind==='person') v=((x-160)**2/1600+(y-110)**2/4900 < 1)?160:60;
    if(kind==='room') v=x<160?90:y<130?150:65;
    if(['document','blankPage','glare','blur'].includes(kind) && x>=40 && x<280 && y>=30 && y<210) {
      v=kind==='glare'?255:205;
      if(['document','blur'].includes(kind) && y>45 && y<195 && y%16<3 && x>53 && x<265 && x%13<10) v=40;
    }
    const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  if(kind==='blur') {
    const original=data.slice();
    for(let y=4;y<height-4;y++) for(let x=4;x<width-4;x++) {
      let sum=0;
      for(let b=-4;b<=4;b++) for(let a=-4;a<=4;a++) sum+=original[((y+b)*width+x+a)*4];
      const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=sum/81;
    }
  }
  return {data,width,height};
}
describe('scanner presence gate',()=>{
  it.each(['random','person','room','blankPage'])('rejects %s scene',kind=>expect(inspectDocumentFrame(scene(kind),1920,1440).error).toBeTruthy());
  it('rejects blank frame',()=>expect(inspectDocumentFrame(scene('blank'),1920,1440).error).toBeTruthy());
  it('rejects blurred document',()=>expect(inspectDocumentFrame(scene('blur'),1920,1440).error).toMatch(/focus/));
  it('rejects glare',()=>expect(inspectDocumentFrame(scene('glare'),1920,1440).error).toBe('Reduce glare'));
  it('allows document-like frame to proceed to submission OCR',()=>expect(inspectDocumentFrame(scene('document'),1920,1440).error).toBe(''));
  it('keeps Use capture disabled until checks pass and expected type matches',()=>{
    const state={checked:true,busy:false,disabled:false,expected:'PAN Card',capturedType:'PAN Card'};
    expect(canUseCapture(state)).toBe(true);
    for(const change of [{checked:false},{busy:true},{disabled:true},{expected:'Aadhaar'}])expect(canUseCapture({...state,...change})).toBe(false);
  });
  it('provides distinct guidance for each supported expected type',()=>{
    expect(Object.keys(CAPTURE_GUIDANCE)).toHaveLength(9);
    expect(new Set(Object.values(CAPTURE_GUIDANCE)).size).toBe(9);
    expect(CAPTURE_GUIDANCE.Passport).toContain('photo/details');
    expect(CAPTURE_GUIDANCE['Bank Passbook']).toContain('account-details');
  });
});

function reposition(frame, degrees=0, dx=0, scale=1) {
  const {width,height}=frame,data=new Uint8ClampedArray(frame.data.length),angle=degrees*Math.PI/180;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const a=(x-width/2-dx)/scale,b=(y-height/2)/scale;
    const sx=Math.round(a*Math.cos(angle)+b*Math.sin(angle)+width/2),sy=Math.round(-a*Math.sin(angle)+b*Math.cos(angle)+height/2);
    const i=(y*width+x)*4,v=sx>=0&&sx<width&&sy>=0&&sy<height?frame.data[(sy*width+sx)*4]:45;
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  return {width,height,data};
}
it.each([[0,30,1],[12,0,1],[0,15,.8]])('accepts imperfect placement %j', (angle,dx,scale)=>{
  expect(inspectDocumentFrame(reposition(scene('document'),angle,dx,scale),1920,1440).error).toBe('');
});
it('requires three stable frames, resets on movement or rejection',()=>{
  const result=inspectDocumentFrame(scene('document'),1920,1440);
  let state=advanceScanner({},result);expect(state.ready).toBe(false);
  state=advanceScanner(state,result);expect(state.ready).toBe(false);
  state=advanceScanner(state,result);expect(state.ready).toBe(true);
  expect(advanceScanner(state,{error:'Show document'}).ready).toBe(false);
});
it('feature-detects autofocus and tolerates unsupported devices',async()=>{
  let applied;
  await requestContinuousFocus({getCapabilities:()=>({focusMode:['continuous']}),applyConstraints:async value=>{applied=value;}});
  expect(applied.advanced[0].focusMode).toBe('continuous');
  await expect(requestContinuousFocus({})).resolves.toBeUndefined();
  await expect(requestContinuousFocus({getCapabilities:()=>{throw Error('unsupported');}})).resolves.toBeUndefined();
});
