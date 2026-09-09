import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRobotsPolicy } from "./apiRobotsPolicy.js";
let server, origin;
beforeAll(async () => {
  const app = express();
  app.use(apiRobotsPolicy);
  app.get("/", (req, res) => res.send("API"));
  app.get("/sitemap.xml", (req, res) => res.type("application/xml").send("<urlset/>"));
  app.get("/api/private", (req, res) => res.sendStatus(401));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  origin = "http://127.0.0.1:" + server.address().port;
});
afterAll(async () => { await new Promise((resolve) => server.close(resolve)); });
describe("API host indexing exclusion", () => {
  it("blocks crawling at the API origin", async () => {
    const response = await fetch(origin + "/robots.txt");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
  });
  it("sets noindex on the API root", async () => {
    expect((await fetch(origin)).headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("preserves authentication responses", async () => {
    const response = await fetch(origin + "/api/private");
    expect(response.status).toBe(401);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("keeps the proxied public website sitemap usable", async () => {
    const response = await fetch(origin + "/sitemap.xml");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(await response.text()).toBe("<urlset/>");
  });
});
