const SEGMENTATION_VERSION = "fruit-segmentation-contract-v1";

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const segmentFruit = async (context) => {
  if (!isPlainObject(context)) {
    throw createValidationError("Segmentation context must be an object");
  }

  if (!isPlainObject(context.capture)) {
    throw createValidationError("Segmentation context requires capture metadata");
  }

  if (!context.capture.scanId && !context.capture.captureSessionId) {
    throw createValidationError(
      "Segmentation context requires a scanId or captureSessionId"
    );
  }

  return {
    status: "NOT_RUN",
    engine: "UNCONFIGURED",
    version: SEGMENTATION_VERSION,
    fruitMask: {
      available: false,
      encoding: "",
      width: 0,
      height: 0,
      data: [],
    },
    regions: [],
    boundingBoxes: [],
    fruitCount: 0,
    confidence: {
      overall: 0,
      level: "NONE",
    },
    warnings: [],
    diagnostics: {
      messages: ["No segmentation engine is configured"],
      metrics: {},
      errors: [],
    },
    execution: {
      invoked: true,
      performed: false,
      startedAt: "",
      completedAt: "",
      durationMs: 0,
    },
  };
};
