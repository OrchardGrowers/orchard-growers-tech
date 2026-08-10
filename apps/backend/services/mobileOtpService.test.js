import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMobileOtp } from "./mobileOtpService.js";

const ENV_KEYS = [
  "MOBILE_OTP_PROVIDER",
  "MSG91_FLOW",
  "EFRUITMANDI_MSG91_FLOW",
  "EFRUITMANDI_MSG91_AUTH_KEY",
  "EFRUITMANDI_MSG91_TEMPLATE_ID",
  "EFRUITMANDI_MSG91_WIDGET_ID",
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("eFruitMandi mobile OTP flow selection", () => {
  it("uses the configured template flow when no widget ID is configured", async () => {
    process.env.MOBILE_OTP_PROVIDER = "MSG91";
    delete process.env.MSG91_FLOW;
    delete process.env.EFRUITMANDI_MSG91_FLOW;
    process.env.EFRUITMANDI_MSG91_AUTH_KEY = "test-auth-key";
    process.env.EFRUITMANDI_MSG91_TEMPLATE_ID = "test-template-id";
    delete process.env.EFRUITMANDI_MSG91_WIDGET_ID;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ type: "success", request_id: "request-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await sendMobileOtp({
      phone: "9876543210",
      otp: "123456",
      platform: "efruitmandi",
    });

    expect(result.flow).toBe("template");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.origin + url.pathname).toBe("https://control.msg91.com/api/v5/otp");
    expect(url.searchParams.get("template_id")).toBe("test-template-id");
    expect(url.searchParams.get("otp")).toBe("123456");
  });
});
