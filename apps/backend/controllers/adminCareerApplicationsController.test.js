import { describe, expect, it } from "vitest";
import { buildCareerFilter } from "./adminCareerApplicationsController.js";

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
});
