import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendBusinessMail: vi.fn(),
  getBusinessMailProviderStatus: vi.fn(),
  createLog: vi.fn(),
  findOneLog: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findLogs: vi.fn(),
  countLogs: vi.fn(),
  updateAdmin: vi.fn(),
  assertSenderAccess: vi.fn(),
  getAuthorizedProfiles: vi.fn(),
}));

vi.mock("../services/businessMail/BusinessMailService.js", () => ({
  sendBusinessMail: mocks.sendBusinessMail,
  getBusinessMailProviderStatus: mocks.getBusinessMailProviderStatus,
}));

vi.mock("../models/EmailDeliveryLog.js", () => ({
  default: {
    create: mocks.createLog,
    findOne: mocks.findOneLog,
    findByIdAndUpdate: mocks.findByIdAndUpdate,
    find: mocks.findLogs,
    countDocuments: mocks.countLogs,
  },
}));

vi.mock("../models/Admin.js", () => ({ default: { updateOne: mocks.updateAdmin } }));

vi.mock("../services/businessMail/businessMailSenderAccess.js", () => ({
  BUSINESS_MAIL_ACCESS_ROLES: ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"],
  BUSINESS_MAIL_COMMON_SENDER_PROFILE_KEYS: ["EFRUITMANDI_NO_REPLY", "ORCHARD_NO_REPLY"],
  assertBusinessMailSenderAccess: mocks.assertSenderAccess,
  getAuthorizedBusinessMailSenderProfiles: mocks.getAuthorizedProfiles,
  getBusinessMailSenderAccessSummary: vi.fn(() => ({
    businessMailEligible: true,
    matchingPersonalSenderProfile: null,
    personalSenderAvailable: false,
    personalSenderReason: "No controlled sender profile matches the login email.",
    effectiveSenderProfiles: [],
    effectiveSenderCount: 0,
  })),
  getBusinessMailMasterAdminEmail: vi.fn(() => "master@example.test"),
  getGloballyEnabledBusinessMailSenderProfiles: vi.fn(() => []),
  isBusinessMailMasterAdmin: vi.fn(() => false),
  normalizeBusinessMailRestrictedSenderProfileKeys: vi.fn((values) => Array.isArray(values) ? values : []),
  normalizeBusinessMailSenderProfileKeys: vi.fn((values) => Array.isArray(values) ? values : []),
}));

import {
  getBusinessMailLogById,
  listBusinessMailLogs,
  previewBusinessMailMessage,
  sendBusinessMailMessage,
  validateBusinessMailRequestPayload,
} from "./adminBusinessMailController.js";
import { BusinessMailError } from "../services/businessMail/businessMailErrors.js";

const ADMIN_ONE = "507f1f77bcf86cd799439011";
const ADMIN_TWO = "507f191e810c19729de860ea";
const LOG_ID = "507f1f77bcf86cd799439012";

const basePayload = () => ({
  senderProfileKey: "EFRUITMANDI_NO_REPLY",
  to: "recipient@example.test",
  subject: "Controlled test",
  text: "Plain-text content",
  category: "GENERAL",
  metadata: { source: "ADMIN_PANEL", correlationId: "reference-1" },
});

const createRequest = (body = basePayload(), overrides = {}) => ({
  body,
  query: {},
  params: {},
  user: { id: ADMIN_ONE, role: "ADMIN" },
  admin: { _id: ADMIN_ONE, name: "Admin One", email: "admin@example.test", role: "ADMIN", status: "ACTIVE", adminClass: "CLASS_I" },
  ...overrides,
});

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const queryResult = (value) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
  lean: vi.fn().mockResolvedValue(value),
});

const makeLog = (overrides = {}) => ({
  _id: LOG_ID,
  category: "GENERAL",
  senderProfileKey: "EFRUITMANDI_NO_REPLY",
  senderName: "eFruitMandi",
  senderEmail: "no-reply@efruitmandi.live",
  replyTo: "support@efruitmandi.live",
  recipient: "recipient@example.test",
  subject: "Controlled test",
  provider: "brevo_api",
  providerMessageId: "",
  status: "PROCESSING",
  requestedByAdmin: ADMIN_ONE,
  requestedByAdminEmail: "admin@example.test",
  requestedByAdminRole: "ADMIN",
  metadata: { source: "ADMIN_PANEL", correlationId: "reference-1" },
  createdAt: new Date("2026-07-22T00:00:00.000Z"),
  sentAt: null,
  failedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BUSINESS_MAIL_EFRUITMANDI_NO_REPLY_ENABLED = "true";
  mocks.getBusinessMailProviderStatus.mockReturnValue({
    provider: "brevo_api",
    configured: true,
    enabledSenderProfileKeys: ["EFRUITMANDI_NO_REPLY"],
  });
  mocks.findOneLog.mockImplementation(() => queryResult(null));
  mocks.createLog.mockImplementation(async (record) => makeLog(record));
  mocks.findByIdAndUpdate.mockResolvedValue(null);
  mocks.updateAdmin.mockResolvedValue({ acknowledged: true });
  mocks.assertSenderAccess.mockResolvedValue({
    key: "EFRUITMANDI_NO_REPLY",
    enabled: true,
    sender: { name: "eFruitMandi", email: "no-reply@efruitmandi.live" },
    replyTo: { email: "support@efruitmandi.live" },
    replyCapable: false,
  });
  mocks.getAuthorizedProfiles.mockResolvedValue([]);
  mocks.sendBusinessMail.mockResolvedValue({
    success: true,
    provider: "brevo_api",
    providerMessageId: "provider-id",
    accepted: ["recipient@example.test"],
    rejected: [],
    status: "SENT",
    sentAt: "2026-07-22T00:00:01.000Z",
  });
});

describe("Admin Business Mail payload validation", () => {
  it.each([
    ["missing recipient", (body) => { delete body.to; }],
    ["invalid recipient", (body) => { body.to = "invalid"; }],
    ["recipient array", (body) => { body.to = ["one@example.test"]; }],
    ["comma recipients", (body) => { body.to = "one@example.test,two@example.test"; }],
    ["arbitrary from", (body) => { body.from = "other@example.test"; }],
    ["sender object", (body) => { body.sender = { email: "other@example.test" }; }],
    ["provider", (body) => { body.provider = "smtp"; }],
    ["SMTP credentials", (body) => { body.smtpPass = "not-accepted"; }],
    ["CC", (body) => { body.cc = "other@example.test"; }],
    ["BCC", (body) => { body.bcc = "other@example.test"; }],
    ["unsafe attachment", (body) => { body.attachments = [{ filename: "run.exe", contentType: "application/x-msdownload", content: "dGVzdA==" }]; }],
    ["client signature", (body) => { body.signature = "replace footer"; }],
    ["missing sender profile", (body) => { delete body.senderProfileKey; }],
    ["empty subject", (body) => { body.subject = ""; }],
    ["CRLF subject", (body) => { body.subject = "Hello\r\nBcc: bad@example.test"; }],
    ["missing content", (body) => { delete body.text; delete body.html; }],
    ["oversized subject", (body) => { body.subject = "x".repeat(201); }],
    ["unsupported category", (body) => { body.category = "CAMPAIGN"; }],
    ["uncontrolled metadata", (body) => { body.metadata = { arbitrary: "value" }; }],
    ["nested metadata", (body) => { body.metadata = { source: { nested: true } }; }],
  ])("rejects %s", (_label, mutate) => {
    const body = basePayload();
    mutate(body);
    expect(() => validateBusinessMailRequestPayload(body)).toThrow();
  });

  it("accepts the documented bounded payload", () => {
    expect(validateBusinessMailRequestPayload(basePayload())).toMatchObject({
      senderProfileKey: "EFRUITMANDI_NO_REPLY",
      to: "recipient@example.test",
      category: "GENERAL",
    });
  });

  it("accepts bounded CC, BCC, and safe attachment payloads", () => {
    const result = validateBusinessMailRequestPayload({
      ...basePayload(),
      cc: ["copy@example.test"],
      bcc: ["audit@example.test"],
      attachments: [{
        filename: "report.pdf",
        contentType: "application/pdf",
        content: Buffer.from("safe report").toString("base64"),
      }],
    });
    expect(result.cc).toEqual(["copy@example.test"]);
    expect(result.bcc).toEqual(["audit@example.test"]);
    expect(result.attachments[0]).toMatchObject({ filename: "report.pdf", size: 11 });
  });
});

describe("Admin Business Mail controlled preview", () => {
  it("uses the same signed content as send without creating a preview log", async () => {
    const previewResponse = createResponse();
    await previewBusinessMailMessage(
      createRequest({ senderProfileKey: "EFRUITMANDI_NO_REPLY", text: "Hello" }),
      previewResponse
    );

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.preview.text).toContain("eFruitMandi");
    expect(mocks.createLog).not.toHaveBeenCalled();

    await sendBusinessMailMessage(createRequest({ ...basePayload(), text: "Hello" }), createResponse());
    const sentRequest = mocks.sendBusinessMail.mock.calls[0][0];
    expect(sentRequest.text).toBe(previewResponse.body.preview.text);
  });

  it("rejects a client-injected controlled signature marker", async () => {
    const response = createResponse();
    await previewBusinessMailMessage(
      createRequest({
        senderProfileKey: "EFRUITMANDI_NO_REPLY",
        text: "Hello\n-- \neFruitMandi\nOrchard Growers Private Limited",
      }),
      response
    );
    expect(response.statusCode).toBe(400);
    expect(mocks.createLog).not.toHaveBeenCalled();
  });
});

describe("Admin Business Mail delivery logging", () => {
  it("returns 403 before logging or provider delivery for an unauthorized sender", async () => {
    mocks.assertSenderAccess.mockRejectedValue(
      new BusinessMailError(
        "BUSINESS_MAIL_SENDER_ACCESS_DENIED",
        "You are not authorized to use this Business Mail sender profile.",
        { statusCode: 403 }
      )
    );
    const response = createResponse();
    await sendBusinessMailMessage(
      createRequest({ ...basePayload(), senderProfileKey: "EFRUITMANDI_CAREER" }),
      response
    );

    expect(response.statusCode).toBe(403);
    expect(mocks.createLog).not.toHaveBeenCalled();
    expect(mocks.sendBusinessMail).not.toHaveBeenCalled();
  });

  it("delivers with an authorized login-matched personal profile", async () => {
    mocks.assertSenderAccess.mockResolvedValueOnce({
      key: "SALES_ORCHARD",
      enabled: true,
      sender: { name: "Orchard Growers Sales", email: "sales@orchardgrowers.in" },
      replyTo: { email: "sales@orchardgrowers.in" },
      replyCapable: true,
    });
    const response = createResponse();
    await sendBusinessMailMessage(
      createRequest({ ...basePayload(), senderProfileKey: "SALES_ORCHARD" }),
      response
    );

    expect(response.statusCode).toBe(200);
    expect(mocks.assertSenderAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: ADMIN_ONE }),
      "SALES_ORCHARD"
    );
    expect(mocks.sendBusinessMail).toHaveBeenCalledOnce();
  });

  it("rejects an arbitrary sender profile key before authorization or delivery", async () => {
    const response = createResponse();
    await sendBusinessMailMessage(
      createRequest({ ...basePayload(), senderProfileKey: "ARBITRARY_FROM_ADDRESS" }),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(mocks.assertSenderAccess).not.toHaveBeenCalled();
    expect(mocks.sendBusinessMail).not.toHaveBeenCalled();
  });

  it("creates PROCESSING before provider delivery and records SENT without bodies", async () => {
    const request = createRequest({ ...basePayload(), html: "<p>Safe content</p>" });
    const response = createResponse();
    await sendBusinessMailMessage(request, response);

    expect(response.statusCode).toBe(200);
    expect(mocks.createLog).toHaveBeenCalledWith(expect.objectContaining({
      status: "PROCESSING",
      requestedByAdmin: ADMIN_ONE,
      requestedByAdminName: "Admin One",
      requestedByAdminEmail: "admin@example.test",
    }));
    const stored = mocks.createLog.mock.calls[0][0];
    expect(stored).not.toHaveProperty("text");
    expect(stored).not.toHaveProperty("html");
    expect(stored).not.toHaveProperty("credentials");
    expect(mocks.createLog.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendBusinessMail.mock.invocationCallOrder[0]);
    expect(mocks.sendBusinessMail).toHaveBeenCalledWith(expect.any(Object), { skipDeliveryLog: true });
    expect(mocks.assertSenderAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: ADMIN_ONE, email: "admin@example.test" }),
      "EFRUITMANDI_NO_REPLY"
    );
    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(LOG_ID, {
      $set: expect.objectContaining({ status: "SENT", providerMessageId: "provider-id" }),
    });
  });

  it("logs copy recipients and attachment metadata without attachment content", async () => {
    const content = Buffer.from("confidential attachment bytes").toString("base64");
    await sendBusinessMailMessage(createRequest({
      ...basePayload(),
      cc: ["copy@example.test"],
      bcc: ["audit@example.test"],
      attachments: [{ filename: "report.pdf", contentType: "application/pdf", content }],
    }), createResponse());

    const stored = mocks.createLog.mock.calls[0][0];
    expect(stored.ccRecipients).toEqual(["copy@example.test"]);
    expect(stored.bccRecipients).toEqual(["audit@example.test"]);
    expect(stored.attachments).toEqual([{
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 29,
    }]);
    expect(JSON.stringify(stored)).not.toContain(content);
    expect(mocks.sendBusinessMail.mock.calls[0][0].attachments[0].content).toBe(content);
  });

  it("records FAILED with a bounded safe failure message", async () => {
    const longMessage = "Provider send failed. ".repeat(50);
    mocks.sendBusinessMail.mockRejectedValue(
      new BusinessMailError("BUSINESS_MAIL_SEND_FAILED", longMessage)
    );
    const response = createResponse();
    await sendBusinessMailMessage(createRequest(), response);

    expect(response.statusCode).toBe(502);
    const failedUpdate = mocks.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(failedUpdate.status).toBe("FAILED");
    expect(failedUpdate.failureMessage.length).toBeLessThanOrEqual(500);
    expect(failedUpdate.failedAt).toBeInstanceOf(Date);
  });
});

describe("Admin Business Mail idempotency", () => {
  it("replays SENT without another provider call", async () => {
    mocks.findOneLog.mockImplementation(() => queryResult(makeLog({ status: "SENT", providerMessageId: "existing" })));
    const response = createResponse();
    await sendBusinessMailMessage(
      createRequest({ ...basePayload(), idempotencyKey: "same-key" }),
      response
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.idempotentReplay).toBe(true);
    expect(mocks.sendBusinessMail).not.toHaveBeenCalled();
  });

  it("returns conflict for PROCESSING or FAILED keys", async () => {
    for (const status of ["PROCESSING", "FAILED"]) {
      mocks.findOneLog.mockImplementation(() => queryResult(makeLog({ status })));
      const response = createResponse();
      await sendBusinessMailMessage(createRequest({ ...basePayload(), idempotencyKey: "same-key" }), response);
      expect(response.statusCode).toBe(409);
    }
    expect(mocks.sendBusinessMail).not.toHaveBeenCalled();
  });

  it("scopes identical keys to the authenticated admin", async () => {
    const responseOne = createResponse();
    const responseTwo = createResponse();
    await sendBusinessMailMessage(createRequest({ ...basePayload(), idempotencyKey: "shared-key" }), responseOne);
    await sendBusinessMailMessage(
      createRequest(
        { ...basePayload(), idempotencyKey: "shared-key" },
        {
          user: { id: ADMIN_TWO, role: "ADMIN" },
          admin: { _id: ADMIN_TWO, email: "admin2@example.test", role: "ADMIN", status: "ACTIVE", adminClass: "CLASS_I" },
        }
      ),
      responseTwo
    );
    expect(mocks.findOneLog.mock.calls[0][0].requestedByAdmin).toBe(ADMIN_ONE);
    expect(mocks.findOneLog.mock.calls[1][0].requestedByAdmin).toBe(ADMIN_TWO);
    expect(mocks.sendBusinessMail).toHaveBeenCalledTimes(2);
  });

  it("keeps no-key requests independent", async () => {
    await sendBusinessMailMessage(createRequest(), createResponse());
    await sendBusinessMailMessage(createRequest(), createResponse());
    expect(mocks.findOneLog).not.toHaveBeenCalled();
    expect(mocks.createLog).toHaveBeenCalledTimes(2);
    expect(mocks.sendBusinessMail).toHaveBeenCalledTimes(2);
  });

  it("handles a duplicate-key creation race without resending", async () => {
    let lookup = 0;
    mocks.findOneLog.mockImplementation(() => queryResult(lookup++ === 0 ? null : makeLog({ status: "SENT" })));
    mocks.createLog.mockRejectedValue(Object.assign(new Error("duplicate"), { code: 11000 }));
    const response = createResponse();
    await sendBusinessMailMessage(createRequest({ ...basePayload(), idempotencyKey: "race-key" }), response);
    expect(response.statusCode).toBe(200);
    expect(response.body.idempotentReplay).toBe(true);
    expect(mocks.sendBusinessMail).not.toHaveBeenCalled();
  });
});

describe("Admin Business Mail log queries", () => {
  it("bounds pagination and filters sales logs by ownership", async () => {
    const lean = vi.fn().mockResolvedValue([makeLog()]);
    const limit = vi.fn().mockReturnValue({ lean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    mocks.findLogs.mockReturnValue({ sort });
    mocks.countLogs.mockResolvedValue(1);
    const request = createRequest(undefined, {
      query: { page: "1", limit: "1000", status: "SENT" },
      admin: { _id: ADMIN_ONE, email: "sales@example.test", role: "SALES_EXECUTIVE" },
      user: { id: ADMIN_ONE, role: "SALES_EXECUTIVE" },
    });
    const response = createResponse();
    await listBusinessMailLogs(request, response);
    expect(limit).toHaveBeenCalledWith(100);
    expect(mocks.findLogs).toHaveBeenCalledWith({ status: "SENT", requestedByAdmin: ADMIN_ONE });
    expect(response.body.logs[0]).not.toHaveProperty("idempotencyKeyHash");
    expect(response.body.logs[0]).not.toHaveProperty("text");
  });

  it("rejects invalid filters", async () => {
    const response = createResponse();
    await listBusinessMailLogs(createRequest(undefined, { query: { status: "$ne" } }), response);
    expect(response.statusCode).toBe(400);
  });

  it("escapes recipient search before applying a case-insensitive filter", async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ lean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    mocks.findLogs.mockReturnValue({ sort });
    mocks.countLogs.mockResolvedValue(0);
    const response = createResponse();
    await listBusinessMailLogs(createRequest(undefined, { query: { recipient: "person+tag@example.test" } }), response);
    expect(mocks.findLogs).toHaveBeenCalledWith({
      recipient: { $regex: "person\\+tag@example\\.test", $options: "i" },
    });
    expect(response.body.items).toEqual(response.body.logs);
  });

  it("uses ownership in sales log detail lookup and hides unavailable records", async () => {
    mocks.findOneLog.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const response = createResponse();
    await getBusinessMailLogById(
      createRequest(undefined, {
        params: { id: LOG_ID },
        admin: { _id: ADMIN_ONE, email: "sales@example.test", role: "SALES_EXECUTIVE" },
        user: { id: ADMIN_ONE, role: "SALES_EXECUTIVE" },
      }),
      response
    );
    expect(mocks.findOneLog).toHaveBeenCalledWith({ _id: LOG_ID, requestedByAdmin: ADMIN_ONE });
    expect(response.statusCode).toBe(404);
  });
});
