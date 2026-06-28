import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import {
  extractOrchardAiLeadFromUrl,
  isPublicIpAddress,
} from "./orchardAiUrlExtractorService.js";

const actorId = new mongoose.Types.ObjectId().toString();

const createLeadModel = ({ duplicate = null } = {}) => ({
  findOne: vi.fn(() => ({
    select: () => ({
      lean: async () => duplicate,
    }),
  })),
  create: vi.fn(async (payload) => ({
    ...payload,
    _id: new mongoose.Types.ObjectId(),
  })),
});

describe("Orchard AI URL extractor", () => {
  it("identifies private and public IP ranges", () => {
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("10.20.30.40")).toBe(false);
    expect(isPublicIpAddress("192.168.1.10")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
  });

  it("blocks localhost before any HTTP request", async () => {
    const fetchPage = vi.fn();
    const result = await extractOrchardAiLeadFromUrl(
      {
        url: "http://127.0.0.1/private",
        leadType: "Buyer",
        fruit: "Apple",
        actorId,
      },
      {
        fetchPage,
        LeadModel: createLeadModel(),
      }
    );

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      created: 0,
      errors: 1,
    });
    expect(result.message).toMatch(/private IP/i);
  });

  it("extracts public HTML into a Lead payload", async () => {
    const LeadModel = createLeadModel();
    const fetchPage = vi.fn(async () => `
      <html>
        <head><title>Fresh Apple Buyer</title></head>
        <body>
          <h1>Fresh Apple Buyer</h1>
          <p>Wholesale apple buyer in Delhi. Call +91 98765 43210.</p>
          <p>Email sales@freshbuyer.example</p>
        </body>
      </html>
    `);

    const result = await extractOrchardAiLeadFromUrl(
      {
        url: "https://freshbuyer.example/company",
        leadType: "Buyer",
        fruit: "Apple",
        city: "Delhi",
        state: "Delhi",
        actorId,
      },
      { fetchPage, LeadModel }
    );

    expect(result).toMatchObject({
      ok: true,
      created: 1,
      skipped: 0,
      errors: 0,
    });
    expect(LeadModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Fresh Apple Buyer",
        contactPerson: "To be verified",
        leadType: "Buyer",
        fruits: ["Apple"],
        phone: "+91 98765 43210",
        email: "sales@freshbuyer.example",
        website: "https://freshbuyer.example",
        sourceUrl: "https://freshbuyer.example/company",
        tags: ["url-extracted", "public-data", "needs-verification"],
        score: 35,
        priority: "Medium",
        status: "New",
      })
    );
  });

  it("refuses CAPTCHA pages without trying to save a lead", async () => {
    const LeadModel = createLeadModel();
    const result = await extractOrchardAiLeadFromUrl(
      {
        url: "https://protected.example/",
        leadType: "Buyer",
        actorId,
      },
      {
        fetchPage: async () => "<html><title>Verify you are human</title><body>CAPTCHA</body></html>",
        LeadModel,
      }
    );

    expect(result).toMatchObject({
      ok: false,
      created: 0,
      errors: 1,
    });
    expect(LeadModel.create).not.toHaveBeenCalled();
  });
});
