import { describe, expect, it } from "vitest";
import {
  appendBusinessMailSignature,
  getBusinessMailSignature,
  hasControlledSignature,
} from "./businessMailSignatures.js";
import { validateBusinessMailHtml } from "../../utils/businessMailContentValidation.js";

describe("controlled Business Mail signatures", () => {
  it.each([
    ["EFRUITMANDI_NO_REPLY", "eFruitMandi", "no-reply address"],
    ["ORCHARD_NO_REPLY", "Orchard Growers", "no-reply address"],
    ["EFRUITMANDI_CAREER", "eFruitMandi", "career and application-related"],
    ["ORCHARD_CAREER", "Orchard Growers", "career and application-related"],
    ["ADMINHO_ORCHARD", "Orchard Growers", "authorized Orchard Growers administrator"],
    ["SALES_ORCHARD", "Orchard Growers", "sales assistance"],
    ["SUPPORT_EFRUITMANDI", "eFruitMandi", "support assistance"],
  ])("selects %s", (key, brand, note) => {
    const signature = getBusinessMailSignature(key);
    expect(signature.html).toContain(brand);
    expect(signature.text).toContain(brand);
    expect(signature.text).toContain(note);
    expect(validateBusinessMailHtml(signature.html)).toBe(true);
  });

  it("appends the HTML signature once", () => {
    const once = appendBusinessMailSignature({ senderProfileKey: "EFRUITMANDI_NO_REPLY", html: "<p>Hello</p>" });
    const twice = appendBusinessMailSignature({ senderProfileKey: "EFRUITMANDI_NO_REPLY", html: once.html });
    expect(once.html.match(/id="business-mail-signature-/g)).toHaveLength(1);
    expect(twice.html).toBe(once.html);
  });

  it("appends the plain-text signature once", () => {
    const once = appendBusinessMailSignature({ senderProfileKey: "ORCHARD_CAREER", text: "Hello" });
    const twice = appendBusinessMailSignature({ senderProfileKey: "ORCHARD_CAREER", text: once.text });
    expect(hasControlledSignature(once.text)).toBe(true);
    expect(twice.text).toBe(once.text);
  });
});
