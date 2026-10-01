import { describe, it, expect } from "vitest";
import { matchKycDocument } from "./kycDocumentMatching.js";
const samples = {
  "PAN Card": "INCOME TAX DEPARTMENT Permanent Account Number ABCDE1234F",
  Aadhaar: "UIDAI Government of India Aadhaar 2345 6789 0123",
  "Voter ID": "Election Commission of India EPIC ABC1234567",
  "Driving Licence": "Driving Licence DL 01 2020 1234567",
  Passport: "Republic of India PASSPORT A1234567",
  "GST Certificate": "Goods and Services Tax Registration Certificate GSTIN 27ABCDE1234F1Z5",
  "Bank Passbook": "STATE BANK PASSBOOK Account Number 12345678901 IFSC SBIN0001234",
  "Cancelled Cheque": "STATE BANK CHEQUE CANCELLED PAY BEARER Account 12345678901 IFSC SBIN0001234",
};
describe("captured document evidence matching", () => {
  it.each(Object.entries(samples))("accepts strong %s evidence", (type, text) => {
    expect(matchKycDocument(type, { text, confidence: 90 })).toBe("match");
  });
  it.each([
    ["PAN Card", "Aadhaar"], ["Aadhaar", "Passport"],
    ["Bank Passbook", "Cancelled Cheque"], ["Cancelled Cheque", "Bank Passbook"],
    ["PAN Card", "GST Certificate"], ["Driving Licence", "Voter ID"],
  ])("rejects %s expected with %s evidence", (expected, actual) => {
    expect(matchKycDocument(expected, { text: samples[actual], confidence: 90 })).toBe("mismatch");
  });
  it.each(["", "PAN", "ABCDE1234F", "Government of India 234567890123", "bank account 123456789", "GST registration", samples["PAN Card"] + " " + samples.Aadhaar])("rejects insufficient or ambiguous evidence", (text) => {
    expect(matchKycDocument("PAN Card", { text, confidence: 90 })).toBe("unreadable");
  });
  it("rejects low confidence even with matching words", () => {
    expect(matchKycDocument("PAN Card", { text: samples["PAN Card"], confidence: 40 })).toBe("unreadable");
  });
  it("requires cancellation evidence on a cheque", () => {
    expect(matchKycDocument("Cancelled Cheque", { text: samples["Cancelled Cheque"].replace("CANCELLED", ""), confidence: 95 })).toBe("unreadable");
  });
});
import { extractKycFields } from "./kycDocumentMatching.js";
it.each([
  ['PAN Card','INCOME TAX Permanent Account Number ABCDE1234F',{panNumber:'ABCDE1234F'}],
  ['Aadhaar','UIDAI Aadhaar 2345 6789 0123',{idProofNumber:'234567890123'}],
  ['GST Certificate','GSTIN Registration Certificate 27ABCDE1234F1Z5',{gstNumber:'27ABCDE1234F1Z5'}],
  ['Bank Passbook','STATE BANK PASSBOOK Account Number: 12345678901 IFSC SBIN0001234',{accountNumber:'12345678901',ifscCode:'SBIN0001234'}],
  ['Cancelled Cheque','STATE BANK CHEQUE CANCELLED PAY BEARER Account 12345678901 IFSC SBIN0001234',{accountNumber:'12345678901',ifscCode:'SBIN0001234'}],
  ['Voter ID','Election Commission EPIC ABC1234567',{idProofNumber:'ABC1234567'}],
  ['Driving Licence','Driving Licence DL 01 2020 1234567',{idProofNumber:'DL0120201234567'}],
  ['Passport','Republic of India PASSPORT A1234567',{idProofNumber:'A1234567'}],
])('extracts only structured %s identifiers',(type,text,fields)=>expect(extractKycFields(type,{text,confidence:95})).toEqual(fields));
it('does not extract low confidence or conflicting identifiers',()=>{
  expect(extractKycFields('PAN Card',{text:'INCOME TAX ABCDE1234F',confidence:75})).toEqual({});
  expect(extractKycFields('PAN Card',{text:'INCOME TAX ABCDE1234F AAAAA1111A',confidence:95})).toEqual({});
});

it.each([
  ['Trade Licence\nMunicipal Corporation\nLicence Number: TL-2026-123\nBusiness Name: GREEN FRUIT TRADERS', {tradeLicenceNumber:'TL-2026-123',tradeBusinessName:'GREEN FRUIT TRADERS'}],
  ['Municipality Business Establishment\nLicense No: 12345', {tradeLicenceNumber:'12345'}],
])('checks trade licence evidence and extracts structured fields', (text,fields)=>{
  expect(matchKycDocument('Trade Licence',{text,confidence:95})).toBe('match');
  expect(extractKycFields('Trade Licence',{text,confidence:95})).toEqual(fields);
});
it('rejects unrelated content labelled as trade licence or GST',()=>{
  const pan={text:'INCOME TAX ABCDE1234F',confidence:95};
  expect(matchKycDocument('Trade Licence',pan)).toBe('mismatch');
  expect(matchKycDocument('GST Certificate',pan)).toBe('mismatch');
  expect(matchKycDocument('Trade Licence',{text:'Trade Licence Number: BUSINESS',confidence:95})).toBe('unreadable');
});
