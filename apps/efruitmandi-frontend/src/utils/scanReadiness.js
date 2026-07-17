export const SCAN_LOCK_DURATION_MS = 1500;

const makeResult = ({
  state,
  readyForLock = false,
  blockingCode = null,
  blockingReason = null,
  advisoryReason = null,
  signalSummary,
  lockProgress = 0,
}) => ({
  state,
  readyForLock,
  blockingCode,
  blockingReason,
  advisoryReason,
  signalSummary,
  lockProgress,
});

export const evaluateScanReadiness = ({
  scannerActive,
  cameraReady,
  roiReady,
  roiStatus,
  frameQuality = {},
  subjectPlacement = {},
  boundaryCandidates = {},
  fruitCountEstimate = {},
  scanMode = "SINGLE_FRUIT",
  captureInProgress,
  sessionState = {},
  readySince = null,
  evaluatedAt,
  lockDurationMs = SCAN_LOCK_DURATION_MS,
}) => {
  const now = Number(evaluatedAt);
  const frameAvailable = Boolean(frameQuality.analysisAvailable);
  const subjectAvailable = Boolean(subjectPlacement.analysisAvailable);
  const sessionValid = !(
    sessionState.expired ||
    sessionState.cancelled ||
    sessionState.stopped ||
    sessionState.completed
  );
  const subjectPresent = subjectPlacement.presenceState === "SUBJECT_PRESENT";
  const subjectCropped =
    subjectPlacement.presenceState === "OVERFILLED_OR_CROPPED" ||
    subjectPlacement.sizeState === "TOO_LARGE_OR_CROPPED";
  const subjectSized = subjectPlacement.sizeState === "ACCEPTABLE";
  const aligned =
    subjectPlacement.sampleCount >= 3 &&
    subjectPlacement.alignmentState === "ALIGNMENT_ACCEPTABLE";
  const lightingAcceptable = frameQuality.brightnessState === "GOOD";
  const sharpnessAcceptable = frameQuality.sharpnessState === "ACCEPTABLE";
  const stabilityAcceptable = frameQuality.motionState === "STABLE";
  const contrastAcceptable = frameQuality.contrastState === "GOOD";
  const frameQualityReady = frameQuality.readiness === "READY";
  const boundaryUnavailable =
    !boundaryCandidates.status || boundaryCandidates.status === "UNAVAILABLE";
  const boundaryCandidateAvailable = boundaryCandidates.candidateCount > 0;
  const boundaryHasPartial = boundaryCandidates.partialCandidateCount > 0;
  const boundaryReady =
    scanMode === "PACKAGE_VIEW" ||
    boundaryUnavailable ||
    (scanMode === "SINGLE_FRUIT"
      ? Boolean(
          boundaryCandidates.dominantCandidate &&
            boundaryCandidates.dominantCandidate.confidence >= 0.5 &&
            !boundaryCandidates.dominantCandidate.partialCandidate
        )
      : boundaryCandidateAvailable && boundaryCandidates.confidenceLevel !== "LOW");
  const countIntegrationAvailable = Boolean(fruitCountEstimate.status);
  const countReady =
    !countIntegrationAvailable ||
    scanMode === "PACKAGE_VIEW" ||
    (scanMode === "SINGLE_FRUIT"
      ? fruitCountEstimate.status === "READY" &&
        fruitCountEstimate.estimatedCount === 1 &&
        fruitCountEstimate.confidenceLevel !== "LOW"
      : fruitCountEstimate.status === "READY" &&
        fruitCountEstimate.clearCandidateCount > 0 &&
        fruitCountEstimate.confidenceLevel !== "LOW");
  const signalSummary = {
    scannerActive: Boolean(scannerActive),
    cameraReady: Boolean(cameraReady),
    roiReady: Boolean(roiReady),
    sessionValid,
    captureIdle: !captureInProgress,
    frameAvailable,
    lightingAcceptable,
    sharpnessAcceptable,
    stabilityAcceptable,
    contrastAcceptable,
    frameQualityReady,
    subjectAvailable,
    subjectPresent,
    subjectNotCropped: !subjectCropped,
    subjectSized,
    alignmentAcceptable: aligned,
    boundaryAvailable: !boundaryUnavailable,
    boundaryCandidateAvailable,
    boundaryReady,
    provisionalCountReady: countReady,
  };

  const blocked = (state, blockingCode, blockingReason) =>
    makeResult({ state, blockingCode, blockingReason, signalSummary });

  if (!scannerActive) return blocked("NOT_READY", "SCANNER_INACTIVE", "Start the scanner");
  if (!cameraReady) return blocked("NOT_READY", "CAMERA_UNAVAILABLE", "Camera is unavailable");
  if (!roiReady) {
    return roiStatus === "UNAVAILABLE"
      ? blocked("NOT_READY", "GUIDE_UNAVAILABLE", "Automatic guide lock is unavailable. You can still capture manually.")
      : blocked("CHECKING", "GUIDE_WAITING", "Checking guide area");
  }
  if (!sessionValid) return blocked("NOT_READY", "SESSION_UNAVAILABLE", "Scanning session is no longer active");
  if (captureInProgress) return blocked("NOT_READY", "CAPTURE_IN_PROGRESS", "Capture in progress");
  if (!frameAvailable) {
    return frameQuality.evaluatedAt
      ? blocked("NOT_READY", "FRAME_UNAVAILABLE", "Automatic guide lock is unavailable. You can still capture manually.")
      : blocked("CHECKING", "FRAME_CHECKING", "Checking frame");
  }
  if (!lightingAcceptable) {
    return frameQuality.brightnessState === "TOO_DARK"
      ? blocked("NOT_READY", "TOO_DARK", "Add more light")
      : blocked("NOT_READY", "TOO_BRIGHT", "Reduce direct glare");
  }
  if (!subjectAvailable) {
    return subjectPlacement.evaluatedAt
      ? blocked("NOT_READY", "SUBJECT_GUIDANCE_UNAVAILABLE", "Automatic guide lock is unavailable. You can still capture manually.")
      : blocked("CHECKING", "SUBJECT_CHECKING", "Checking subject position");
  }
  if (!subjectPresent && !subjectCropped) {
    return blocked("CHECKING", "SUBJECT_UNCERTAIN", "Position the fruit or package clearly inside the guide.");
  }
  if (subjectCropped) {
    return blocked("NOT_READY", "SUBJECT_CROPPED", "Move slightly farther away and keep the full subject inside the guide.");
  }
  if (!subjectSized) {
    return subjectPlacement.sizeState === "TOO_SMALL"
      ? blocked("NOT_READY", "SUBJECT_TOO_SMALL", "Move slightly closer.")
      : blocked("CHECKING", "SUBJECT_SIZE_CHECKING", "Checking subject size");
  }
  if (!aligned) {
    return blocked("NOT_READY", "SUBJECT_MISALIGNED", subjectPlacement.guidance || "Reposition subject");
  }
  if (!boundaryReady) {
    if (boundaryHasPartial) {
      return blocked("NOT_READY", "BOUNDARY_PARTIAL", "Keep the full subject inside the guide.");
    }
    return ["WAITING", "EVALUATING"].includes(boundaryCandidates.status)
      ? blocked("CHECKING", "BOUNDARY_EVALUATING", "Estimating possible subject boundaries")
      : blocked("NOT_READY", "BOUNDARY_UNCLEAR", "No clear boundary candidate. You can still capture manually.");
  }
  if (!countReady) {
    if (fruitCountEstimate.status === "MULTIPLE_SUBJECTS") {
      return blocked("NOT_READY", "COUNT_MULTIPLE_SUBJECTS", "Multiple subjects appear inside the guide.");
    }
    if (fruitCountEstimate.partialCandidateCount > 0) {
      return blocked("NOT_READY", "COUNT_PARTIAL", "Keep all fruits fully inside the guide for a better count.");
    }
    if (fruitCountEstimate.status === "WAITING") {
      return blocked("CHECKING", "COUNT_WAITING", "Stabilizing provisional count estimate");
    }
    if (fruitCountEstimate.status === "UNAVAILABLE") {
      return blocked("NOT_READY", "COUNT_UNAVAILABLE", "Count estimation is unavailable. You can continue scanning manually.");
    }
    return blocked("NOT_READY", "COUNT_LOW_CONFIDENCE", "Provisional count confidence is low. You can still capture manually.");
  }
  if (!stabilityAcceptable) {
    return frameQuality.motionState === "CHECKING"
      ? blocked("CHECKING", "STABILITY_CHECKING", "Checking stability")
      : blocked("NOT_READY", "CAMERA_MOVING", "Hold the camera steady");
  }
  if (!sharpnessAcceptable) return blocked("NOT_READY", "FRAME_BLURRY", "Improve focus");
  if (!contrastAcceptable) return blocked("NOT_READY", "LOW_CONTRAST", "Improve lighting or background contrast");
  if (!frameQualityReady) return blocked("CHECKING", "QUALITY_HOLD", "Checking frame consistency");

  const holdStarted = Number.isFinite(Number(readySince)) && Number(readySince) > 0;
  const elapsed = holdStarted && Number.isFinite(now) ? Math.max(0, now - Number(readySince)) : 0;
  const duration = Math.max(1, Number(lockDurationMs) || SCAN_LOCK_DURATION_MS);
  const lockProgress = Math.min(1, elapsed / duration);
  if (holdStarted && elapsed >= duration) {
    return makeResult({
      state: "LOCKED",
      readyForLock: true,
      advisoryReason: "Guide lock confirms frame quality and positioning only.",
      signalSummary,
      lockProgress: 1,
    });
  }

  return makeResult({
    state: "READY",
    readyForLock: true,
    advisoryReason: "Ready — keep still",
    signalSummary,
    lockProgress,
  });
};
