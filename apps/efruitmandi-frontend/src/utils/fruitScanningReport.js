const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getNormalizedDetectionBoxStyle = (box = {}) => {
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (x < 0 || y < 0 || x >= 1 || y >= 1 || width <= 0 || height <= 0) return null;

  return {
    left: `${clamp(x, 0, 1) * 100}%`,
    top: `${clamp(y, 0, 1) * 100}%`,
    width: `${clamp(width, 0, 1 - x) * 100}%`,
    height: `${clamp(height, 0, 1 - y) * 100}%`,
  };
};

export const getFruitScanStatusCopy = (status = "") => ({
  CAPTURED: "Captured",
  UPLOADING: "Uploading",
  UPLOADED: "Uploaded",
  ATTACHED: "Uploaded",
  PENDING: "Pending analysis",
  PROCESSING: "Analyzing",
  COMPLETED: "Completed",
  REVIEW_REQUIRED: "Review required",
  FAILED: "Failed",
}[String(status || "").trim().toUpperCase()] || "Pending");

export const canDownloadCompletedFruitScanningReport = (report = {}) =>
  Boolean(report?.available && report?.status === "COMPLETED");
