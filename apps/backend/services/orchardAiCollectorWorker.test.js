import { afterEach, describe, expect, it } from "vitest";
import {
  getOrchardAiCollectorStartBlockReason,
  ORCHARD_AI_COLLECTOR_JOBS,
  startOrchardAiCollectorWorker,
  stopOrchardAiCollectorWorker,
} from "./orchardAiCollectorWorker.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnabled = process.env.ORCHARD_AI_COLLECTOR_ENABLED;
const originalSearchProvider = process.env.SEARCH_PROVIDER;

afterEach(() => {
  stopOrchardAiCollectorWorker();
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEnabled === undefined) delete process.env.ORCHARD_AI_COLLECTOR_ENABLED;
  else process.env.ORCHARD_AI_COLLECTOR_ENABLED = originalEnabled;
  if (originalSearchProvider === undefined) delete process.env.SEARCH_PROVIDER;
  else process.env.SEARCH_PROVIDER = originalSearchProvider;
});

describe("Orchard AI collector worker", () => {
  it("uses only the configured safe rotating jobs with a maximum of 10 results", () => {
    expect(ORCHARD_AI_COLLECTOR_JOBS).toHaveLength(6);
    expect(ORCHARD_AI_COLLECTOR_JOBS.every((job) => job.limit <= 10)).toBe(true);
    expect(ORCHARD_AI_COLLECTOR_JOBS.map((job) => job.category)).toEqual([
      "buyers",
      "buyers",
      "buyers",
      "growers",
      "markets",
      "exporters",
    ]);
  });

  it("never starts during tests even when the enable flag is true", () => {
    process.env.NODE_ENV = "test";
    process.env.ORCHARD_AI_COLLECTOR_ENABLED = "true";

    expect(startOrchardAiCollectorWorker()).toEqual({
      started: false,
      reason: "test_runtime",
    });
  });

  it("blocks startup when the search provider is disabled outside test runtime", () => {
    expect(
      getOrchardAiCollectorStartBlockReason({
        testRuntime: false,
        workerEnabled: true,
        searchProviderEnabled: false,
      })
    ).toBe("search_provider_disabled");
  });
});
