import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import {
  SEARCH_PROVIDER_DISABLED_MESSAGE,
  collectOrchardAiLeadsFromGoogle,
  isGoogleSearchProviderEnabled,
} from "./orchardAiCollectorService.js";

const DEFAULT_INTERVAL_MINUTES = 360;
const MINIMUM_INTERVAL_MINUTES = 15;
const STARTUP_DELAY_MS = 10 * 1000;

export const ORCHARD_AI_COLLECTOR_JOBS = [
  {
    category: "buyers",
    query: "apple fruit buyers Maharashtra India",
    fruit: "Apple",
    state: "Maharashtra",
    city: "",
    leadType: "Buyer",
    limit: 10,
  },
  {
    category: "buyers",
    query: "apple fruit buyers Delhi India",
    fruit: "Apple",
    state: "Delhi",
    city: "",
    leadType: "Buyer",
    limit: 10,
  },
  {
    category: "buyers",
    query: "apple fruit buyers Uttar Pradesh India",
    fruit: "Apple",
    state: "Uttar Pradesh",
    city: "",
    leadType: "Buyer",
    limit: 10,
  },
  {
    category: "growers",
    query: "apple growers Himachal Pradesh India",
    fruit: "Apple",
    state: "Himachal Pradesh",
    city: "",
    leadType: "Grower",
    limit: 10,
  },
  {
    category: "markets",
    query: "apple fruit markets India",
    fruit: "Apple",
    state: "India",
    city: "",
    leadType: "Buyer",
    limit: 10,
  },
  {
    category: "exporters",
    query: "apple exporters India",
    fruit: "Apple",
    state: "India",
    city: "",
    leadType: "Exporter",
    limit: 10,
  },
];

let intervalHandle = null;
let startupHandle = null;
let currentJobIndex = 0;
let jobRunning = false;

const truthyEnv = (value = "") =>
  ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());

const isTestRuntime = () =>
  String(process.env.NODE_ENV || "").trim().toLowerCase() === "test" ||
  Boolean(process.env.VITEST) ||
  Boolean(process.env.VITEST_WORKER_ID);

const getIntervalMinutes = () => {
  const configured = Number(process.env.ORCHARD_AI_COLLECTOR_INTERVAL_MINUTES);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_INTERVAL_MINUTES;
  return Math.max(Math.floor(configured), MINIMUM_INTERVAL_MINUTES);
};

const getCollectorAdmin = async () => {
  const configuredAdminId = String(
    process.env.ORCHARD_AI_COLLECTOR_ADMIN_ID || ""
  ).trim();

  if (configuredAdminId && mongoose.isValidObjectId(configuredAdminId)) {
    const configuredAdmin = await Admin.findOne({
      _id: configuredAdminId,
      status: "ACTIVE",
    })
      .select("_id")
      .lean();
    if (configuredAdmin) return configuredAdmin;
  }

  return Admin.findOne({
    status: "ACTIVE",
    role: { $in: ["SUPER_ADMIN", "ADMIN", "EMPLOYEE"] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id")
    .lean();
};

export const runNextOrchardAiCollectorJob = async () => {
  if (jobRunning) {
    // eslint-disable-next-line no-console
    console.warn("[orchard-ai-collector] Previous job is still running; skipping this interval.");
    return {
      started: false,
      reason: "job_already_running",
    };
  }

  jobRunning = true;
  const job = ORCHARD_AI_COLLECTOR_JOBS[currentJobIndex];
  currentJobIndex = (currentJobIndex + 1) % ORCHARD_AI_COLLECTOR_JOBS.length;

  try {
    const admin = await getCollectorAdmin();
    if (!admin) {
      // eslint-disable-next-line no-console
      console.warn("[orchard-ai-collector] Job skipped because no active collector admin is available.");
      return {
        started: false,
        reason: "collector_admin_unavailable",
      };
    }

    // eslint-disable-next-line no-console
    console.log(
      `[orchard-ai-collector] Starting ${job.category} job for ${job.fruit} in ${job.state}.`
    );
    const summary = await collectOrchardAiLeadsFromGoogle({
      ...job,
      actorId: admin._id,
    });

    if (summary.ok) {
      // eslint-disable-next-line no-console
      console.log(
        `[orchard-ai-collector] Job finished: created=${summary.created}, skipped=${summary.skipped}, errors=${summary.errors}.`
      );
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[orchard-ai-collector] Job finished: created=${summary.created}, skipped=${summary.skipped}, errors=${summary.errors}.`
      );
    }
    if (!summary.ok && summary.errorItems?.[0]?.message) {
      // eslint-disable-next-line no-console
      console.warn(`[orchard-ai-collector] ${summary.errorItems[0].message}`);
    }

    return {
      started: true,
      summary,
    };
  } catch {
    // Never print the raw provider error because it may contain request configuration.
    // eslint-disable-next-line no-console
    console.error("[orchard-ai-collector] Job failed safely before completion.");
    return {
      started: true,
      summary: {
        ok: false,
        created: 0,
        skipped: 0,
        errors: 1,
        message: "Collector job failed safely before completion.",
      },
    };
  } finally {
    jobRunning = false;
  }
};

export const startOrchardAiCollectorWorker = () => {
  if (isTestRuntime()) {
    return {
      started: false,
      reason: "test_runtime",
    };
  }

  if (!truthyEnv(process.env.ORCHARD_AI_COLLECTOR_ENABLED)) {
    // eslint-disable-next-line no-console
    console.log("[orchard-ai-collector] Worker disabled.");
    return {
      started: false,
      reason: "disabled",
    };
  }

  if (!isGoogleSearchProviderEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(`[orchard-ai-collector] ${SEARCH_PROVIDER_DISABLED_MESSAGE}`);
    return {
      started: false,
      reason: "search_provider_disabled",
    };
  }

  if (intervalHandle || startupHandle) {
    return {
      started: false,
      reason: "already_started",
    };
  }

  const intervalMinutes = getIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  // eslint-disable-next-line no-console
  console.log(
    `[orchard-ai-collector] Worker enabled with a ${intervalMinutes}-minute interval.`
  );

  startupHandle = setTimeout(() => {
    startupHandle = null;
    void runNextOrchardAiCollectorJob();
  }, STARTUP_DELAY_MS);
  intervalHandle = setInterval(() => {
    void runNextOrchardAiCollectorJob();
  }, intervalMs);

  startupHandle.unref?.();
  intervalHandle.unref?.();

  return {
    started: true,
    intervalMinutes,
  };
};

export const stopOrchardAiCollectorWorker = () => {
  if (startupHandle) clearTimeout(startupHandle);
  if (intervalHandle) clearInterval(intervalHandle);
  startupHandle = null;
  intervalHandle = null;
  jobRunning = false;
};
