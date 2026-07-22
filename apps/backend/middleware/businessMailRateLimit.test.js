import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBusinessMailSendRateLimit,
  resetBusinessMailRateLimitsForTests,
} from "./businessMailRateLimit.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  set(name, value) { this.headers[name] = value; return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

beforeEach(() => resetBusinessMailRateLimitsForTests());

describe("Business Mail rate limits", () => {
  it("limits excessive sends by authenticated admin", () => {
    const limiter = createBusinessMailSendRateLimit({ adminMax: 2, dailyMax: 10, globalMax: 20 });
    const next = vi.fn();
    const request = { user: { id: "admin-1" } };
    limiter(request, createResponse(), next);
    limiter(request, createResponse(), next);
    const denied = createResponse();
    limiter(request, denied, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(denied.statusCode).toBe(429);
  });

  it("applies the global limit across different admins", () => {
    const limiter = createBusinessMailSendRateLimit({ adminMax: 10, dailyMax: 10, globalMax: 2 });
    const next = vi.fn();
    limiter({ user: { id: "admin-1" } }, createResponse(), next);
    limiter({ user: { id: "admin-2" } }, createResponse(), next);
    const denied = createResponse();
    limiter({ user: { id: "admin-3" } }, denied, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(denied.statusCode).toBe(429);
  });

  it("rejects requests without authenticated admin context", () => {
    const limiter = createBusinessMailSendRateLimit();
    const response = createResponse();
    limiter({}, response, vi.fn());
    expect(response.statusCode).toBe(401);
  });
});

