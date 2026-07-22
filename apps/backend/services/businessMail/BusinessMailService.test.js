import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBusinessMailProviderStatus,
  listEnabledSenderProfiles,
  sendBusinessMail,
} from "./BusinessMailService.js";

const ENV_KEYS = [
  "BUSINESS_MAIL_PROVIDER",
  "BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_ENABLED",
  "BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_REPLY_TO",
  "BREVO_API_KEY",
];
const originalEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const enableBrevoTestProfile = () => {
  process.env.BUSINESS_MAIL_PROVIDER = "brevo_api";
  process.env.BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_ENABLED = "true";
  process.env.BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_REPLY_TO = "support@example.test";
  process.env.BREVO_API_KEY = "placeholder-for-unit-test";
};

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

describe("Business Mail foundation", () => {
  it("rejects unknown sender profiles before provider delivery", async () => {
    await expect(
      sendBusinessMail({
        senderProfileKey: "ARBITRARY_FROM",
        to: "recipient@example.test",
        subject: "Test",
        text: "Test body",
      })
    ).rejects.toMatchObject({ code: "BUSINESS_MAIL_UNKNOWN_SENDER_PROFILE" });
  });

  it("rejects unsupported recipient features", async () => {
    enableBrevoTestProfile();
    await expect(
      sendBusinessMail({
        senderProfileKey: "EFRUITMANDI_NO_REPLY",
        to: "recipient@example.test",
        cc: [],
        subject: "Test",
        text: "Test body",
      })
    ).rejects.toMatchObject({ code: "BUSINESS_MAIL_UNSUPPORTED_CC" });
  });

  it("rejects header injection and caller-supplied sender configuration", async () => {
    enableBrevoTestProfile();
    await expect(
      sendBusinessMail({
        senderProfileKey: "EFRUITMANDI_NO_REPLY",
        to: "recipient@example.test",
        subject: "Safe subject\r\nBcc: injected@example.test",
        text: "Test body",
      })
    ).rejects.toMatchObject({ code: "BUSINESS_MAIL_INVALID_SUBJECT" });
    await expect(
      sendBusinessMail({
        senderProfileKey: "EFRUITMANDI_NO_REPLY",
        from: "arbitrary@example.test",
        to: "recipient@example.test",
        subject: "Test",
        text: "Test body",
      })
    ).rejects.toMatchObject({ code: "BUSINESS_MAIL_INVALID_REQUEST" });
  });

  it("normalizes a Brevo result without returning the raw response", async () => {
    enableBrevoTestProfile();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ messageId: "provider-message-id", ignored: "raw-value" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBusinessMail({
      senderProfileKey: "EFRUITMANDI_NO_REPLY",
      to: " Recipient@Example.test ",
      subject: "Controlled test",
      text: "Plain-text body",
      metadata: { source: "unit-test", correlationId: "test-1" },
    });

    expect(result).toEqual({
      success: true,
      provider: "brevo_api",
      providerMessageId: "provider-message-id",
      accepted: ["recipient@example.test"],
      rejected: [],
      status: "SENT",
      sentAt: expect.any(String),
    });
    expect(result).not.toHaveProperty("ignored");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.sender.email).toBe("no-reply@efruitmandi.live");
    expect(requestBody.replyTo.email).toBe("support@example.test");
    expect(requestBody.to).toEqual([{ email: "recipient@example.test" }]);
  });

  it("returns secret-free provider status and enabled profile summaries", () => {
    enableBrevoTestProfile();
    expect(getBusinessMailProviderStatus()).toEqual({
      provider: "brevo_api",
      configured: true,
      enabledSenderProfileKeys: ["EFRUITMANDI_NO_REPLY"],
    });
    expect(listEnabledSenderProfiles()[0]).not.toHaveProperty("credentials");
  });
});
