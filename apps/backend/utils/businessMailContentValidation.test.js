import { describe, expect, it } from "vitest";
import { validateBusinessMailHtml } from "./businessMailContentValidation.js";

describe("Business Mail restrictive HTML validation", () => {
  it("accepts basic email-safe markup and links", () => {
    expect(() => validateBusinessMailHtml(
      '<div><h2>Update</h2><p style="color: #17351f">Hello <strong>there</strong>.</p><a href="https://example.com">Open</a></div>'
    )).not.toThrow();
  });

  it.each([
    ["script", "<script>alert(1)</script>"],
    ["iframe", '<iframe src="https://example.com"></iframe>'],
    ["event handler", '<p onclick="alert(1)">Open</p>'],
    ["javascript URL", '<a href="java\nscript:alert(1)">Open</a>'],
    ["encoded javascript URL", '<a href="java&#x0a;script:alert(1)">Open</a>'],
    ["data HTML URL", '<a href="data:text/html;base64,PHNjcmlwdD4=">Open</a>'],
    ["form", "<form><input name=x></form>"],
    ["srcdoc", '<div srcdoc="<p>unsafe</p>">Open</div>'],
  ])("rejects %s", (_label, html) => {
    expect(() => validateBusinessMailHtml(html)).toThrowError(
      expect.objectContaining({ code: "BUSINESS_MAIL_UNSAFE_HTML" })
    );
  });
});

