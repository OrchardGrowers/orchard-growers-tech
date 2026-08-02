import { describe, expect, it } from "vitest";
import { buildCareerFilter, parseCareerSearchEntries } from "./adminCareerApplicationsController.js";

describe("career application rating filters", () => {
  it("filters by an exact candidate rating", () => {
    expect(buildCareerFilter({ rating: "5" })).toEqual({ rating: 5 });
  });

  it("filters candidates that have not been rated", () => {
    expect(buildCareerFilter({ rating: "UNRATED" })).toEqual({ rating: null });
  });

  it("ignores unsupported rating values", () => {
    expect(buildCareerFilter({ rating: "6" })).toEqual({});
  });
});

describe("career application candidate search", () => {
  it("searches each part of a candidate name across stored name fields", () => {
    const filter = buildCareerFilter({ search: "Ravi Kumar" });

    expect(filter.$and).toHaveLength(2);
    expect(filter.$and[0].$or.some(({ candidateName }) => candidateName?.test("Ravi"))).toBe(true);
    expect(filter.$and[1].$or.some(({ applicantName }) => applicantName?.test("Kumar"))).toBe(true);
  });

  it("also searches reply-to names and the email body preview", () => {
    const filter = buildCareerFilter({ search: "Priya" });
    const fields = filter.$and[0].$or.flatMap((condition) => Object.keys(condition));

    expect(fields).toContain("replyToName");
    expect(fields).toContain("bodyPreview");
  });

  it("matches any candidate from a pasted list while keeping full names together", () => {
    const filter = buildCareerFilter({ search: "Ravi Kumar\nPriya Sharma" });
    const bulkSearch = filter.$and[0].$or;

    expect(bulkSearch).toHaveLength(2);
    expect(bulkSearch[0].$and).toHaveLength(2);
    expect(bulkSearch[1].$and[0].$or.some(({ candidateName }) => candidateName?.test("Priya"))).toBe(true);
  });

  it("accepts comma and semicolon separated email and phone lists", () => {
    expect(parseCareerSearchEntries("one@example.com, two@example.com; 98765 43210")).toEqual([
      "one@example.com", "two@example.com", "98765 43210",
    ]);
    const filter = buildCareerFilter({ search: "+91 98765-43210\nuser@example.com" });
    const [phoneClause, emailClause] = filter.$and[0].$or;

    expect(phoneClause.$or.some(({ normalizedContactNumber }) => normalizedContactNumber?.test("9876543210"))).toBe(true);
    expect(emailClause.$or.some(({ email }) => email?.test("USER@example.com"))).toBe(true);
  });

  it("removes duplicate bulk entries without changing their order", () => {
    expect(parseCareerSearchEntries("Ravi\nPriya\nRavi")).toEqual(["Ravi", "Priya"]);
  });
});
