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
