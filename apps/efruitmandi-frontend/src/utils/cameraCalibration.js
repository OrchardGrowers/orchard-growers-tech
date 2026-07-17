export const CALIBRATION_STATUS = Object.freeze({
  UNINITIALIZED: "UNINITIALIZED",
  WAITING: "WAITING",
  ESTIMATING: "ESTIMATING",
  READY: "READY",
  INVALID: "INVALID",
});

export const CALIBRATION_STATUS_VALUES = Object.freeze(
  Object.values(CALIBRATION_STATUS)
);

const VALID_TRANSITIONS = Object.freeze({
  UNINITIALIZED: Object.freeze(["WAITING", "ESTIMATING", "INVALID"]),
  WAITING: Object.freeze(["UNINITIALIZED", "ESTIMATING", "INVALID"]),
  ESTIMATING: Object.freeze(["UNINITIALIZED", "WAITING", "READY", "INVALID"]),
  READY: Object.freeze(["UNINITIALIZED", "WAITING", "ESTIMATING", "INVALID"]),
  INVALID: Object.freeze(["UNINITIALIZED", "WAITING", "ESTIMATING"]),
});

const optionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const optionalText = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
};

const optionalTimestamp = (value) => {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
};

export const createCalibrationState = (values = {}) => ({
  version: optionalText(values.version),
  status: CALIBRATION_STATUS_VALUES.includes(values.status)
    ? values.status
    : CALIBRATION_STATUS.UNINITIALIZED,
  lensProfile: optionalText(values.lensProfile),
  previewAspectRatio: optionalNumber(values.previewAspectRatio),
  videoAspectRatio: optionalNumber(values.videoAspectRatio),
  displayScale: optionalNumber(values.displayScale),
  pixelRatio: optionalNumber(values.pixelRatio),
  orientation: optionalText(values.orientation),
  timestamp: optionalTimestamp(values.timestamp),
  perspective: {
    rotation: optionalNumber(values.perspective?.rotation),
    tilt: optionalNumber(values.perspective?.tilt),
    estimatedScale: optionalNumber(values.perspective?.estimatedScale),
    estimatedDistance: optionalNumber(values.perspective?.estimatedDistance),
  },
});

export const updateCalibrationState = (currentState, nextStatus, updates = {}) => {
  const current = createCalibrationState(currentState);
  if (!CALIBRATION_STATUS_VALUES.includes(nextStatus)) {
    throw new Error("Invalid calibration status");
  }

  const validTransition =
    current.status === nextStatus || VALID_TRANSITIONS[current.status].includes(nextStatus);
  if (!validTransition) {
    throw new Error(`Invalid calibration transition: ${current.status} -> ${nextStatus}`);
  }

  return createCalibrationState({
    ...current,
    ...updates,
    status: nextStatus,
    perspective: {
      ...current.perspective,
      ...(updates.perspective || {}),
    },
  });
};
