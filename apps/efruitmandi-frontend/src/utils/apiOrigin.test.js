import { describe, expect, it } from "vitest";
import { resolvePrivateApiUrls } from "./apiOrigin";

describe("private API origin isolation", () => {
  it.each(["localhost", "127.0.0.1", "::1"])(
    "keeps private requests local on %s even when production is configured",
    (hostname) => {
      expect(resolvePrivateApiUrls({
        hostname,
        configuredUrl: "https://api.efruitmandi.live/api",
      })).toMatchObject({
        apiOrigin: "http://localhost:5000",
        apiBaseUrl: "http://localhost:5000/api",
        localBrowser: true,
      });
      const { apiBaseUrl } = resolvePrivateApiUrls({
        hostname,
        configuredUrl: "https://api.efruitmandi.live/api",
      });
      expect(`${apiBaseUrl}/user/profile?authorizationOnly=1`).toBe(
        "http://localhost:5000/api/user/profile?authorizationOnly=1"
      );
      expect(`${apiBaseUrl}/kyc/me?roleType=grower&authorizationOnly=1`).toBe(
        "http://localhost:5000/api/kyc/me?roleType=grower&authorizationOnly=1"
      );
    }
  );

  it("honors a loopback backend override on localhost", () => {
    expect(resolvePrivateApiUrls({
      hostname: "localhost",
      configuredUrl: "http://127.0.0.1:5100/api",
    }).apiBaseUrl).toBe("http://127.0.0.1:5100/api");
  });

  it("keeps production unchanged when a production build contains a loopback override", () => {
    expect(resolvePrivateApiUrls({
      hostname: "www.efruitmandi.live",
      configuredUrl: "http://localhost:5000/api",
    }).apiBaseUrl).toBe("https://api.efruitmandi.live/api");
  });
});
