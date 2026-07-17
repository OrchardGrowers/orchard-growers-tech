export const INSPECTION_STATUS = Object.freeze({
  WAITING: "WAITING",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
});

export const INSPECTION_STATUS_VALUES = Object.freeze(
  Object.values(INSPECTION_STATUS)
);

export const INSPECTION_TRANSITIONS = Object.freeze({
  [INSPECTION_STATUS.WAITING]: Object.freeze([
    INSPECTION_STATUS.QUEUED,
    INSPECTION_STATUS.REJECTED,
    INSPECTION_STATUS.CANCELLED,
  ]),
  [INSPECTION_STATUS.QUEUED]: Object.freeze([
    INSPECTION_STATUS.PROCESSING,
    INSPECTION_STATUS.FAILED,
    INSPECTION_STATUS.REJECTED,
    INSPECTION_STATUS.CANCELLED,
  ]),
  [INSPECTION_STATUS.PROCESSING]: Object.freeze([
    INSPECTION_STATUS.COMPLETED,
    INSPECTION_STATUS.FAILED,
    INSPECTION_STATUS.REJECTED,
    INSPECTION_STATUS.CANCELLED,
  ]),
  [INSPECTION_STATUS.FAILED]: Object.freeze([
    INSPECTION_STATUS.QUEUED,
    INSPECTION_STATUS.REJECTED,
    INSPECTION_STATUS.CANCELLED,
  ]),
  [INSPECTION_STATUS.COMPLETED]: Object.freeze([]),
  [INSPECTION_STATUS.REJECTED]: Object.freeze([]),
  [INSPECTION_STATUS.CANCELLED]: Object.freeze([]),
});

export const createInspectionState = (overrides = {}) => {
  const requestedStatus = String(overrides.inspectionStatus || "").trim().toUpperCase();
  const inspectionStatus = INSPECTION_STATUS_VALUES.includes(requestedStatus)
    ? requestedStatus
    : INSPECTION_STATUS.WAITING;
  const retryCount = Number(overrides.retryCount);

  return {
    inspectionStatus,
    inspectionStartedAt: overrides.inspectionStartedAt || null,
    inspectionCompletedAt: overrides.inspectionCompletedAt || null,
    inspectionVersion: overrides.inspectionVersion || null,
    retryCount: Number.isInteger(retryCount) && retryCount >= 0 ? retryCount : 0,
    failureReason: overrides.failureReason || null,
  };
};

export const createInspectionLifecycle = () => {
  const state = createInspectionState();
  return {
    status: state.inspectionStatus,
    version: state.inspectionVersion,
    queuedAt: null,
    startedAt: state.inspectionStartedAt,
    completedAt: state.inspectionCompletedAt,
    retryCount: state.retryCount,
    failureReason: state.failureReason,
  };
};

export const canTransitionInspectionStatus = (currentStatus, nextStatus) =>
  Boolean(
    INSPECTION_TRANSITIONS[String(currentStatus || "").toUpperCase()]?.includes(
      String(nextStatus || "").toUpperCase()
    )
  );

export const transitionInspectionState = (currentState, nextStatus, options = {}) => {
  const suppliedCurrentStatus = String(
    currentState?.inspectionStatus || INSPECTION_STATUS.WAITING
  ).trim().toUpperCase();
  if (!INSPECTION_STATUS_VALUES.includes(suppliedCurrentStatus)) {
    throw new Error(`Unknown inspection status: ${suppliedCurrentStatus}`);
  }
  const current = createInspectionState(currentState);
  const next = String(nextStatus || "").trim().toUpperCase();
  if (!canTransitionInspectionStatus(current.inspectionStatus, next)) {
    throw new Error(
      `Invalid inspection transition: ${current.inspectionStatus} -> ${next || "UNKNOWN"}`
    );
  }

  const transitionAt = options.transitionAt || null;
  const terminal = [
    INSPECTION_STATUS.COMPLETED,
    INSPECTION_STATUS.FAILED,
    INSPECTION_STATUS.REJECTED,
    INSPECTION_STATUS.CANCELLED,
  ].includes(next);

  return {
    ...current,
    inspectionStatus: next,
    inspectionStartedAt:
      next === INSPECTION_STATUS.PROCESSING
        ? current.inspectionStartedAt || transitionAt
        : current.inspectionStartedAt,
    inspectionCompletedAt: terminal ? transitionAt : null,
    inspectionVersion: options.inspectionVersion ?? current.inspectionVersion,
    retryCount:
      current.inspectionStatus === INSPECTION_STATUS.FAILED &&
      next === INSPECTION_STATUS.QUEUED
        ? current.retryCount + 1
        : current.retryCount,
    failureReason:
      next === INSPECTION_STATUS.FAILED
        ? options.failureReason || null
        : next === INSPECTION_STATUS.QUEUED
          ? null
          : current.failureReason,
  };
};
