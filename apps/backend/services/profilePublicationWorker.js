import cron from "node-cron";
import ProfilePublication from "../models/ProfilePublication.js";
import User from "../models/User.js";
import {
  buildPublicProfileSnapshot,
  discoverEligibleProfilePublications,
} from "./profilePublicationService.js";
import {
  getLinkedInPublisherConfig,
  getSafeLinkedInError,
  publishProfileToLinkedIn,
} from "./linkedinProfilePublisher.js";

const LOCK_DURATION_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;
let running = false;
let task = null;

const getRetryDate = (attemptCount = 1) => {
  const delayMinutes = Math.min(2 ** Math.max(attemptCount - 1, 0), 360);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
};

const claimNextPublication = async () => {
  const now = new Date();
  return ProfilePublication.findOneAndUpdate(
    {
      linkedinStatus: { $in: ["pending", "retry"] },
      nextAttemptAt: { $lte: now },
      $or: [
        { lockedUntil: { $exists: false } },
        { lockedUntil: null },
        { lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        linkedinStatus: "processing",
        lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
        lastError: "",
      },
      $inc: { attemptCount: 1 },
    },
    { new: true, sort: { rssPublishedAt: 1, _id: 1 } }
  );
};

const finishAsNotPublishable = async (publication, reason) => {
  publication.linkedinStatus = "failed";
  publication.lastError = reason;
  publication.lockedUntil = null;
  await publication.save();
};

const handlePublishError = async (publication, error) => {
  const safeError = getSafeLinkedInError(error);
  const ambiguousPostResult =
    safeError.stage === "post_create_ambiguous" ||
    (safeError.stage === "post_create" && (!safeError.status || safeError.status >= 500));
  const retryableHttpStatus =
    safeError.status === 408 ||
    safeError.status === 409 ||
    safeError.status === 429 ||
    safeError.status >= 500;
  const retryableStage = [
    "image_download",
    "image_initialize",
    "image_upload",
  ].includes(safeError.stage);
  const mayRetry =
    !ambiguousPostResult &&
    publication.attemptCount < MAX_ATTEMPTS &&
    (retryableStage || retryableHttpStatus);

  publication.linkedinStatus = ambiguousPostResult
    ? "needs_review"
    : mayRetry
      ? "retry"
      : "failed";
  publication.lastError = `${safeError.stage}${
    safeError.status ? ` (${safeError.status})` : ""
  }: ${safeError.message}`;
  publication.nextAttemptAt = mayRetry
    ? getRetryDate(publication.attemptCount)
    : publication.nextAttemptAt;
  publication.lockedUntil = null;
  await publication.save();
};

const publishClaimedRecord = async (publication) => {
  const user = await User.findById(publication.user).lean();
  if (!user) {
    await finishAsNotPublishable(publication, "Profile owner no longer exists");
    return;
  }

  const currentProfile = buildPublicProfileSnapshot(user, publication.profileRole);
  if (!currentProfile.eligible) {
    await finishAsNotPublishable(
      publication,
      `Profile is no longer eligible: ${currentProfile.reason}`
    );
    return;
  }

  try {
    const result = await publishProfileToLinkedIn(publication.snapshot);
    publication.linkedinStatus = "published";
    publication.linkedinPostUrn = result.postUrn;
    publication.linkedinPublishedAt = new Date();
    publication.lastError = "";
    publication.lockedUntil = null;
    await publication.save();
  } catch (error) {
    await handlePublishError(publication, error);
  }
};

export const runProfilePublicationCycle = async () => {
  if (running) return { skipped: true, reason: "already_running" };
  running = true;

  try {
    const discovery = await discoverEligibleProfilePublications();
    const config = getLinkedInPublisherConfig();
    if (!config.enabled) {
      return { discovery, publishing: "disabled", processed: 0 };
    }
    if (!config.accessToken || !config.organizationUrn) {
      return { discovery, publishing: "not_configured", processed: 0 };
    }

    await ProfilePublication.updateMany(
      { linkedinStatus: "disabled", linkedinPostUrn: "" },
      { $set: { linkedinStatus: "pending", nextAttemptAt: new Date() } }
    );
    await ProfilePublication.updateMany(
      { linkedinStatus: "processing", lockedUntil: { $lte: new Date() } },
      { $set: { linkedinStatus: "retry", lockedUntil: null, nextAttemptAt: new Date() } }
    );

    let processed = 0;
    const batchSize = Math.min(
      Math.max(Number(process.env.PROFILE_PUBLISHER_BATCH_SIZE) || 5, 1),
      25
    );
    while (processed < batchSize) {
      const publication = await claimNextPublication();
      if (!publication) break;
      await publishClaimedRecord(publication);
      processed += 1;
    }

    return { discovery, publishing: "enabled", processed };
  } finally {
    running = false;
  }
};

export const startProfilePublicationWorker = () => {
  if (task) return task;

  const schedule = process.env.PROFILE_PUBLISHER_CRON || "*/2 * * * *";
  if (!cron.validate(schedule)) {
    console.error("Profile publisher disabled: PROFILE_PUBLISHER_CRON is invalid.");
    return null;
  }

  task = cron.schedule(schedule, () => {
    void runProfilePublicationCycle().catch((error) => {
      console.error("Profile publication cycle failed:", error?.message || error);
    });
  });

  void runProfilePublicationCycle()
    .then((summary) => {
      if (summary?.discovery?.queued) {
        console.log(`Profile publisher queued ${summary.discovery.queued} new RSS item(s).`);
      }
    })
    .catch((error) => {
      console.error("Initial profile publication cycle failed:", error?.message || error);
    });

  return task;
};
