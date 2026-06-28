import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import {
  buildLeadFilter,
  parseLeadPagination,
  sanitizeLeadPayload,
} from "./orchardAiLeadController.js";
import Lead, {
  normalizeLeadEmail,
  normalizeLeadPhone,
  normalizeLeadWebsite,
} from "../models/Lead.js";

const adminId = new mongoose.Types.ObjectId();

describe("Orchard Growers AI Lead model", () => {
  it("normalizes duplicate-detection values without exposing format differences", () => {
    expect(normalizeLeadPhone("+91 98765-43210")).toBe("919876543210");
    expect(normalizeLeadEmail(" Admin@Example.COM ")).toBe("admin@example.com");
    expect(normalizeLeadWebsite("https://www.Example.com/")).toBe("example.com");
    expect(normalizeLeadWebsite("example.com")).toBe("example.com");
  });

  it("defines unique sparse indexes for phone, email, and website", () => {
    const indexes = Object.fromEntries(
      Lead.schema.indexes().map(([fields, options]) => [options.name, { fields, options }])
    );

    expect(indexes.unique_orchard_ai_lead_phone).toMatchObject({
      fields: { normalizedPhone: 1 },
      options: { unique: true, sparse: true },
    });
    expect(indexes.unique_orchard_ai_lead_email).toMatchObject({
      fields: { normalizedEmail: 1 },
      options: { unique: true, sparse: true },
    });
    expect(indexes.unique_orchard_ai_lead_website).toMatchObject({
      fields: { normalizedWebsite: 1 },
      options: { unique: true, sparse: true },
    });
  });

  it("applies defaults and validates safe field values", async () => {
    const lead = new Lead({
      companyName: "Himalayan Fresh Exports",
      contactPerson: "Aarav Kapoor",
      leadType: "Exporter",
      phone: "+91 98765 43210",
      email: "Aarav@Example.com",
      website: "https://example.com",
      createdBy: adminId,
      updatedBy: adminId,
    });

    await expect(lead.validate()).resolves.toBeUndefined();
    expect(lead.status).toBe("New");
    expect(lead.priority).toBe("Medium");
    expect(lead.normalizedPhone).toBe("919876543210");
    expect(lead.normalizedEmail).toBe("aarav@example.com");
    expect(lead.normalizedWebsite).toBe("example.com");
  });

  it("rejects unsafe URLs and scores outside the allowed range", async () => {
    const lead = new Lead({
      companyName: "Unsafe Lead",
      contactPerson: "Test Person",
      leadType: "Buyer",
      website: "ftp://example.com",
      score: 101,
      createdBy: adminId,
      updatedBy: adminId,
    });

    await expect(lead.validate()).rejects.toMatchObject({
      name: "ValidationError",
    });
  });
});

describe("Orchard Growers AI Lead request validation", () => {
  it("sanitizes create payloads and removes duplicate array values", () => {
    const payload = sanitizeLeadPayload({
      companyName: "  Valley Orchard Network ",
      contactPerson: " Meera Thakur ",
      leadType: "grower",
      fruits: ["Apple", "apple", "Pear"],
      email: "MEERA@EXAMPLE.COM",
      score: 88,
      priority: "high",
      status: "hot",
    });

    expect(payload).toMatchObject({
      companyName: "Valley Orchard Network",
      contactPerson: "Meera Thakur",
      leadType: "Grower",
      fruits: ["apple", "Pear"],
      email: "meera@example.com",
      score: 88,
      priority: "High",
      status: "Hot",
    });
  });

  it("rejects protected fields and empty patch payloads", () => {
    expect(() =>
      sanitizeLeadPayload({
        companyName: "Example",
        contactPerson: "Example Person",
        leadType: "Buyer",
        createdBy: adminId.toString(),
      })
    ).toThrow(/Unsupported fields/);

    expect(() => sanitizeLeadPayload({}, { partial: true })).toThrow(
      /at least one lead field/
    );
    expect(() =>
      sanitizeLeadPayload({
        companyName: "Example",
        contactPerson: "Example Person",
        leadType: "Buyer",
        phone: "not-a-phone",
      })
    ).toThrow(/between 7 and 15 digits/);
  });

  it("builds all supported filters with escaped search expressions", () => {
    const assignedTo = new mongoose.Types.ObjectId().toString();
    const filter = buildLeadFilter({
      search: "Fresh (North)",
      leadType: "buyer",
      fruit: "Apple",
      city: "Shimla",
      state: "Himachal Pradesh",
      status: "qualified",
      assignedTo,
      priority: "urgent",
    });

    expect(filter.leadType).toBe("Buyer");
    expect(filter.status).toBe("Qualified");
    expect(filter.priority).toBe("Urgent");
    expect(filter.assignedTo).toBe(assignedTo);
    expect(filter.fruits.test("apple")).toBe(true);
    expect(filter.city.test("SHIMLA")).toBe(true);
    expect(filter.state.test("himachal pradesh")).toBe(true);
    expect(filter.$or[0].companyName.test("Fresh (North) Exports")).toBe(true);
    expect(filter.$or[0].companyName.test("Fresh North Exports")).toBe(false);
  });

  it("parses bounded pagination values", () => {
    expect(parseLeadPagination({})).toEqual({ page: 1, limit: 25 });
    expect(parseLeadPagination({ page: "3", limit: "50" })).toEqual({
      page: 3,
      limit: 50,
    });
    expect(() => parseLeadPagination({ page: "0" })).toThrow(/between 1/);
    expect(() => parseLeadPagination({ limit: "101" })).toThrow(/between 1/);
  });
});
