import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_CUSTOM_SEARCH_ACCESS_DENIED_MESSAGE,
  buildCollectedLeadPayload,
  collectOrchardAiLeadsFromGoogle,
  normalizeCollectorRequest,
} from "./orchardAiCollectorService.js";

const actorId = new mongoose.Types.ObjectId().toString();

describe("Orchard AI collector service", () => {
  it("does not call Google when the search provider is disabled", async () => {
    const search = vi.fn();
    const summary = await collectOrchardAiLeadsFromGoogle(
      {
        category: "buyers",
        fruit: "Apple",
        state: "India",
        leadType: "Buyer",
        limit: 5,
        actorId,
      },
      { search, LeadModel: {} }
    );

    expect(search).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      ok: false,
      disabled: true,
      created: 0,
      skipped: 0,
      errors: 0,
    });
  });

  it("normalizes safe collector input and caps Google jobs at 10 results", () => {
    const request = normalizeCollectorRequest({
      category: "BUYERS",
      query: " apple buyers ",
      fruit: "Apple",
      state: "Maharashtra",
      leadType: "buyer",
      limit: 100,
      actorId,
    });

    expect(request).toMatchObject({
      category: "buyers",
      query: "apple buyers",
      fruit: "Apple",
      state: "Maharashtra",
      leadType: "Buyer",
      limit: 10,
      actorId,
    });
  });

  it("maps a Google result to the required Lead fields", () => {
    const request = normalizeCollectorRequest({
      category: "exporters",
      query: "apple exporters India",
      fruit: "Apple",
      state: "India",
      leadType: "Exporter",
      limit: 5,
      actorId,
    });
    const payload = buildCollectedLeadPayload({
      request,
      resolvedQuery: request.query,
      result: {
        title: "Himalayan Fresh Exports",
        snippet: "Premium apple exporter.",
        link: "https://example.com/export",
        displayLink: "example.com",
      },
    });

    expect(payload).toMatchObject({
      companyName: "Himalayan Fresh Exports",
      contactPerson: "To be verified",
      leadType: "Exporter",
      fruits: ["Apple"],
      state: "India",
      website: "https://example.com/export",
      sourceUrl: "https://example.com/export",
      sourcePlatform: "example.com",
      score: 40,
      priority: "Medium",
      status: "New",
      tags: ["ai-collected", "google-cse", "needs-verification"],
      createdBy: actorId,
      updatedBy: actorId,
    });
    expect(payload.notes).toContain("Premium apple exporter.");
    expect(payload.notes).toContain("apple exporters India");
  });

  it("continues after duplicates and invalid individual results", async () => {
    const findOne = vi.fn((filter) => ({
      select: () => ({
        lean: async () => {
          const companyFilter = filter.$or.find((condition) => condition.companyName);
          return companyFilter?.companyName.test("Existing Company")
            ? { _id: new mongoose.Types.ObjectId() }
            : null;
        },
      }),
    }));
    const create = vi.fn(async (payload) => ({
      ...payload,
      _id: new mongoose.Types.ObjectId(),
    }));
    const search = vi.fn(async () => ({
      category: "buyers",
      query: "apple buyers India",
      totalResults: 3,
      results: [
        {
          title: "Existing Company",
          snippet: "Already collected.",
          link: "https://existing.example.com",
          displayLink: "existing.example.com",
        },
        {
          title: "New Buyer Company",
          snippet: "A new buyer.",
          link: "https://new-buyer.example.com",
          displayLink: "new-buyer.example.com",
        },
        {
          title: "Invalid Result",
          snippet: "Missing a usable URL.",
          link: "ftp://invalid.example.com",
          displayLink: "invalid.example.com",
        },
      ],
    }));

    const summary = await collectOrchardAiLeadsFromGoogle(
      {
        category: "buyers",
        fruit: "Apple",
        state: "India",
        leadType: "Buyer",
        limit: 10,
        actorId,
      },
      {
        search,
        LeadModel: { findOne, create },
        allowDisabledProvider: true,
      }
    );

    expect(summary).toMatchObject({
      created: 1,
      skipped: 1,
      errors: 1,
      resultCount: 3,
    });
    expect(summary.createdLeads[0].companyName).toBe("New Buyer Company");
    expect(summary.skippedItems[0].companyName).toBe("Existing Company");
    expect(summary.errorItems[0].companyName).toBe("Invalid Result");
  });

  it("returns the required safe message for Google 403 responses", async () => {
    const search = vi.fn(async () => {
      throw {
        response: {
          status: 403,
          config: {
            params: {
              key: "must-never-be-returned",
            },
          },
        },
      };
    });

    const summary = await collectOrchardAiLeadsFromGoogle(
      {
        category: "buyers",
        fruit: "Apple",
        state: "India",
        leadType: "Buyer",
        limit: 5,
        actorId,
      },
      { search, LeadModel: {}, allowDisabledProvider: true }
    );

    expect(summary).toMatchObject({
      ok: false,
      created: 0,
      skipped: 0,
      errors: 1,
      message: GOOGLE_CUSTOM_SEARCH_ACCESS_DENIED_MESSAGE,
    });
    expect(JSON.stringify(summary)).not.toContain("must-never-be-returned");
  });
});
