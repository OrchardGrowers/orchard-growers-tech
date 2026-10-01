import { it, expect } from "vitest";
import { captureReview, confirmCaptureReview } from "./kycCaptureReview.mjs";
it('proposes differing values without silently overwriting',()=>{
  const form={panNumber:'AAAAA1234A'},detected={panNumber:'BBBBB1234B',fullName:'UNRELATED'};
  const proposals=captureReview(detected,form,'pan');
  expect(form.panNumber).toBe('AAAAA1234A');
  expect(proposals).toEqual([{field:'panNumber',value:'BBBBB1234B',entered:'AAAAA1234A',changed:true}]);
  expect(confirmCaptureReview(form,proposals).panNumber).toBe('BBBBB1234B');
});
it('empty extraction does not auto-fill',()=>expect(confirmCaptureReview({panNumber:''},captureReview({}, {},'pan'))).toEqual({panNumber:''}));

it('shows GST changes before confirmation and fills empty GST after confirmation',()=>{
  for(const gstNumber of ['', '27AAAAA1111A1Z5']){
    const form={gstNumber},proposals=captureReview({gstNumber:'27ABCDE1234F1Z5'},form,'gstCertificate');
    expect(form.gstNumber).toBe(gstNumber);
    expect(proposals[0].changed).toBe(Boolean(gstNumber));
    expect(confirmCaptureReview(form,proposals).gstNumber).toBe('27ABCDE1234F1Z5');
  }
});
it('trade details are display-only and never overwrite business information',()=>{
  const form={businessName:'Existing'},proposals=captureReview({tradeLicenceNumber:'TL-123',tradeBusinessName:'DETECTED'},form,'tradeLicence');
  expect(proposals).toHaveLength(2);
  expect(confirmCaptureReview(form,proposals)).toEqual(form);
});
