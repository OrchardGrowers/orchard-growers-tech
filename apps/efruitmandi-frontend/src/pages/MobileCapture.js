import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FaCamera, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaVideo } from "react-icons/fa";
import API, { getApiErrorMessage } from "../services/api";
import {
  BOUNDARY_DETECTOR_VERSION,
  detectBoundaryCandidates,
  stabilizeBoundaryCandidates,
} from "../utils/boundaryCandidates";
import {
  MEASUREMENT_ESTIMATOR_VERSION,
  estimateCandidateMeasurements,
  stabilizeCandidateMeasurements,
} from "../utils/candidateMeasurements";
import {
  CALIBRATION_STATUS,
  createCalibrationState,
  updateCalibrationState,
} from "../utils/cameraCalibration";
import { isMobileDevice } from "../utils/mobileMedia";
import { analyzeFrameQuality } from "../utils/frameQuality";
import {
  COUNT_ESTIMATOR_VERSION,
  estimateFruitCount,
  stabilizeFruitCountEstimates,
} from "../utils/fruitCountEstimator";
import { createScanMetadata } from "../utils/scanMetadata";
import { getGuideRoi, SCAN_MODE_GUIDES } from "../utils/scanModeGuides";
import {
  SCALE_CALIBRATION_METHODS,
  SCALE_CALIBRATION_STATUS,
  calculateScaleCalibration,
  createScaleCalibrationState,
  evaluateReferenceConfidence,
} from "../utils/scaleCalibration";
import { analyzeSubjectPlacement, smoothSubjectPlacement } from "../utils/subjectPlacement";
import { evaluateScanReadiness, SCAN_LOCK_DURATION_MS } from "../utils/scanReadiness";
import {
  getFruitScanStatusCopy,
  getNormalizedDetectionBoxStyle,
} from "../utils/fruitScanningReport";

let fruitRecognitionModulePromise;

const loadFruitRecognition = () => {
  if (!fruitRecognitionModulePromise) {
    fruitRecognitionModulePromise = import("../utils/fruitRecognition");
  }

  return fruitRecognitionModulePromise;
};

const withTimeout = (promise, ms = 15000) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("recognition-timeout")), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const isLowMemoryRecognitionError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("memory") ||
    message.includes("not enough") ||
    message.includes("allocation") ||
    message.includes("canvas") ||
    message.includes("timeout") ||
    message.includes("recognition-timeout") ||
    message.includes("webgl") ||
    message.includes("context lost")
  );
};

const SCAN_MODES = Object.entries(SCAN_MODE_GUIDES).map(([value, guide]) => ({
  value,
  label: guide.label,
}));

const CAPTURE_STATUS_LABELS = {
  IDLE: "Waiting",
  READY: "Ready to capture",
  CAPTURING: "Capturing",
  CHECKING: "Checking Image",
  UPLOADING: "Uploading",
  UPLOADED: "Uploaded",
  RETRY: "Ready to retry",
  FAILED: "Upload failed",
};

const ANALYSIS_MAX_WIDTH = 192;
const ANALYSIS_MAX_HEIGHT = 144;
const ANALYSIS_INTERVAL_MS = 350;
const MAX_CONSECUTIVE_ANALYSIS_ERRORS = 3;
const AUTO_CAPTURE_READY_HOLD_MS = 700;
const AUTO_CAPTURE_COOLDOWN_MS = 3000;
const AUTO_CAPTURE_RETRY_MS = 3000;
const AUTO_CAPTURE_MAX_FAILURES = 3;
const AUTO_CAPTURE_DUPLICATE_THRESHOLD = 4.5;
const AUTO_CAPTURE_AVAILABLE = true;

const INITIAL_FRAME_QUALITY = {
  brightnessScore: 0,
  contrastScore: 0,
  sharpnessScore: 0,
  motionScore: null,
  stabilityScore: 0,
  overallScore: 0,
  readiness: "CHECKING",
  evaluatedAt: null,
  brightnessState: "CHECKING",
  contrastState: "CHECKING",
  sharpnessState: "CHECKING",
  motionState: "CHECKING",
  instruction: "Keep the fruit inside the guide",
  analysisAvailable: false,
};

const INITIAL_SUBJECT_PLACEMENT = {
  presenceState: "EMPTY_OR_UNCERTAIN",
  presenceScore: 0,
  edgeDensity: 0,
  foregroundCoverage: 0,
  centroidXRatio: null,
  centroidYRatio: null,
  borderContact: 0,
  sizeState: "UNKNOWN",
  horizontalGuidance: null,
  verticalGuidance: null,
  distanceGuidance: null,
  alignmentState: "WAITING",
  confidenceLevel: "UNCERTAIN",
  guidance: "Position the fruit or package clearly inside the guide.",
  sampleCount: 0,
  evaluatedAt: null,
  analysisAvailable: false,
};

const INITIAL_SCAN_READINESS = {
  state: "NOT_READY",
  lockedAt: null,
  readySince: null,
  blockingReason: "Start the scanner",
  advisoryReason: null,
  signalSummary: {},
  lockProgress: 0,
  evaluatedAt: null,
};

const INITIAL_BOUNDARY_CANDIDATES = {
  status: "WAITING",
  candidateCount: 0,
  dominantCandidate: null,
  candidates: [],
  confidenceLevel: "NONE",
  possibleMergedRegions: 0,
  partialCandidateCount: 0,
  coordinateSpace: "PIXEL_RATIO",
  orientation: null,
  evaluatedAt: null,
  detectorVersion: BOUNDARY_DETECTOR_VERSION,
};

const INITIAL_FRUIT_COUNT_ESTIMATE = {
  clearCandidateCount: 0,
  partialCandidateCount: 0,
  mergedRegionCount: 0,
  estimatedMinimumCount: null,
  estimatedMaximumCount: null,
  estimatedCount: null,
  confidence: 0,
  confidenceLevel: "LOW",
  status: "WAITING",
  evaluatedAt: null,
  estimatorVersion: COUNT_ESTIMATOR_VERSION,
};

const INITIAL_CANDIDATE_MEASUREMENTS = {
  status: "WAITING_FOR_CALIBRATION",
  measurements: [],
  measuredCandidateCount: 0,
  skippedCandidateCount: 0,
  averageDiameterMm: null,
  minimumDiameterMm: null,
  maximumDiameterMm: null,
  confidence: 0,
  confidenceLevel: "LOW",
  advisories: [],
  multipleCandidatesAdvisory: false,
  evaluatedAt: null,
  estimatorVersion: MEASUREMENT_ESTIMATOR_VERSION,
};

const createFrameSignature = (frameData, columns = 4, rows = 4) => {
  const { width = 0, height = 0, luminance } = frameData || {};
  if (!luminance || width < columns || height < rows) return null;

  const signature = [];
  for (let row = 0; row < rows; row += 1) {
    const startY = Math.floor((row * height) / rows);
    const endY = Math.max(startY + 1, Math.floor(((row + 1) * height) / rows));
    for (let column = 0; column < columns; column += 1) {
      const startX = Math.floor((column * width) / columns);
      const endX = Math.max(startX + 1, Math.floor(((column + 1) * width) / columns));
      let total = 0;
      let samples = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          total += luminance[y * width + x];
          samples += 1;
        }
      }
      signature.push(samples ? total / samples : 0);
    }
  }
  return signature;
};

const getSignatureDifference = (current, previous) => {
  if (!current || !previous || current.length !== previous.length) return null;
  const totalDifference = current.reduce(
    (total, value, index) => total + Math.abs(value - previous[index]),
    0
  );
  return (totalDifference / current.length / 255) * 100;
};

const getDeviceMetadata = (video) => {
  const userAgentData = navigator.userAgentData;
  const browser = Array.isArray(userAgentData?.brands)
    ? userAgentData.brands.map((item) => `${item.brand} ${item.version}`).join(", ")
    : navigator.userAgent || "";
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timezone = "";
  }

  return {
    deviceModel: userAgentData?.model || "",
    browser,
    platform: userAgentData?.platform || navigator.platform || "",
    cameraFacing: "environment",
    cameraResolution: {
      width: video?.videoWidth || null,
      height: video?.videoHeight || null,
    },
    orientation:
      window.screen?.orientation?.type ||
      (window.innerWidth > window.innerHeight ? "landscape" : "portrait"),
    networkType: navigator.connection?.effectiveType || "",
    gpsAccuracy: null,
    timezone,
  };
};

export default function MobileCapture() {
  const { sessionId } = useParams();
  const isMobile = useMemo(() => isMobileDevice(), []);
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const streamRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const guideRoiRef = useRef(null);
  const previousFrameDataRef = useRef(null);
  const subjectHistoryRef = useRef([]);
  const boundaryHistoryRef = useRef([]);
  const countHistoryRef = useRef([]);
  const measurementHistoryRef = useRef([]);
  const referenceMethodRef = useRef("NONE");
  const customReferenceWidthRef = useRef("");
  const selectedReferenceCandidateRef = useRef(null);
  const stableSinceRef = useRef(null);
  const readinessReadySinceRef = useRef(null);
  const readinessLockedAtRef = useRef(null);
  const readinessAcceptableSamplesRef = useRef(0);
  const autoReadyTimerRef = useRef(null);
  const autoCooldownTimerRef = useRef(null);
  const captureFlashTimerRef = useRef(null);
  const captureInFlightRef = useRef(false);
  const lastAutoSignatureRef = useRef(null);
  const autoFailureCountRef = useRef(0);
  const captureCurrentFrameRef = useRef(null);
  const captureGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [retakeActive, setRetakeActive] = useState(false);
  const [message, setMessage] = useState("");
  const [scanAccepted, setScanAccepted] = useState(false);
  const [frameQuality, setFrameQuality] = useState(INITIAL_FRAME_QUALITY);
  const [subjectPlacement, setSubjectPlacement] = useState(INITIAL_SUBJECT_PLACEMENT);
  const [boundaryCandidates, setBoundaryCandidates] = useState(
    INITIAL_BOUNDARY_CANDIDATES
  );
  const [fruitCountEstimate, setFruitCountEstimate] = useState(
    INITIAL_FRUIT_COUNT_ESTIMATE
  );
  const [candidateMeasurements, setCandidateMeasurements] = useState(
    INITIAL_CANDIDATE_MEASUREMENTS
  );
  const [scanReadiness, setScanReadiness] = useState(INITIAL_SCAN_READINESS);
  const [guideAreaStatus, setGuideAreaStatus] = useState("WAITING");
  const [cameraCalibration, setCameraCalibration] = useState(
    createCalibrationState()
  );
  const [customReferenceWidth, setCustomReferenceWidth] = useState("");
  const [scaleCalibration, setScaleCalibration] = useState(
    createScaleCalibrationState()
  );
  const [captureFlash, setCaptureFlash] = useState(false);
  const [captureHistory, setCaptureHistory] = useState([]);
  const [scannerUi, setScannerUi] = useState({
    scanMode: "SINGLE_FRUIT",
    scannerStatus: "IDLE",
    cameraReady: false,
    captureStatus: "IDLE",
    capturedCount: 0,
    stopped: false,
    cancelled: false,
    autoCaptureEnabled: false,
    autoCapturePaused: false,
    autoCaptureStatus: "OFF",
  });

  const updateScannerUi = (updates) => {
    setScannerUi((current) => ({ ...current, ...updates }));
  };

  const resetScanLock = () => {
    readinessReadySinceRef.current = null;
    readinessLockedAtRef.current = null;
    readinessAcceptableSamplesRef.current = 0;
    setScanReadiness(INITIAL_SCAN_READINESS);
  };

  const resetCandidateMeasurements = () => {
    measurementHistoryRef.current = [];
    setCandidateMeasurements(INITIAL_CANDIDATE_MEASUREMENTS);
  };

  const resetScaleCalibration = () => {
    resetCandidateMeasurements();
    selectedReferenceCandidateRef.current = null;
    const method = referenceMethodRef.current;
    const configuredWidth = SCALE_CALIBRATION_METHODS[method]?.defaultWidthMm;
    const customWidth = Number(customReferenceWidthRef.current);
    setScaleCalibration(
      createScaleCalibrationState({
        method,
        referenceWidthMm:
          configuredWidth ||
          (method === "CUSTOM_REFERENCE" && Number.isFinite(customWidth) && customWidth > 0
            ? customWidth
            : null),
      })
    );
  };

  const resetFrameAnalysis = () => {
    previousFrameDataRef.current = null;
    stableSinceRef.current = null;
    subjectHistoryRef.current = [];
    boundaryHistoryRef.current = [];
    countHistoryRef.current = [];
    setFrameQuality(INITIAL_FRAME_QUALITY);
    setSubjectPlacement(INITIAL_SUBJECT_PLACEMENT);
    setBoundaryCandidates(INITIAL_BOUNDARY_CANDIDATES);
    setFruitCountEstimate(INITIAL_FRUIT_COUNT_ESTIMATE);
    resetScaleCalibration();
    resetScanLock();
  };

  const changeReferenceMethod = (method) => {
    resetCandidateMeasurements();
    const nextMethod = SCALE_CALIBRATION_METHODS[method] ? method : "NONE";
    referenceMethodRef.current = nextMethod;
    customReferenceWidthRef.current = "";
    selectedReferenceCandidateRef.current = null;
    setCustomReferenceWidth("");
    setScaleCalibration(
      createScaleCalibrationState({
        method: nextMethod,
        referenceWidthMm: SCALE_CALIBRATION_METHODS[nextMethod].defaultWidthMm,
      })
    );
  };

  const changeCustomReferenceWidth = (value) => {
    resetCandidateMeasurements();
    customReferenceWidthRef.current = value;
    setCustomReferenceWidth(value);
    selectedReferenceCandidateRef.current = null;
    const width = Number(value);
    setScaleCalibration(
      createScaleCalibrationState({
        method: "CUSTOM_REFERENCE",
        referenceWidthMm: Number.isFinite(width) && width > 0 ? width : null,
      })
    );
  };

  const selectReferenceCandidate = (candidate) => {
    resetCandidateMeasurements();
    const method = referenceMethodRef.current;
    const configuredWidth = SCALE_CALIBRATION_METHODS[method]?.defaultWidthMm;
    const customWidth = Number(customReferenceWidthRef.current);
    const referenceWidthMm =
      configuredWidth ||
      (Number.isFinite(customWidth) && customWidth > 0 ? customWidth : null);
    if (method === "NONE" || !referenceWidthMm) {
      setScaleCalibration(
        createScaleCalibrationState({
          method,
          status: SCALE_CALIBRATION_STATUS.INVALID,
          failureReason: "Enter a valid reference width before selecting a region.",
        })
      );
      return;
    }

    selectedReferenceCandidateRef.current = { ...candidate };
    setScaleCalibration(
      createScaleCalibrationState({
        method,
        status: SCALE_CALIBRATION_STATUS.REFERENCE_CANDIDATE,
        referenceWidthMm,
        referenceWidthPixels: candidate.widthPixels,
        referenceBoundingBox: candidate.boundingBox,
      })
    );
  };

  const confirmReferenceCandidate = () => {
    resetCandidateMeasurements();
    const candidate = selectedReferenceCandidateRef.current;
    if (!candidate || guideAreaStatus !== "READY" || !videoRef.current?.videoWidth) {
      setScaleCalibration((current) =>
        createScaleCalibrationState({
          ...current,
          status: SCALE_CALIBRATION_STATUS.UNAVAILABLE,
          pixelsPerMm: null,
          failureReason: "Scale calibration is unavailable for the current camera geometry.",
        })
      );
      return;
    }

    setScaleCalibration((current) =>
      createScaleCalibrationState({
        ...current,
        status: SCALE_CALIBRATION_STATUS.CALIBRATING,
      })
    );
    const confidence = evaluateReferenceConfidence({
      candidate,
      frameQuality,
      userConfirmed: true,
    });
    try {
      const result = calculateScaleCalibration({
        referenceWidthMm: scaleCalibration.referenceWidthMm,
        referenceWidthPixels: candidate.widthPixels,
        confidence,
        options: {
          method: referenceMethodRef.current,
          referenceBoundingBox: candidate.boundingBox,
          evaluatedAt: Date.now(),
        },
      });
      setScaleCalibration(result);
    } catch {
      setScaleCalibration((current) =>
        createScaleCalibrationState({
          ...current,
          status: SCALE_CALIBRATION_STATUS.UNAVAILABLE,
          pixelsPerMm: null,
          failureReason: "Scale calibration is unavailable. Scanning and manual capture can continue.",
        })
      );
    }
  };

  const clearAutoCaptureTimers = () => {
    if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
    if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
    if (captureFlashTimerRef.current) window.clearTimeout(captureFlashTimerRef.current);
    autoReadyTimerRef.current = null;
    autoCooldownTimerRef.current = null;
    captureFlashTimerRef.current = null;
  };

  const resetAutoCaptureRuntime = ({ clearSignature = true } = {}) => {
    clearAutoCaptureTimers();
    captureInFlightRef.current = false;
    autoFailureCountRef.current = 0;
    if (clearSignature) lastAutoSignatureRef.current = null;
    setCaptureFlash(false);
  };

  const updateCaptureMetadata = (captureId, updates) => {
    setCaptureHistory((current) =>
      current.map((item) =>
        item.id === captureId
          ? {
              ...item,
              ...updates,
              ...(updates.captureStatus || !updates.uploadStatus
                ? {}
                : { captureStatus: updates.uploadStatus }),
            }
          : item
      )
    );
  };

  const scheduleAutoCaptureDelay = (delayMs, status) => {
    if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
    if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
    autoReadyTimerRef.current = null;
    updateScannerUi({ autoCaptureStatus: status });
    autoCooldownTimerRef.current = window.setTimeout(() => {
      autoCooldownTimerRef.current = null;
      if (!mountedRef.current) return;
      updateScannerUi({ autoCaptureStatus: "WAITING", captureStatus: "READY" });
    }, delayMs);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStream(null);
    setCameraActive(false);
    setCameraCalibration(createCalibrationState());
    guideRoiRef.current = null;
    subjectHistoryRef.current = [];
    setSubjectPlacement(INITIAL_SUBJECT_PLACEMENT);
    setGuideAreaStatus("WAITING");
    resetScanLock();
  };

  useEffect(() => {
    let active = true;
    referenceMethodRef.current = "NONE";
    customReferenceWidthRef.current = "";
    selectedReferenceCandidateRef.current = null;
    setCustomReferenceWidth("");
    setScaleCalibration(createScaleCalibrationState());
    resetCandidateMeasurements();
    captureGenerationRef.current += 1;
    resetAutoCaptureRuntime();
    resetScanLock();
    setCaptureHistory([]);
    setRetakeActive(false);
    setScannerUi((current) => ({
      ...current,
      autoCaptureEnabled: false,
      autoCapturePaused: false,
      autoCaptureStatus: "OFF",
    }));

    API.get(`/capture-sessions/${sessionId}`)
      .then((res) => {
        if (active) {
          setSession(res.data);
          if (["uploaded", "attached"].includes(String(res.data?.status || "").toLowerCase())) {
            setUploaded(true);
            updateScannerUi({
              captureStatus: "UPLOADED",
              capturedCount: 1,
              autoCaptureEnabled: false,
              autoCapturePaused: false,
              autoCaptureStatus: "STOPPED",
            });
          }
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error.response?.status === 410
              ? "This scanning session has expired. Return to the Fruit Lot form and start a new session."
              : getApiErrorMessage(error, "Capture session is unavailable or expired.")
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const analysisStatus = String(session?.scanRecord?.analysis?.status || "").toUpperCase();
    if (!uploaded || ["COMPLETED", "REVIEW_REQUIRED", "FAILED"].includes(analysisStatus)) {
      return undefined;
    }

    let active = true;
    const refreshAnalysis = async () => {
      try {
        const response = await API.get(`/capture-sessions/${sessionId}`);
        if (active) setSession(response.data);
      } catch {
        // Preserve the last upload state when a low-bandwidth poll fails.
      }
    };
    const intervalId = window.setInterval(refreshAnalysis, 4000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [session?.scanRecord?.analysis?.status, sessionId, uploaded]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) resetScanLock();
      if (
        document.hidden &&
        scannerUi.autoCaptureEnabled &&
        !scannerUi.autoCapturePaused
      ) {
        if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
        if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
        autoReadyTimerRef.current = null;
        autoCooldownTimerRef.current = null;
        updateScannerUi({ autoCapturePaused: true, autoCaptureStatus: "PAUSED" });
        setMessage("Auto capture paused while this page is hidden. Resume it when ready.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [scannerUi.autoCaptureEnabled, scannerUi.autoCapturePaused]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;

    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch(() => undefined);
  }, [cameraStream]);

  useEffect(() => {
    const video = videoRef.current;
    const preview = previewRef.current;
    if (!cameraStream || !cameraActive || !scannerUi.cameraReady || !video || !preview) {
      guideRoiRef.current = null;
      setGuideAreaStatus("WAITING");
      return undefined;
    }

    const recalculateGuideRoi = () => {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const displayedWidth = preview.clientWidth;
      const displayedHeight = preview.clientHeight;

      if (!videoWidth || !videoHeight) {
        guideRoiRef.current = null;
        setGuideAreaStatus("WAITING");
        resetScaleCalibration();
        setCameraCalibration((current) =>
          updateCalibrationState(current, CALIBRATION_STATUS.WAITING)
        );
        return;
      }

      if (!displayedWidth || !displayedHeight) {
        guideRoiRef.current = null;
        resetFrameAnalysis();
        setGuideAreaStatus("UNAVAILABLE");
        setCameraCalibration((current) =>
          updateCalibrationState(current, CALIBRATION_STATUS.INVALID, {
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      const nextRoi = getGuideRoi({
        videoWidth,
        videoHeight,
        displayedWidth,
        displayedHeight,
        guide: SCAN_MODE_GUIDES[scannerUi.scanMode],
        objectFit: "cover",
      });

      if (!nextRoi) {
        guideRoiRef.current = null;
        resetScaleCalibration();
        previousFrameDataRef.current = null;
        stableSinceRef.current = null;
        subjectHistoryRef.current = [];
        setFrameQuality({
          ...INITIAL_FRAME_QUALITY,
          evaluatedAt: Date.now(),
          instruction: "Guide analysis is unavailable. You can still capture manually.",
        });
        setSubjectPlacement({
          ...INITIAL_SUBJECT_PLACEMENT,
          alignmentState: "UNCERTAIN",
          evaluatedAt: Date.now(),
          guidance: "Automatic alignment guidance is unavailable. Position the subject manually.",
        });
        setGuideAreaStatus("UNAVAILABLE");
        setCameraCalibration((current) =>
          updateCalibrationState(current, CALIBRATION_STATUS.INVALID, {
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      const previousRoi = guideRoiRef.current;
      const roiChanged = !previousRoi || [
        "sourceX",
        "sourceY",
        "sourceWidth",
        "sourceHeight",
      ].some((key) => Math.abs(previousRoi[key] - nextRoi[key]) > 0.5);

      guideRoiRef.current = nextRoi;
      setGuideAreaStatus("READY");
      setCameraCalibration((current) =>
        updateCalibrationState(current, CALIBRATION_STATUS.ESTIMATING, {
          version: "1",
          previewAspectRatio: displayedWidth / displayedHeight,
          videoAspectRatio: videoWidth / videoHeight,
          displayScale: Math.max(
            displayedWidth / videoWidth,
            displayedHeight / videoHeight
          ),
          pixelRatio: window.devicePixelRatio || null,
          orientation:
            window.screen?.orientation?.type ||
            (window.innerWidth > window.innerHeight ? "landscape" : "portrait"),
          timestamp: new Date().toISOString(),
        })
      );
      if (roiChanged) resetFrameAnalysis();
    };

    recalculateGuideRoi();
    const handleOrientationChange = () => {
      resetScaleCalibration();
      recalculateGuideRoi();
    };
    video.addEventListener("loadedmetadata", recalculateGuideRoi);
    window.addEventListener("resize", recalculateGuideRoi);
    window.addEventListener("orientationchange", handleOrientationChange);
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(recalculateGuideRoi)
      : null;
    resizeObserver?.observe(preview);

    return () => {
      video.removeEventListener("loadedmetadata", recalculateGuideRoi);
      window.removeEventListener("resize", recalculateGuideRoi);
      window.removeEventListener("orientationchange", handleOrientationChange);
      resizeObserver?.disconnect();
      guideRoiRef.current = null;
      previousFrameDataRef.current = null;
      stableSinceRef.current = null;
      subjectHistoryRef.current = [];
      boundaryHistoryRef.current = [];
    };
  }, [cameraActive, cameraStream, scannerUi.cameraReady, scannerUi.scanMode]);

  useEffect(() => {
    previousFrameDataRef.current = null;
    stableSinceRef.current = null;
    setFrameQuality(INITIAL_FRAME_QUALITY);

    if (!cameraStream || !scannerUi.cameraReady || !cameraActive) return undefined;

    const canvas = analysisCanvasRef.current || document.createElement("canvas");
    analysisCanvasRef.current = canvas;
    let consecutiveErrors = 0;
    let consecutiveSubjectErrors = 0;
    let consecutiveBoundaryErrors = 0;
    let consecutiveCountErrors = 0;
    let consecutiveMeasurementErrors = 0;
    let subjectAnalysisDisabled = false;
    let boundaryAnalysisDisabled = false;
    let countEstimationDisabled = false;
    let measurementEstimationDisabled = false;
    let intervalId;

    const analyzeCurrentFrame = () => {
      if (document.hidden) {
        previousFrameDataRef.current = null;
        stableSinceRef.current = null;
        return;
      }

      if (!streamRef.current?.active) {
        window.clearInterval(intervalId);
        resetFrameAnalysis();
        resetAutoCaptureRuntime();
        setCameraActive(false);
        setCameraStream(null);
        setCameraCalibration((current) =>
          updateCalibrationState(current, CALIBRATION_STATUS.INVALID, {
            timestamp: new Date().toISOString(),
          })
        );
        updateScannerUi({
          scannerStatus: "STOPPED",
          cameraReady: false,
          autoCaptureEnabled: false,
          autoCapturePaused: false,
          autoCaptureStatus: "STOPPED",
        });
        setMessage("Camera stream ended. Start the scanner again to continue.");
        return;
      }

      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) return;

      const guideRoi = guideRoiRef.current;
      if (!guideRoi) return;

      try {
        const scale = Math.min(
          ANALYSIS_MAX_WIDTH / guideRoi.sourceWidth,
          ANALYSIS_MAX_HEIGHT / guideRoi.sourceHeight,
          1
        );
        const width = Math.max(2, Math.round(guideRoi.sourceWidth * scale));
        const height = Math.max(2, Math.round(guideRoi.sourceHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          resetScaleCalibration();
          previousFrameDataRef.current = null;
          stableSinceRef.current = null;
          subjectHistoryRef.current = [];
          boundaryHistoryRef.current = [];
          countHistoryRef.current = [];
          measurementHistoryRef.current = [];
          setSubjectPlacement(INITIAL_SUBJECT_PLACEMENT);
          setBoundaryCandidates(INITIAL_BOUNDARY_CANDIDATES);
          setFruitCountEstimate(INITIAL_FRUIT_COUNT_ESTIMATE);
          setCandidateMeasurements(INITIAL_CANDIDATE_MEASUREMENTS);
        }

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("analysis-context-unavailable");

        context.drawImage(
          video,
          guideRoi.sourceX,
          guideRoi.sourceY,
          guideRoi.sourceWidth,
          guideRoi.sourceHeight,
          0,
          0,
          width,
          height
        );
        const imageData = context.getImageData(0, 0, width, height);
        const now = Date.now();
        let stableBoundaryResult = null;
        if (!subjectAnalysisDisabled) {
          try {
            const subjectResult = analyzeSubjectPlacement(
              imageData,
              SCAN_MODE_GUIDES[scannerUi.scanMode]?.heuristics
            );
            subjectHistoryRef.current = [
              ...subjectHistoryRef.current.slice(-3),
              subjectResult,
            ];
            const smoothedSubject = smoothSubjectPlacement(subjectHistoryRef.current, 4);
            setSubjectPlacement({
              ...smoothedSubject,
              evaluatedAt: now,
              analysisAvailable: true,
            });
            consecutiveSubjectErrors = 0;
          } catch {
            consecutiveSubjectErrors += 1;
            subjectHistoryRef.current = [];
            if (consecutiveSubjectErrors >= MAX_CONSECUTIVE_ANALYSIS_ERRORS) {
              subjectAnalysisDisabled = true;
              setSubjectPlacement({
                ...INITIAL_SUBJECT_PLACEMENT,
                alignmentState: "UNCERTAIN",
                evaluatedAt: now,
                guidance: "Automatic alignment guidance is unavailable. Position the subject manually.",
              });
            }
          }
        }
        if (!boundaryAnalysisDisabled) {
          try {
            const boundaryResult = detectBoundaryCandidates(imageData, {
              scanMode: scannerUi.scanMode,
              evaluatedAt: now,
              calibration: cameraCalibration,
            });
            boundaryHistoryRef.current = [
              ...boundaryHistoryRef.current.slice(-2),
              boundaryResult,
            ];
            stableBoundaryResult = stabilizeBoundaryCandidates(
              boundaryHistoryRef.current,
              { scanMode: scannerUi.scanMode }
            );
            setBoundaryCandidates(
              stableBoundaryResult || INITIAL_BOUNDARY_CANDIDATES
            );
            consecutiveBoundaryErrors = 0;
          } catch {
            consecutiveBoundaryErrors += 1;
            boundaryHistoryRef.current = [];
            if (consecutiveBoundaryErrors >= MAX_CONSECUTIVE_ANALYSIS_ERRORS) {
              boundaryAnalysisDisabled = true;
              setBoundaryCandidates({
                ...INITIAL_BOUNDARY_CANDIDATES,
                status: "UNAVAILABLE",
                evaluatedAt: now,
              });
              countHistoryRef.current = [];
              setFruitCountEstimate({
                ...INITIAL_FRUIT_COUNT_ESTIMATE,
                status: "UNAVAILABLE",
                evaluatedAt: now,
              });
              measurementHistoryRef.current = [];
              setCandidateMeasurements({
                ...INITIAL_CANDIDATE_MEASUREMENTS,
                status: "UNAVAILABLE",
                evaluatedAt: now,
              });
            }
          }
        }
        const stableForMs = stableSinceRef.current ? now - stableSinceRef.current : 0;
        const result = analyzeFrameQuality(imageData, previousFrameDataRef.current, {
          stableForMs,
        });
        const { frameData, sampleAcceptable, ...quality } = result;

        if (!countEstimationDisabled && stableBoundaryResult) {
          try {
            const estimate = estimateFruitCount({
              candidates: stableBoundaryResult.candidates,
              scanMode: scannerUi.scanMode,
              roi: { width, height },
              options: {
                boundaryStatus: stableBoundaryResult.status,
                frameQuality: quality,
                evaluatedAt: now,
                detectorVersion: stableBoundaryResult.detectorVersion,
              },
            });
            const countSample = {
              clearCandidateCount: estimate.clearCandidateCount,
              partialCandidateCount: estimate.partialCandidateCount,
              mergedRegionCount: estimate.mergedRegionCount,
              estimatedMinimumCount: estimate.estimatedMinimumCount,
              estimatedMaximumCount: estimate.estimatedMaximumCount,
              estimatedCount: estimate.estimatedCount,
              confidence: estimate.confidence,
              confidenceLevel: estimate.confidenceLevel,
              status: estimate.status,
              evaluatedAt: estimate.evaluatedAt,
              estimatorVersion: estimate.estimatorVersion,
              detectorVersion: estimate.detectorVersion,
            };
            const previousEstimate =
              countHistoryRef.current[countHistoryRef.current.length - 1];
            if (
              previousEstimate &&
              previousEstimate.detectorVersion !== countSample.detectorVersion
            ) {
              countHistoryRef.current = [];
            }
            countHistoryRef.current = [
              ...countHistoryRef.current.slice(-4),
              countSample,
            ];
            const stableEstimate = stabilizeFruitCountEstimates(
              countHistoryRef.current,
              { scanMode: scannerUi.scanMode }
            );
            setFruitCountEstimate(stableEstimate || INITIAL_FRUIT_COUNT_ESTIMATE);
            consecutiveCountErrors = 0;
          } catch {
            consecutiveCountErrors += 1;
            countHistoryRef.current = [];
            if (consecutiveCountErrors >= MAX_CONSECUTIVE_ANALYSIS_ERRORS) {
              countEstimationDisabled = true;
              setFruitCountEstimate({
                ...INITIAL_FRUIT_COUNT_ESTIMATE,
                status: "UNAVAILABLE",
                evaluatedAt: now,
              });
            }
          }
        }

        if (!measurementEstimationDisabled && stableBoundaryResult) {
          try {
            const estimate = estimateCandidateMeasurements({
              candidates: stableBoundaryResult.candidates,
              calibration: scaleCalibration,
              scanMode: scannerUi.scanMode,
              options: {
                frameQuality: quality,
                evaluatedAt: now,
              },
            });
            const measurementSample = {
              status: estimate.status,
              measurements: estimate.measurements.map((measurement) => ({
                candidateId: measurement.candidateId,
                center: measurement.center,
                widthPixels: measurement.widthPixels,
                heightPixels: measurement.heightPixels,
                equivalentDiameterPixels: measurement.equivalentDiameterPixels,
                estimatedWidthMm: measurement.estimatedWidthMm,
                estimatedHeightMm: measurement.estimatedHeightMm,
                estimatedEquivalentDiameterMm:
                  measurement.estimatedEquivalentDiameterMm,
                confidence: measurement.confidence,
                confidenceLevel: measurement.confidenceLevel,
                validForMeasurement: measurement.validForMeasurement,
                tiltWarning: measurement.tiltWarning,
              })),
              measuredCandidateCount: estimate.measuredCandidateCount,
              skippedCandidateCount: estimate.skippedCandidateCount,
              averageDiameterMm: estimate.averageDiameterMm,
              minimumDiameterMm: estimate.minimumDiameterMm,
              maximumDiameterMm: estimate.maximumDiameterMm,
              confidence: estimate.confidence,
              confidenceLevel: estimate.confidenceLevel,
              multipleCandidatesAdvisory: estimate.advisories.includes(
                "Use Single Fruit mode with one fruit for a clearer measurement."
              ),
              evaluatedAt: estimate.evaluatedAt,
              estimatorVersion: estimate.estimatorVersion,
              calibrationVersion: estimate.calibrationVersion,
            };
            const previousMeasurement =
              measurementHistoryRef.current[
                measurementHistoryRef.current.length - 1
              ];
            if (
              previousMeasurement &&
              previousMeasurement.calibrationVersion !==
                measurementSample.calibrationVersion
            ) {
              measurementHistoryRef.current = [];
            }
            measurementHistoryRef.current = [
              ...measurementHistoryRef.current.slice(-4),
              measurementSample,
            ];
            const stableMeasurements = stabilizeCandidateMeasurements(
              measurementHistoryRef.current,
              { scanMode: scannerUi.scanMode }
            );
            setCandidateMeasurements(
              stableMeasurements || INITIAL_CANDIDATE_MEASUREMENTS
            );
            consecutiveMeasurementErrors = 0;
          } catch {
            consecutiveMeasurementErrors += 1;
            measurementHistoryRef.current = [];
            if (
              consecutiveMeasurementErrors >= MAX_CONSECUTIVE_ANALYSIS_ERRORS
            ) {
              measurementEstimationDisabled = true;
              setCandidateMeasurements({
                ...INITIAL_CANDIDATE_MEASUREMENTS,
                status: "UNAVAILABLE",
                evaluatedAt: now,
              });
            }
          }
        }

        previousFrameDataRef.current = frameData;
        if (sampleAcceptable) {
          if (!stableSinceRef.current) stableSinceRef.current = now;
        } else {
          stableSinceRef.current = null;
        }

        setFrameQuality({
          ...quality,
          evaluatedAt: now,
          analysisAvailable: true,
        });
        consecutiveErrors = 0;
      } catch {
        consecutiveErrors += 1;
        previousFrameDataRef.current = null;
        stableSinceRef.current = null;
        subjectHistoryRef.current = [];
        boundaryHistoryRef.current = [];
        countHistoryRef.current = [];
        measurementHistoryRef.current = [];
        if (consecutiveErrors >= MAX_CONSECUTIVE_ANALYSIS_ERRORS) {
          window.clearInterval(intervalId);
          guideRoiRef.current = null;
          setGuideAreaStatus("UNAVAILABLE");
          resetScaleCalibration();
          setFrameQuality({
            ...INITIAL_FRAME_QUALITY,
            evaluatedAt: Date.now(),
            instruction: "Guide analysis is unavailable. You can still capture manually.",
          });
          setSubjectPlacement({
            ...INITIAL_SUBJECT_PLACEMENT,
            alignmentState: "UNCERTAIN",
            evaluatedAt: Date.now(),
            guidance: "Automatic alignment guidance is unavailable. Position the subject manually.",
          });
          setBoundaryCandidates({
            ...INITIAL_BOUNDARY_CANDIDATES,
            status: "UNAVAILABLE",
            evaluatedAt: Date.now(),
          });
          setFruitCountEstimate({
            ...INITIAL_FRUIT_COUNT_ESTIMATE,
            status: "UNAVAILABLE",
            evaluatedAt: Date.now(),
          });
          setCandidateMeasurements({
            ...INITIAL_CANDIDATE_MEASUREMENTS,
            status: "UNAVAILABLE",
            evaluatedAt: Date.now(),
          });
        }
      }
    };

    intervalId = window.setInterval(analyzeCurrentFrame, ANALYSIS_INTERVAL_MS);
    analyzeCurrentFrame();

    return () => {
      window.clearInterval(intervalId);
      previousFrameDataRef.current = null;
      stableSinceRef.current = null;
      subjectHistoryRef.current = [];
      boundaryHistoryRef.current = [];
      countHistoryRef.current = [];
      measurementHistoryRef.current = [];
    };
  }, [cameraActive, cameraStream, cameraCalibration, guideAreaStatus, scaleCalibration, scannerUi.cameraReady, scannerUi.scanMode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      captureGenerationRef.current += 1;
      readinessReadySinceRef.current = null;
      readinessLockedAtRef.current = null;
      readinessAcceptableSamplesRef.current = 0;
      clearAutoCaptureTimers();
      captureInFlightRef.current = false;
      lastAutoSignatureRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const openCamera = async () => {
    if (!session || uploading || cameraStarting || scannerUi.cancelled) return;

    if (!isMobile) {
      setMessage("Lot photos and video must be captured live from a mobile camera.");
      return;
    }

    if (session.mediaType !== "image") {
      setMessage("Live video capture is coming soon. Please capture photos first.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("No compatible camera is available in this browser. Open the link in a current mobile browser.");
      return;
    }

    if (window.isSecureContext === false) {
      setMessage("A secure connection is required to start the live scanner.");
      return;
    }

    try {
      setMessage("");
      setCameraStarting(true);
      updateScannerUi({
        scannerStatus: "STARTING",
        cameraReady: false,
        captureStatus: "IDLE",
        stopped: false,
        autoCaptureEnabled: false,
        autoCapturePaused: false,
        autoCaptureStatus: "OFF",
      });
      resetFrameAnalysis();
      resetAutoCaptureRuntime();
      captureGenerationRef.current += 1;
      stopCamera();
      setCameraCalibration((current) =>
        updateCalibrationState(current, CALIBRATION_STATUS.WAITING, {
          timestamp: new Date().toISOString(),
        })
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraStream(stream);
      setCameraActive(true);
      updateScannerUi({
        scannerStatus: "ACTIVE",
        cameraReady: true,
        captureStatus: "READY",
      });
    } catch (error) {
      const name = String(error?.name || "").toLowerCase();
      if (name.includes("notallowed") || name.includes("permission")) {
        setMessage("Camera permission is required to start the live scanner. Allow camera access in your browser settings and try again.");
      } else if (name.includes("notfound") || name.includes("overconstrained")) {
        setMessage("No compatible camera was found on this device.");
      } else if (name.includes("notreadable")) {
        setMessage("Unable to open camera. Close other camera apps and try again.");
      } else {
        setMessage("Unable to open camera. Close other camera apps and try again.");
      }
      resetAutoCaptureRuntime();
      setCameraCalibration((current) =>
        updateCalibrationState(current, CALIBRATION_STATUS.INVALID, {
          timestamp: new Date().toISOString(),
        })
      );
      updateScannerUi({
        scannerStatus: "IDLE",
        cameraReady: false,
        captureStatus: "IDLE",
        autoCaptureEnabled: false,
        autoCapturePaused: false,
        autoCaptureStatus: "STOPPED",
      });
    } finally {
      setCameraStarting(false);
    }
  };

  const stopScanner = () => {
    captureGenerationRef.current += 1;
    stopCamera();
    resetFrameAnalysis();
    resetAutoCaptureRuntime();
    updateScannerUi({
      scannerStatus: "STOPPED",
      cameraReady: false,
      captureStatus: uploaded ? "UPLOADED" : "IDLE",
      stopped: true,
      autoCaptureEnabled: false,
      autoCapturePaused: false,
      autoCaptureStatus: "STOPPED",
    });
    setMessage(uploaded ? "Scanner stopped. The uploaded scan frame is preserved." : "Scanner stopped. You can resume this session.");
  };

  const cancelScanner = () => {
    captureGenerationRef.current += 1;
    stopCamera();
    resetFrameAnalysis();
    resetAutoCaptureRuntime();
    updateScannerUi({
      scannerStatus: "CANCELLED",
      cameraReady: false,
      captureStatus: uploaded ? "UPLOADED" : "IDLE",
      stopped: true,
      cancelled: true,
      autoCaptureEnabled: false,
      autoCapturePaused: false,
      autoCaptureStatus: "STOPPED",
    });
    setMessage(
      uploaded
        ? "Scanner cancelled on this device. The uploaded scan frame remains attached to this session."
        : "Scanner cancelled on this device. Return to the Fruit Lot form when ready."
    );
  };

  const captureFrameFile = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      throw new Error("camera-frame-unavailable");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas-unavailable");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );

    canvas.width = 0;
    canvas.height = 0;

    if (!blob) {
      throw new Error("canvas-blob-unavailable");
    }

    return new File([blob], `fruit-capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const uploadCapturedImage = async (
    file,
    { captureId, generation, scanMetadata, guideLockWarning, source }
  ) => {
    if (!file || !session || generation !== captureGenerationRef.current) {
      return { success: false, reason: "cancelled" };
    }

    let phase = "recognition";
    try {
      updateScannerUi({ captureStatus: "CHECKING" });
      updateCaptureMetadata(captureId, { uploadStatus: "CHECKING_IMAGE" });
      setMessage(
        guideLockWarning
          ? "Guide was not locked. Checking image..."
          : "Checking image..."
      );
      const { recognizeFruitImage } = await loadFruitRecognition();
      const recognition = await withTimeout(recognizeFruitImage(file), 15000);

      if (generation !== captureGenerationRef.current || !mountedRef.current) {
        return { success: false, reason: "cancelled" };
      }

      if (!recognition?.accepted) {
        setMessage(
          recognition?.warning || "Fruit not recognized - reposition fruit and try again."
        );
        updateScannerUi({ captureStatus: "RETRY" });
        updateCaptureMetadata(captureId, { uploadStatus: "RECOGNITION_REJECTED" });
        return { success: false, reason: "recognition" };
      }

      setMessage("Uploading scan");
      phase = "upload";
      updateScannerUi({ captureStatus: "UPLOADING" });
      updateCaptureMetadata(captureId, { uploadStatus: "UPLOADING" });
      const data = new FormData();
      data.append("media", file);
      data.append("scanMetadata", JSON.stringify(scanMetadata));

      const response = await API.post(`/capture-sessions/${sessionId}/media`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (generation !== captureGenerationRef.current || !mountedRef.current) {
        return { success: false, reason: "cancelled" };
      }

      setUploaded(true);
      setSession(response.data);
      setScanAccepted(false);
      setRetakeActive(false);
      clearAutoCaptureTimers();
      if (source === "AUTO") {
        autoCooldownTimerRef.current = window.setTimeout(() => {
          autoCooldownTimerRef.current = null;
        }, AUTO_CAPTURE_COOLDOWN_MS);
      }
      updateScannerUi({
        scannerStatus: "COMPLETED",
        cameraReady: false,
        captureStatus: "UPLOADED",
        capturedCount: 1,
        autoCaptureEnabled: false,
        autoCapturePaused: source === "AUTO",
        autoCaptureStatus: source === "AUTO" ? "PAUSED" : "STOPPED",
      });
      updateCaptureMetadata(captureId, { uploadStatus: "UPLOADED" });
      setMessage("Scan Frame Uploaded");
      stopCamera();
      return { success: true, recognitionAccepted: true };
    } catch (error) {
      if (generation !== captureGenerationRef.current || !mountedRef.current) {
        return { success: false, reason: "cancelled" };
      }

      const recognitionFailed = phase === "recognition";
      const expired = !recognitionFailed && error.response?.status === 410;
      const finalized = !recognitionFailed && error.response?.status === 409;
      setMessage(
        expired
          ? "This scanning session has expired. Return to the Fruit Lot form and start a new session."
          : finalized
            ? "This scanning session is already finalized. Start a new scan session to continue."
          : recognitionFailed
            ? isLowMemoryRecognitionError(error)
              ? "Low phone memory - clean space and try again."
              : "Fruit not recognized - reposition fruit and try again."
            : getApiErrorMessage(error, "Could not upload captured media. Please try again.")
      );
      updateScannerUi({
        captureStatus: "FAILED",
        ...(expired || finalized
          ? {
              autoCaptureEnabled: false,
              autoCapturePaused: true,
              autoCaptureStatus: "STOPPED",
            }
          : {}),
      });
      updateCaptureMetadata(captureId, {
        uploadStatus: expired
          ? "SESSION_EXPIRED"
          : recognitionFailed
            ? "RECOGNITION_REJECTED"
            : "FAILED",
      });
      if (expired || finalized) clearAutoCaptureTimers();
      if (expired || finalized) {
        lastAutoSignatureRef.current = null;
        stopCamera();
        resetFrameAnalysis();
      }
      return {
        success: false,
        reason: expired ? "expired" : finalized ? "finalized" : recognitionFailed ? "recognition" : "upload",
        recognitionAccepted: !recognitionFailed,
      };
    }
  };

  const captureCurrentFrame = async ({ source, readinessSnapshot = scanReadiness }) => {
    const normalizedSource = source === "AUTO" ? "AUTO" : "MANUAL";
    const sessionExpiresAt = Date.parse(session?.expiresAt || "");
    const sessionStatus = String(session?.status || "").toLowerCase();
    if (
      normalizedSource === "AUTO" &&
      (
        readinessSnapshot?.state !== "LOCKED" ||
        scanReadiness.state !== "LOCKED" ||
        !scannerUi.autoCaptureEnabled ||
        scannerUi.autoCapturePaused ||
        guideAreaStatus !== "READY" ||
        document.hidden ||
        (Number.isFinite(sessionExpiresAt) && sessionExpiresAt <= Date.now()) ||
        (!retakeActive && ["uploaded", "attached", "completed", "finalized"].includes(sessionStatus)) ||
        scannerUi.capturedCount >= 1
      )
    ) {
      return { success: false, reason: "readiness-changed" };
    }
    if (
      captureInFlightRef.current ||
      uploading ||
      uploaded ||
      !cameraActive ||
      !scannerUi.cameraReady ||
      scannerUi.cancelled ||
      scannerUi.stopped
    ) {
      return { success: false, reason: "unavailable" };
    }

    if (normalizedSource === "MANUAL") {
      if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
      if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
      autoReadyTimerRef.current = null;
      autoCooldownTimerRef.current = null;
      lastAutoSignatureRef.current = null;
      if (scannerUi.autoCaptureEnabled) {
        updateScannerUi({ autoCapturePaused: true, autoCaptureStatus: "PAUSED" });
      }
    }

    const signature = createFrameSignature(previousFrameDataRef.current);
    const signatureDifference = normalizedSource === "AUTO"
      ? getSignatureDifference(signature, lastAutoSignatureRef.current)
      : null;
    const duplicate =
      normalizedSource === "AUTO" &&
      signatureDifference !== null &&
      signatureDifference < AUTO_CAPTURE_DUPLICATE_THRESHOLD;
    const triggeredAt = Date.now();
    const guideLockWarning =
      normalizedSource === "MANUAL" &&
      readinessSnapshot?.state !== "LOCKED";
    const captureId = `${normalizedSource}-${triggeredAt}`;
    const duplicateCheckResult = {
      checked:
        normalizedSource === "AUTO" &&
        Boolean(signature && lastAutoSignatureRef.current),
      isDuplicate: duplicate,
      differenceScore: signatureDifference,
    };
    const qualitySnapshot = {
      brightnessScore: frameQuality.brightnessScore,
      contrastScore: frameQuality.contrastScore,
      sharpnessScore: frameQuality.sharpnessScore,
      motionScore: frameQuality.motionScore,
      stabilityScore: frameQuality.stabilityScore,
      overallScore: frameQuality.overallScore,
      readiness: frameQuality.readiness,
      evaluatedAt: frameQuality.evaluatedAt,
    };
    const subjectHeuristicSnapshot = {
      presenceState: subjectPlacement.presenceState,
      presenceScore: subjectPlacement.presenceScore,
      foregroundCoverage: subjectPlacement.foregroundCoverage,
      centroidXRatio: subjectPlacement.centroidXRatio,
      centroidYRatio: subjectPlacement.centroidYRatio,
      borderContact: subjectPlacement.borderContact,
      sizeState: subjectPlacement.sizeState,
      alignmentState: subjectPlacement.alignmentState,
      guidance: subjectPlacement.guidance,
      evaluatedAt: subjectPlacement.evaluatedAt,
    };
    const localReadinessSnapshot = {
      ...readinessSnapshot,
      signalSummary: { ...(readinessSnapshot?.signalSummary || {}) },
    };

    setCaptureHistory((current) => [
      ...current.slice(-9),
      {
        id: captureId,
        source: normalizedSource,
        triggeredAt,
        scanMode: scannerUi.scanMode,
        frameQuality: qualitySnapshot,
        subjectHeuristic: subjectHeuristicSnapshot,
        readinessSnapshot: localReadinessSnapshot,
        duplicateCheckResult,
        duplicateDifference: signatureDifference,
        captureStatus: duplicate ? "DUPLICATE_DEFERRED" : "CAPTURING",
        uploadStatus: duplicate ? "DUPLICATE_DEFERRED" : "CAPTURING",
      },
    ]);

    if (duplicate) {
      updateScannerUi({ autoCaptureStatus: "REPOSITION" });
      setMessage("Reposition the subject for the next scan.");
      scheduleAutoCaptureDelay(AUTO_CAPTURE_COOLDOWN_MS, "REPOSITION");
      return { success: false, reason: "duplicate" };
    }

    captureInFlightRef.current = true;
    resetScanLock();
    const generation = captureGenerationRef.current;
    setUploading(true);
    updateScannerUi({
      captureStatus: "CAPTURING",
      ...(normalizedSource === "AUTO" ? { autoCaptureStatus: "CAPTURING" } : {}),
    });
    setMessage(
      normalizedSource === "AUTO"
        ? "Capturing scan frame"
        : guideLockWarning
          ? "Guide is not locked. Capturing manually..."
          : "Capturing scan frame..."
    );
    setCaptureFlash(true);
    if (captureFlashTimerRef.current) window.clearTimeout(captureFlashTimerRef.current);
    captureFlashTimerRef.current = window.setTimeout(() => {
      captureFlashTimerRef.current = null;
      if (mountedRef.current) setCaptureFlash(false);
    }, 180);

    try {
      const file = await captureFrameFile();
      const video = videoRef.current;
      const deviceMetadata = getDeviceMetadata(video);
      const guide = SCAN_MODE_GUIDES[scannerUi.scanMode] || SCAN_MODE_GUIDES.SINGLE_FRUIT;
      const guideRoi = guideRoiRef.current;
      const scanMetadata = createScanMetadata({
        scanId: captureId,
        captureSessionId: sessionId,
        fruitLotId: null,
        fruitType: session?.fruitType || "",
        fruitVariety: session?.fruitVariety || "",
        growerId: null,
        scanMode: scannerUi.scanMode,
        captureSource: normalizedSource,
        captureNumber: captureHistory.length + 1,
        capturedAt: new Date(triggeredAt).toISOString(),
        device: deviceMetadata,
        image: {
          imageWidth: video?.videoWidth || null,
          imageHeight: video?.videoHeight || null,
          mimeType: file.type,
          fileSize: file.size,
        },
        qualitySnapshot,
        subjectPlacement: subjectHeuristicSnapshot,
        guideLockState: readinessSnapshot?.state || scanReadiness.state,
        guideMetadata: {
          guideVersion: "1",
          xRatio: guide.xRatio,
          yRatio: guide.yRatio,
          widthRatio: guide.widthRatio,
          heightRatio: guide.heightRatio,
          sourceX: guideRoi?.sourceX,
          sourceY: guideRoi?.sourceY,
          sourceWidth: guideRoi?.sourceWidth,
          sourceHeight: guideRoi?.sourceHeight,
        },
        cameraCalibration,
        retakeRequested: retakeActive,
      });
      updateCaptureMetadata(captureId, { scanMetadata });
      const outcome = await uploadCapturedImage(file, {
        captureId,
        generation,
        scanMetadata,
        guideLockWarning,
        source: normalizedSource,
      });
      if (
        normalizedSource === "AUTO" &&
        signature &&
        (outcome.success || outcome.recognitionAccepted)
      ) {
        lastAutoSignatureRef.current = signature;
      }

      if (normalizedSource === "AUTO" && !outcome.success && outcome.reason !== "cancelled") {
        autoFailureCountRef.current += 1;
        if (autoFailureCountRef.current >= AUTO_CAPTURE_MAX_FAILURES) {
          updateScannerUi({ autoCapturePaused: true, autoCaptureStatus: "PAUSED" });
          setMessage("Auto capture paused. Adjust the frame or capture manually.");
        } else if (!["expired", "finalized"].includes(outcome.reason)) {
          scheduleAutoCaptureDelay(AUTO_CAPTURE_RETRY_MS, "COOLDOWN");
        }
      } else if (outcome.success) {
        autoFailureCountRef.current = 0;
      }
      return outcome;
    } catch (error) {
      if (generation === captureGenerationRef.current && mountedRef.current) {
        setMessage(
          isLowMemoryRecognitionError(error)
            ? "Low phone memory - clean space and try again."
            : "Could not capture the current frame. Hold steady and try again."
        );
        updateScannerUi({ captureStatus: "RETRY" });
        updateCaptureMetadata(captureId, { uploadStatus: "CAPTURE_FAILED" });
        if (normalizedSource === "AUTO") {
          autoFailureCountRef.current += 1;
          if (autoFailureCountRef.current >= AUTO_CAPTURE_MAX_FAILURES) {
            updateScannerUi({ autoCapturePaused: true, autoCaptureStatus: "PAUSED" });
            setMessage("Auto capture paused. Adjust the frame or capture manually.");
          } else {
            scheduleAutoCaptureDelay(AUTO_CAPTURE_RETRY_MS, "COOLDOWN");
          }
        }
      }
      return { success: false, reason: "capture" };
    } finally {
      if (generation === captureGenerationRef.current && mountedRef.current) {
        setUploading(false);
      }
      captureInFlightRef.current = false;
    }
  };

  captureCurrentFrameRef.current = captureCurrentFrame;

  const captureFruitPhoto = () => captureCurrentFrame({ source: "MANUAL" });

  const toggleAutoCapture = () => {
    if (!cameraActive || uploading || uploaded) return;

    if (scannerUi.autoCaptureEnabled) {
      if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
      if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
      autoReadyTimerRef.current = null;
      autoCooldownTimerRef.current = null;
      updateScannerUi({
        autoCaptureEnabled: false,
        autoCapturePaused: false,
        autoCaptureStatus: "OFF",
      });
      setMessage("Auto capture stopped. Manual capture remains available.");
      return;
    }

    autoFailureCountRef.current = 0;
    updateScannerUi({
      autoCaptureEnabled: true,
      autoCapturePaused: false,
      autoCaptureStatus: "WAITING",
      captureStatus: "READY",
    });
    setMessage("Auto Capture On. Waiting for guide lock.");
  };

  const toggleAutoCapturePause = () => {
    if (!scannerUi.autoCaptureEnabled || uploading || uploaded) return;

    if (scannerUi.autoCapturePaused) {
      autoFailureCountRef.current = 0;
      updateScannerUi({
        autoCapturePaused: false,
        autoCaptureStatus: "WAITING",
        captureStatus: "READY",
      });
      setMessage("Auto Capture On. Waiting for guide lock.");
    } else {
      if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
      if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
      autoReadyTimerRef.current = null;
      autoCooldownTimerRef.current = null;
      updateScannerUi({ autoCapturePaused: true, autoCaptureStatus: "PAUSED" });
      setMessage("Auto capture paused. Manual capture remains available.");
    }
  };

  const retakeScanFrame = () => {
    const status = String(session?.status || "").toLowerCase();
    if (["attached", "completed", "finalized"].includes(status)) {
      setMessage("This scan frame is already finalized and cannot be replaced from this session.");
      return;
    }

    const confirmed = window.confirm(
      "Retake this scan? The current frame remains saved until a replacement upload succeeds, and may then be replaced."
    );
    if (!confirmed) return;

    captureGenerationRef.current += 1;
    stopCamera();
    resetAutoCaptureRuntime();
    resetFrameAnalysis();
    setCaptureHistory([]);
    setRetakeActive(true);
    setUploaded(false);
    updateScannerUi({
      scannerStatus: "STOPPED",
      cameraReady: false,
      captureStatus: "IDLE",
      capturedCount: 0,
      stopped: true,
      cancelled: false,
      autoCaptureEnabled: false,
      autoCapturePaused: false,
      autoCaptureStatus: "OFF",
    });
    setMessage("Retake enabled. Start the scanner and capture a replacement frame when ready.");
  };

  useEffect(() => {
    const captureStatusAllowsAuto = ["IDLE", "READY"].includes(
      scannerUi.captureStatus
    );
    const expiresAt = Date.parse(session?.expiresAt || "");
    const sessionStatus = String(session?.status || "").toLowerCase();
    const sessionAvailable =
      !(Number.isFinite(expiresAt) && expiresAt <= Date.now()) &&
      (retakeActive || !["uploaded", "attached", "completed", "finalized"].includes(sessionStatus));
    const canScheduleAutoCapture =
      AUTO_CAPTURE_AVAILABLE &&
      scannerUi.scannerStatus === "ACTIVE" &&
      cameraActive &&
      scannerUi.autoCaptureEnabled &&
      !scannerUi.autoCapturePaused &&
      scannerUi.cameraReady &&
      guideAreaStatus === "READY" &&
      scanReadiness.state === "LOCKED" &&
      captureStatusAllowsAuto &&
      !uploading &&
      !uploaded &&
      sessionAvailable &&
      !scannerUi.stopped &&
      !scannerUi.cancelled &&
      scannerUi.capturedCount < 1 &&
      !document.hidden &&
      !captureInFlightRef.current &&
      !autoCooldownTimerRef.current;

    if (!canScheduleAutoCapture) {
      if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
      autoReadyTimerRef.current = null;
      if (
        scannerUi.autoCaptureEnabled &&
        !scannerUi.autoCapturePaused &&
        scannerUi.autoCaptureStatus === "PENDING"
      ) {
        updateScannerUi({ autoCaptureStatus: "WAITING" });
      }
      return undefined;
    }

    if (autoReadyTimerRef.current) return undefined;

    updateScannerUi({ autoCaptureStatus: "PENDING" });
    const lockedSnapshot = scanReadiness;
    autoReadyTimerRef.current = window.setTimeout(() => {
      autoReadyTimerRef.current = null;
      captureCurrentFrameRef.current?.({
        source: "AUTO",
        readinessSnapshot: lockedSnapshot,
      });
    }, AUTO_CAPTURE_READY_HOLD_MS);

    return () => {
      if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
      autoReadyTimerRef.current = null;
    };
  }, [
    cameraActive,
    guideAreaStatus,
    retakeActive,
    scanReadiness.state,
    scannerUi.autoCaptureEnabled,
    scannerUi.autoCapturePaused,
    scannerUi.cameraReady,
    scannerUi.cancelled,
    scannerUi.capturedCount,
    scannerUi.captureStatus,
    scannerUi.scannerStatus,
    scannerUi.stopped,
    session?.expiresAt,
    session?.status,
    uploaded,
    uploading,
  ]);

  useEffect(() => {
    const now = Date.now();
    const expiresAt = Date.parse(session?.expiresAt || "");
    const status = String(session?.status || "").toLowerCase();
    const captureInProgress =
      uploading ||
      captureInFlightRef.current ||
      ["CAPTURING", "CHECKING", "UPLOADING"].includes(scannerUi.captureStatus);
    const input = {
      scannerActive: scannerUi.scannerStatus === "ACTIVE" && cameraActive,
      cameraReady: scannerUi.cameraReady,
      roiReady: guideAreaStatus === "READY",
      roiStatus: guideAreaStatus,
      frameQuality,
      subjectPlacement,
      boundaryCandidates,
      fruitCountEstimate,
      scanMode: scannerUi.scanMode,
      captureInProgress,
      sessionState: {
        expired: Number.isFinite(expiresAt) && expiresAt <= now,
        cancelled: scannerUi.cancelled,
        stopped: scannerUi.stopped,
        completed:
          !retakeActive &&
          (uploaded || ["uploaded", "attached", "completed", "finalized"].includes(status)),
      },
      readySince: readinessReadySinceRef.current,
      evaluatedAt: now,
      lockDurationMs: SCAN_LOCK_DURATION_MS,
    };
    const result = evaluateScanReadiness(input);

    if (!result.readyForLock) {
      readinessReadySinceRef.current = null;
      readinessLockedAtRef.current = null;
      readinessAcceptableSamplesRef.current = 0;
      setScanReadiness({
        ...result,
        readySince: null,
        lockedAt: null,
        evaluatedAt: now,
      });
      return;
    }

    readinessAcceptableSamplesRef.current += 1;
    if (readinessAcceptableSamplesRef.current < 2) {
      readinessReadySinceRef.current = null;
      setScanReadiness({
        ...result,
        state: "CHECKING",
        blockingReason: "Checking frame consistency",
        advisoryReason: "Hold steady",
        lockProgress: 0,
        readySince: null,
        lockedAt: null,
        evaluatedAt: now,
      });
      return;
    }

    if (!readinessReadySinceRef.current) readinessReadySinceRef.current = now;
    const heldResult = evaluateScanReadiness({
      ...input,
      readySince: readinessReadySinceRef.current,
    });
    if (heldResult.state === "LOCKED" && !readinessLockedAtRef.current) {
      readinessLockedAtRef.current = now;
    }
    setScanReadiness({
      ...heldResult,
      readySince: readinessReadySinceRef.current,
      lockedAt: readinessLockedAtRef.current,
      evaluatedAt: now,
    });
  }, [
    cameraActive,
    boundaryCandidates,
    frameQuality,
    fruitCountEstimate,
    guideAreaStatus,
    retakeActive,
    scannerUi.cameraReady,
    scannerUi.cancelled,
    scannerUi.captureStatus,
    scannerUi.scannerStatus,
    scannerUi.scanMode,
    scannerUi.stopped,
    session?.expiresAt,
    session?.status,
    subjectPlacement,
    uploaded,
    uploading,
  ]);

  const isImage = session?.mediaType === "image";
  const isStatusMessage = [
    "Checking image...",
    "Guide was not locked. Checking image...",
    "Uploading scan",
    "Auto capturing...",
    "Capturing scan frame",
    "Capturing scan frame...",
    "Guide is not locked. Capturing manually...",
    "Auto Capture Enabled. Waiting for a clear, stable frame.",
    "Auto Capture On. Waiting for guide lock.",
    "Reposition the subject for the next scan.",
    "Auto capture paused. Manual capture remains available.",
    "Auto capture paused. Adjust the frame or capture manually.",
    "Auto capture stopped. Manual capture remains available.",
  ].includes(message);
  const uploadProgressLabel = getUploadProgressLabel(session);
  const selectedScanMode =
    SCAN_MODES.find((mode) => mode.value === scannerUi.scanMode) || SCAN_MODES[0];
  const selectedGuide = SCAN_MODE_GUIDES[selectedScanMode.value];
  const guideStyle = {
    left: `${selectedGuide.xRatio * 100}%`,
    top: `${selectedGuide.yRatio * 100}%`,
    width: `${selectedGuide.widthRatio * 100}%`,
    height: `${selectedGuide.heightRatio * 100}%`,
    borderRadius:
      selectedGuide.shape === "circle"
        ? "9999px"
        : selectedGuide.shape === "roundedRect"
          ? "1.5rem"
          : "0.5rem",
  };
  const analysisFailed =
    guideAreaStatus === "UNAVAILABLE" ||
    Boolean(frameQuality.evaluatedAt && !frameQuality.analysisAvailable);
  const measuredStatus = analysisFailed ? "Manual guidance" : "Checking";
  const lightingStatus = frameQuality.analysisAvailable
    ? frameQuality.brightnessState === "TOO_DARK"
      ? "Too Dark"
      : frameQuality.brightnessState === "TOO_BRIGHT"
        ? "Too Bright"
        : "Good"
    : measuredStatus;
  const focusStatus = frameQuality.analysisAvailable
    ? frameQuality.sharpnessState === "BLURRY" ? "Blurry" : "Acceptable"
    : measuredStatus;
  const contrastStatus = frameQuality.analysisAvailable
    ? frameQuality.contrastState === "LOW" ? "Low Contrast" : "Acceptable"
    : measuredStatus;
  const stabilityStatus = frameQuality.analysisAvailable
    ? {
        MOVING: "Moving",
        SETTLING: "Settling",
        STABLE: "Stable",
        CHECKING: "Checking",
      }[frameQuality.motionState] || "Checking"
    : measuredStatus;
  const placementGuidance = subjectPlacement.sampleCount < 3
    ? "Keep the subject steady while alignment is checked."
    : subjectPlacement.guidance;
  const guideLocked = scanReadiness.state === "LOCKED";
  const guideLockStatus = {
    NOT_READY: "Waiting",
    CHECKING: "Checking",
    READY: "Ready",
    LOCKED: "Locked",
  }[scanReadiness.state] || "Waiting";
  const positioningBlockers = [
    "SUBJECT_UNCERTAIN",
    "SUBJECT_CROPPED",
    "SUBJECT_TOO_SMALL",
    "SUBJECT_SIZE_CHECKING",
    "SUBJECT_MISALIGNED",
    "SUBJECT_CHECKING",
  ];
  const guideStateLabel = scanReadiness.state === "LOCKED"
    ? "Guide Locked"
    : scanReadiness.state === "READY"
      ? "Ready — Keep Still"
      : scanReadiness.blockingCode === "CAMERA_MOVING"
        ? "Hold Steady"
        : positioningBlockers.includes(scanReadiness.blockingCode)
          ? "Position Subject"
          : "Checking Frame";
  const guideAreaLabel = {
    WAITING: "Waiting",
    READY: "Ready",
    UNAVAILABLE: "Unavailable",
  }[guideAreaStatus] || "Unavailable";
  const alignmentStatus = !scannerUi.cameraReady || guideAreaStatus === "WAITING"
    ? "Waiting"
    : guideAreaStatus === "UNAVAILABLE" || subjectPlacement.alignmentState === "UNCERTAIN"
      ? "Uncertain"
      : !subjectPlacement.analysisAvailable
        ? "Waiting"
        : subjectPlacement.sampleCount < 3
          ? "Position Subject"
        : {
            POSITION_SUBJECT: "Position Subject",
            MOVE_LEFT: "Move Left",
            MOVE_RIGHT: "Move Right",
            MOVE_UP: "Move Up",
            MOVE_DOWN: "Move Down",
            MOVE_CLOSER: "Move Closer",
            MOVE_FARTHER: "Move Farther",
            ALIGNMENT_ACCEPTABLE: "Alignment Acceptable",
          }[subjectPlacement.alignmentState] || "Uncertain";
  const subjectPresenceLabel = !subjectPlacement.analysisAvailable
    ? guideAreaStatus === "UNAVAILABLE" ? "Unavailable" : "Waiting"
    : {
        EMPTY_OR_UNCERTAIN: "Presence uncertain",
        SUBJECT_PRESENT_LOW_CONFIDENCE: "Low confidence",
        SUBJECT_PRESENT: "Appears in guide",
        OVERFILLED_OR_CROPPED: "Possible cropping",
      }[subjectPlacement.presenceState] || "Presence uncertain";
  const calibrationStatus = {
    UNINITIALIZED: "Waiting",
    WAITING: "Waiting",
    ESTIMATING: "Estimating",
    READY: "Ready",
    INVALID: "Unavailable",
  }[cameraCalibration.status] || "Unavailable";
  const scaleCalibrationStatus = {
    [SCALE_CALIBRATION_STATUS.NOT_REQUIRED]: "Not selected",
    [SCALE_CALIBRATION_STATUS.WAITING_FOR_REFERENCE]: "Place reference",
    [SCALE_CALIBRATION_STATUS.REFERENCE_CANDIDATE]: "Select reference",
    [SCALE_CALIBRATION_STATUS.CALIBRATING]: "Calibrating",
    [SCALE_CALIBRATION_STATUS.READY]: "Scale reference ready",
    [SCALE_CALIBRATION_STATUS.LOW_CONFIDENCE]: "Low confidence",
    [SCALE_CALIBRATION_STATUS.INVALID]: "Unavailable",
    [SCALE_CALIBRATION_STATUS.UNAVAILABLE]: "Unavailable",
  }[scaleCalibration.status] || "Unavailable";
  const boundaryEstimateStatus = {
    WAITING: "Waiting",
    EVALUATING: "Evaluating",
    NO_CANDIDATE: "No clear candidate",
    CANDIDATE_FOUND: "Candidate found",
    MULTIPLE_CANDIDATES: "Multiple candidates",
    LOW_CONFIDENCE: "Low confidence",
    UNAVAILABLE: "Unavailable",
  }[boundaryCandidates.status] || "Unavailable";
  const estimatedFruitCountStatus = (() => {
    if (["NOT_AVAILABLE", "UNAVAILABLE"].includes(fruitCountEstimate.status)) {
      return "Not available";
    }
    if (fruitCountEstimate.status === "MULTIPLE_SUBJECTS") {
      return "Multiple subjects in Single Fruit mode";
    }
    if (["WAITING", "NO_CANDIDATES"].includes(fruitCountEstimate.status)) {
      return "Waiting";
    }
    if (fruitCountEstimate.status === "LOW_CONFIDENCE") {
      return "Low confidence";
    }
    if (
      Number.isFinite(fruitCountEstimate.estimatedMinimumCount) &&
      Number.isFinite(fruitCountEstimate.estimatedMaximumCount) &&
      fruitCountEstimate.estimatedMinimumCount !==
        fruitCountEstimate.estimatedMaximumCount
    ) {
      return `${fruitCountEstimate.estimatedMinimumCount}\u2013${fruitCountEstimate.estimatedMaximumCount} estimated`;
    }
    return Number.isFinite(fruitCountEstimate.estimatedCount)
      ? `${fruitCountEstimate.estimatedCount} estimated`
      : "Waiting";
  })();
  const estimatedDiameterStatus = (() => {
    if (candidateMeasurements.status === "PACKAGE_UNAVAILABLE") {
      return "Unavailable in Package View";
    }
    if (candidateMeasurements.status === "WAITING_FOR_CALIBRATION") {
      return "Waiting for calibration";
    }
    if (candidateMeasurements.status === "UNAVAILABLE") {
      return "Unavailable";
    }
    if (candidateMeasurements.status === "STABILIZING") {
      return "No measurable candidate";
    }
    if (candidateMeasurements.status === "NO_MEASURABLE_CANDIDATE") {
      return "No measurable candidate";
    }
    if (candidateMeasurements.status === "LOW_CONFIDENCE") {
      return "Low confidence";
    }
    if (
      Number.isFinite(candidateMeasurements.minimumDiameterMm) &&
      Number.isFinite(candidateMeasurements.maximumDiameterMm) &&
      candidateMeasurements.minimumDiameterMm !==
        candidateMeasurements.maximumDiameterMm
    ) {
      return `${candidateMeasurements.minimumDiameterMm.toFixed(1)}\u2013${candidateMeasurements.maximumDiameterMm.toFixed(1)} mm estimated`;
    }
    return Number.isFinite(candidateMeasurements.averageDiameterMm)
      ? `${candidateMeasurements.averageDiameterMm.toFixed(1)} mm estimated`
      : "No measurable candidate";
  })();
  const measurementTiltWarning = candidateMeasurements.measurements.some(
    (measurement) => measurement.tiltWarning
  );
  const scannerChecks = [
    { label: "Camera", value: cameraStarting ? "Starting" : scannerUi.cameraReady ? "Ready" : "Waiting" },
    { label: "Calibration", value: calibrationStatus },
    { label: "Scale Calibration", value: scaleCalibrationStatus },
    { label: "Boundary Estimate", value: boundaryEstimateStatus },
    { label: "Provisional Region Count", value: estimatedFruitCountStatus },
    { label: "Estimated Diameter", value: estimatedDiameterStatus },
    { label: "Guide Area", value: guideAreaLabel },
    { label: "Guide Lock", value: guideLockStatus },
    { label: "Subject", value: subjectPresenceLabel },
    { label: "Alignment", value: alignmentStatus },
    { label: "Focus", value: scannerUi.cameraReady ? focusStatus : "Waiting" },
    { label: "Lighting", value: scannerUi.cameraReady ? lightingStatus : "Waiting" },
    { label: "Contrast", value: scannerUi.cameraReady ? contrastStatus : "Waiting" },
    { label: "Stability", value: scannerUi.cameraReady ? stabilityStatus : "Waiting" },
  ];
  const captureStatusLabel = CAPTURE_STATUS_LABELS[scannerUi.captureStatus] || "Waiting";
  const majorBlockingCodes = [
    "CAMERA_UNAVAILABLE",
    "GUIDE_UNAVAILABLE",
    "TOO_DARK",
    "TOO_BRIGHT",
    "SUBJECT_CROPPED",
    "CAMERA_MOVING",
    "FRAME_BLURRY",
  ];
  const hasMajorReadinessIssue = majorBlockingCodes.includes(scanReadiness.blockingCode);
  const readinessLabel = guideStateLabel;
  const qualityInstruction =
    scanReadiness.blockingReason ||
    scanReadiness.advisoryReason ||
    placementGuidance;
  const readinessClass = guideLocked
    ? "border-green-200 bg-green-50 text-green-800"
    : hasMajorReadinessIssue
      ? "border-red-200 bg-red-50 text-red-700"
      : scanReadiness.state === "NOT_READY"
        ? "border-gray-200 bg-gray-50 text-gray-700"
        : "border-amber-200 bg-amber-50 text-amber-800";
  const autoCaptureDisplay = !scannerUi.autoCaptureEnabled
    ? scannerUi.autoCaptureStatus === "STOPPED" ? "Auto capture stopped" : "Auto Capture Off"
    : scannerUi.autoCapturePaused
      ? "Auto Capture Paused"
      : scannerUi.autoCaptureStatus === "CAPTURING"
        ? "Capturing scan frame"
        : scannerUi.autoCaptureStatus === "PENDING"
          ? "Auto capture pending"
        : scannerUi.autoCaptureStatus === "REPOSITION"
          ? "Reposition subject"
          : scannerUi.autoCaptureStatus === "COOLDOWN"
            ? "Auto capture paused briefly"
            : guideLocked
              ? "Guide locked"
              : scanReadiness.state === "READY"
                ? "Hold steady"
                : "Waiting for guide lock";
  const guideBorderClass = hasMajorReadinessIssue
    ? "border-red-400"
    : guideLocked
      ? "border-green-400"
      : scanReadiness.state === "READY"
        ? "border-lime-300"
        : scanReadiness.state === "CHECKING"
          ? "border-amber-300"
          : "border-gray-300";
  const guideAccentClass = hasMajorReadinessIssue
    ? "border-red-400"
    : guideLocked
      ? "border-green-300"
      : scanReadiness.state === "READY"
        ? "border-lime-300"
        : scanReadiness.state === "CHECKING"
          ? "border-amber-300"
          : "border-gray-300";
  const guideLineClass = hasMajorReadinessIssue
    ? "bg-red-400"
    : guideLocked
      ? "bg-green-300"
      : scanReadiness.state === "READY"
        ? "bg-lime-300"
        : scanReadiness.state === "CHECKING"
          ? "bg-amber-300"
          : "bg-gray-300";
  const lastCaptureMetadata = captureHistory[captureHistory.length - 1] || null;
  const retakeAllowed = !["attached", "completed", "finalized"].includes(
    String(session?.status || "").toLowerCase()
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg bg-white px-3 py-4 sm:px-5 sm:py-6">
      <header className="mb-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-700 text-lg text-green-700">
          {isImage ? <FaCamera /> : <FaVideo />}
        </div>
        <h1 className="mt-2 text-xl font-extrabold text-black">Live Fruit Scanner</h1>
        <p className="mt-1 text-xs font-semibold text-gray-500">Scan Fruits · Upload · Analyze · Review</p>
        {scannerUi.scannerStatus === "ACTIVE" && (
          <p className="mx-auto mt-2 w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold text-red-700" role="status">
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />
            Live Scanner Active
          </p>
        )}
        {scannerUi.scannerStatus === "ACTIVE" && scannerUi.autoCaptureEnabled && (
          <p className="mx-auto mt-1.5 w-fit rounded-full bg-green-50 px-3 py-1 text-xs font-extrabold text-green-800" role="status">
            Auto Capture {scannerUi.autoCapturePaused ? "Paused" : "On"}
          </p>
        )}
      </header>

      {loading && (
        <div className="rounded-md bg-green-50 px-3 py-3 text-xs font-bold text-green-800">
          Checking scanning session...
        </div>
      )}

      {!loading && session && (
        <section className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs">
          <p className="font-extrabold text-gray-500">Scanning for:</p>
          <p className="mt-0.5 font-extrabold text-gray-900">
            {session.fruitType || session.fruitName || session.fruit || "Select a fruit before scanning."}
          </p>
          {(session.lotNo || session.lotTitle) && (
            <p className="mt-1 font-bold text-gray-600">Fruit Lot: {session.lotNo || session.lotTitle}</p>
          )}
          {isImage && (
            <p className="mt-1 font-bold text-green-800">
              Capture slot {getUploadSlotNumber(session) || 1} · {scannerUi.capturedCount ? "1 Scan Frame Uploaded" : "No Scan Frame Uploaded"}
            </p>
          )}
        </section>
      )}

      {!loading && !isMobile && (
        <div className="mt-3 rounded-md bg-orange-50 px-3 py-3 text-xs font-bold text-orange-800">
          <FaExclamationTriangle className="mb-2" />
          Open this session on a mobile device with a compatible camera.
        </div>
      )}

      {message && (
        <div
          className={`mt-3 rounded-md px-3 py-3 text-xs font-bold ${
            uploaded || isStatusMessage
              ? "bg-green-50 text-green-800"
              : scannerUi.stopped || scannerUi.cancelled
                ? "bg-gray-100 text-gray-700"
                : "bg-red-50 text-red-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {message}
          {uploading && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-green-700 motion-reduce:animate-none" />
            </div>
          )}
        </div>
      )}

      {!loading && isMobile && session && !uploaded && !isImage && (
        <div className="mt-4 rounded-md bg-orange-50 px-3 py-3 text-xs font-bold text-orange-800">
          Live video capture is coming soon. Please capture photos first.
        </div>
      )}

      {!loading && isMobile && session && !uploaded && isImage && !scannerUi.cancelled && (
        <div className="mt-3 space-y-3">
          <section className="rounded-md border border-green-200 bg-white p-3 text-center">
            <p className="text-sm font-extrabold text-gray-950">Place fruits inside the frame</p>
            <p className="mt-1 text-xs font-semibold text-gray-600">Keep all fruits clearly visible</p>
            <p className="mt-1 text-xs font-semibold text-gray-600">Ensure good lighting</p>
          </section>
          <section className="rounded-md border border-green-200 bg-green-50 p-3">
            <label htmlFor="scan-mode" className="text-xs font-extrabold text-green-950">
              Scan mode
            </label>
            <select
              id="scan-mode"
              value={scannerUi.scanMode}
              disabled={cameraStarting || uploading}
              onChange={(event) => {
                lastAutoSignatureRef.current = null;
                if (autoReadyTimerRef.current) window.clearTimeout(autoReadyTimerRef.current);
                if (autoCooldownTimerRef.current) window.clearTimeout(autoCooldownTimerRef.current);
                autoReadyTimerRef.current = null;
                autoCooldownTimerRef.current = null;
                autoFailureCountRef.current = 0;
                guideRoiRef.current = null;
                setGuideAreaStatus("WAITING");
                resetFrameAnalysis();
                updateScannerUi({
                  scanMode: event.target.value,
                  autoCaptureStatus: scannerUi.autoCaptureEnabled ? "WAITING" : "OFF",
                });
              }}
              className="mt-1.5 min-h-11 w-full rounded-md border border-green-300 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-green-700 disabled:bg-gray-100"
            >
              {SCAN_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
            <div className="mt-3 rounded-md border border-green-200 bg-white p-3">
              <label htmlFor="measurement-reference" className="text-xs font-extrabold text-gray-900">
                Measurement Reference
              </label>
              <select
                id="measurement-reference"
                value={scaleCalibration.method}
                disabled={uploading}
                onChange={(event) => changeReferenceMethod(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-xs font-bold text-gray-900 outline-none focus:border-green-700 disabled:bg-gray-100"
              >
                {Object.entries(SCALE_CALIBRATION_METHODS).map(([method, configuration]) => (
                  <option key={method} value={method}>
                    {configuration.label}
                    {configuration.defaultWidthMm ? ` \u2014 ${configuration.defaultWidthMm} mm` : ""}
                  </option>
                ))}
              </select>

              {scaleCalibration.method === "CUSTOM_REFERENCE" && (
                <div className="mt-2">
                  <label htmlFor="custom-reference-width" className="text-[10px] font-extrabold text-gray-600">
                    Reference Width (mm)
                  </label>
                  <input
                    id="custom-reference-width"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="any"
                    value={customReferenceWidth}
                    disabled={uploading}
                    onChange={(event) => changeCustomReferenceWidth(event.target.value)}
                    className="mt-1 min-h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-bold outline-none focus:border-green-700 disabled:bg-gray-100"
                  />
                  {(!Number.isFinite(Number(customReferenceWidth)) || Number(customReferenceWidth) <= 0) && (
                    <p className="mt-1 text-[10px] font-bold text-orange-800">
                      Enter a positive reference width.
                    </p>
                  )}
                </div>
              )}

              <p className="mt-2 text-[10px] font-semibold leading-relaxed text-gray-600">
                Place the known-size reference beside the fruit or tray, fully visible and not severely tilted. Keep the reference and fruit at the same camera distance.
              </p>

              {scaleCalibration.method !== "NONE" && cameraActive && (
                <div className="mt-2 space-y-2">
                  {boundaryCandidates.candidates.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {boundaryCandidates.candidates.slice(0, 6).map((candidate, index) => (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={uploading}
                          onClick={() => selectReferenceCandidate(candidate)}
                          className="min-h-10 rounded-md border border-cyan-300 bg-cyan-50 px-2 py-2 text-[10px] font-extrabold text-cyan-900 disabled:opacity-50"
                        >
                          Candidate {index + 1} \u00b7 Use as Reference
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-semibold text-gray-500">
                      Place the reference inside the guide and wait for a stable candidate region.
                    </p>
                  )}

                  {scaleCalibration.referenceBoundingBox && (
                    <div className="flex gap-2">
                      {scaleCalibration.status === SCALE_CALIBRATION_STATUS.REFERENCE_CANDIDATE && (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={confirmReferenceCandidate}
                          className="min-h-10 flex-1 rounded-md bg-cyan-700 px-3 py-2 text-[10px] font-extrabold text-white disabled:opacity-50"
                        >
                          Confirm Reference
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={resetScaleCalibration}
                        className="min-h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-[10px] font-extrabold text-gray-700 disabled:opacity-50"
                      >
                        Clear Reference
                      </button>
                    </div>
                  )}
                </div>
              )}

              {scaleCalibration.failureReason && (
                <p className="mt-2 text-[10px] font-bold text-orange-800">
                  {scaleCalibration.failureReason}
                </p>
              )}
              {scaleCalibration.status !== SCALE_CALIBRATION_STATUS.READY && (
                <p className="mt-2 text-[10px] font-semibold text-gray-500">
                  Physical size measurement unavailable without reference calibration.
                </p>
              )}
            </div>
            {!cameraActive && (
              <div className="mt-3 space-y-1 text-xs font-semibold leading-relaxed text-gray-700">
                <p>Camera access is required to start the scanner.</p>
                <p>Captured scan images may be uploaded and attached to the Fruit Lot.</p>
                <p>Future inspection processing may use this scan data.</p>
                {AUTO_CAPTURE_AVAILABLE && (
                  <p className="font-extrabold text-orange-800">Auto Capture remains Off until you start the scanner and enable it visibly.</p>
                )}
              </div>
            )}
            {AUTO_CAPTURE_AVAILABLE && (
              <div className="mt-3 rounded-md border border-green-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-gray-900">Auto Capture</p>
                  <p className="mt-0.5 text-[10px] font-bold text-gray-500">{autoCaptureDisplay}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleAutoCapture}
                  disabled={!cameraActive || uploading}
                  aria-pressed={scannerUi.autoCaptureEnabled}
                  className={`min-h-10 min-w-20 rounded-full px-4 py-2 text-xs font-extrabold disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 ${
                    scannerUi.autoCaptureEnabled
                      ? "bg-green-700 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {scannerUi.autoCaptureEnabled ? "On" : "Off"}
                </button>
              </div>
              {scannerUi.autoCaptureEnabled && (
                <button
                  type="button"
                  onClick={toggleAutoCapturePause}
                  disabled={uploading}
                  className="mt-2 min-h-10 w-full rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-extrabold text-orange-800 disabled:opacity-50"
                >
                  {scannerUi.autoCapturePaused ? "Resume Auto Capture" : "Pause Auto Capture"}
                </button>
              )}
              </div>
            )}
          </section>

          {!cameraActive ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={openCamera}
                disabled={cameraStarting || uploading}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-md border border-dashed border-green-500 bg-green-50 px-4 py-4 text-sm font-extrabold text-green-800 disabled:cursor-wait disabled:border-orange-300 disabled:bg-orange-50 disabled:text-orange-700"
              >
                {cameraStarting ? <FaSpinner className="animate-spin motion-reduce:animate-none" /> : <FaCamera />}
                <span>
                  {cameraStarting
                    ? "Starting scanner..."
                    : scannerUi.stopped
                      ? "Resume Live Fruit Scanner"
                      : "Start Live Fruit Scanner"}
                </span>
              </button>
              <button
                type="button"
                onClick={cancelScanner}
                className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-extrabold text-gray-700"
              >
                Cancel Session
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div ref={previewRef} className="relative mx-auto aspect-[3/4] max-h-[62vh] w-full overflow-hidden rounded-lg bg-black sm:aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {captureFlash && (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 animate-pulse bg-white/70 motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`pointer-events-none absolute border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.38)] ${guideBorderClass}`}
                  style={guideStyle}
                  aria-hidden="true"
                >
                  <div className={`absolute inset-0 animate-pulse rounded-[inherit] border motion-reduce:animate-none ${guideAccentClass}`} />
                  <div className={`absolute left-[8%] right-[8%] top-1/2 h-0.5 animate-pulse opacity-80 motion-reduce:animate-none ${guideLineClass}`} />
                  {scaleCalibration.referenceBoundingBox && (
                    <div
                      className="absolute border-2 border-cyan-300/90 bg-cyan-300/5"
                      style={{
                        left: `${scaleCalibration.referenceBoundingBox.xRatio * 100}%`,
                        top: `${scaleCalibration.referenceBoundingBox.yRatio * 100}%`,
                        width: `${scaleCalibration.referenceBoundingBox.widthRatio * 100}%`,
                        height: `${scaleCalibration.referenceBoundingBox.heightRatio * 100}%`,
                      }}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-cyan-950/80 px-1.5 py-0.5 text-[9px] font-extrabold text-cyan-100">
                        Reference
                      </span>
                    </div>
                  )}
                  {selectedGuide.shape !== "circle" && (
                    <>
                      <span className={`absolute -left-0.5 -top-0.5 h-5 w-5 border-l-4 border-t-4 ${guideAccentClass}`} />
                      <span className={`absolute -right-0.5 -top-0.5 h-5 w-5 border-r-4 border-t-4 ${guideAccentClass}`} />
                      <span className={`absolute -bottom-0.5 -left-0.5 h-5 w-5 border-b-4 border-l-4 ${guideAccentClass}`} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 border-b-4 border-r-4 ${guideAccentClass}`} />
                    </>
                  )}
                </div>
                {guideAreaStatus === "READY" && (
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-extrabold text-green-200">
                    {guideStateLabel}
                  </div>
                )}
                {subjectPlacement.analysisAvailable && positioningBlockers.includes(scanReadiness.blockingCode) && (
                  <div className="pointer-events-none absolute right-3 top-3 max-w-[65%] rounded-md bg-black/65 px-2.5 py-1 text-right text-[10px] font-extrabold text-white">
                    {placementGuidance}
                  </div>
                )}
                {scanReadiness.state === "READY" && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-14 rounded-md bg-black/65 px-2.5 py-2 text-[10px] font-extrabold text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span>Hold steady…</span>
                      <span>{Math.round(scanReadiness.lockProgress * 100)}%</span>
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25"
                      role="progressbar"
                      aria-label="Guide lock progress"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={Math.round(scanReadiness.lockProgress * 100)}
                    >
                      <div
                        className="h-full rounded-full bg-lime-300 motion-reduce:transition-none"
                        style={{ width: `${scanReadiness.lockProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-3 bottom-3 rounded-md bg-black/65 px-3 py-2 text-center text-xs font-extrabold text-white">
                  {selectedGuide.helperText}
                </div>
              </div>

              <button
                type="button"
                onClick={captureFruitPhoto}
                disabled={uploading}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-green-700 px-4 py-4 text-sm font-extrabold text-white disabled:cursor-wait disabled:bg-gray-300"
              >
                {uploading ? <FaSpinner className="animate-spin motion-reduce:animate-none" /> : <FaCamera />}
                <span>{uploading ? captureStatusLabel : "Capture Scan Frame"}</span>
              </button>
              {!uploading && (
                <p className={`rounded-md border px-3 py-2 text-center text-xs font-extrabold ${readinessClass}`} role="status">
                  {guideLocked
                    ? "Frame Ready · Manual capture is available"
                    : `${qualityInstruction}. Manual capture remains available.`}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={stopScanner}
                  disabled={uploading}
                  className="min-h-11 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-extrabold text-orange-800 disabled:opacity-50"
                >
                  Stop Scanner
                </button>
                <button
                  type="button"
                  onClick={cancelScanner}
                  disabled={uploading}
                  className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 disabled:opacity-50"
                >
                  Cancel Session
                </button>
              </div>
            </div>
          )}

          <section className="rounded-md border border-gray-200 bg-white p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-gray-900">Scanner status</h2>
              <span className="text-[10px] font-bold text-gray-500">Capture: {captureStatusLabel}</span>
            </div>
            <div className={`mt-2 rounded-md border px-3 py-2 ${readinessClass}`}>
              <p className="text-xs font-extrabold">{readinessLabel}</p>
              <p className="mt-0.5 text-[10px] font-bold">{qualityInstruction}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {scannerChecks.map((check) => (
                <div key={check.label} className="rounded-md bg-gray-50 px-2 py-2">
                  <p className="text-[10px] font-extrabold text-gray-500">{check.label}</p>
                  <p className={`mt-0.5 text-[10px] font-extrabold ${["Ready", "Locked", "Alignment Acceptable", "Candidate found", "Multiple candidates"].includes(check.value) ? "text-green-700" : "text-gray-700"}`}>
                    {check.value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-gray-500">
              Guide lock confirms frame quality and positioning only. Alignment is estimated from guide coverage and visual contrast.
            </p>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">
              {boundaryCandidates.status === "UNAVAILABLE"
                ? "Boundary estimation is unavailable. You can continue with manual capture."
                : "Possible boundaries are estimated from image contrast and shape."}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">
              {fruitCountEstimate.status === "NOT_AVAILABLE"
                ? "Individual count is unavailable in Package View."
                : fruitCountEstimate.status === "UNAVAILABLE"
                  ? "Count estimation is unavailable. You can continue scanning manually."
                  : fruitCountEstimate.partialCandidateCount > 0
                    ? "Keep all fruits fully inside the guide for a better count."
                    : "Provisional region estimate from contrast and shape; it is not a fruit-object detection result."}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">
              Calibrated visual estimate; not a certified physical measurement.
            </p>
            {candidateMeasurements.status !== "READY" && (
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                {candidateMeasurements.status === "PACKAGE_UNAVAILABLE"
                  ? "Individual diameter is unavailable in Package View."
                  : candidateMeasurements.status === "UNAVAILABLE"
                    ? "Diameter estimation is unavailable. Scanning can continue."
                    : scaleCalibration.status !== SCALE_CALIBRATION_STATUS.READY
                      ? "Calibrate a known-size reference to estimate fruit diameter."
                      : "No stable, non-partial candidate is currently measurable."}
              </p>
            )}
            {measurementTiltWarning && (
              <p className="mt-1 text-[10px] font-semibold text-orange-800">
                Fruit or reference may be tilted. Keep both parallel to the camera.
              </p>
            )}
            {candidateMeasurements.multipleCandidatesAdvisory && (
              <p className="mt-1 text-[10px] font-semibold text-orange-800">
                Use Single Fruit mode with one fruit for a clearer measurement.
              </p>
            )}
            {scannerUi.scanMode === "TRAY_PACKED" && candidateMeasurements.measuredCandidateCount > 0 && (
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                Measured {candidateMeasurements.measuredCandidateCount} clear candidates
                {Number.isFinite(fruitCountEstimate.estimatedCount)
                  ? ` from a provisional estimate of ${fruitCountEstimate.estimatedCount}`
                  : ""}.
              </p>
            )}
            {lastCaptureMetadata && (
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                Last trigger: {lastCaptureMetadata.source} · {lastCaptureMetadata.uploadStatus.replace(/_/g, " ")}
              </p>
            )}
          </section>
        </div>
      )}

      {scannerUi.cancelled && !uploaded && (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm font-extrabold text-gray-700">
          Scanning session cancelled locally. No deletion was requested.
        </div>
      )}

      {uploaded && (
        <div className="mt-4 flex min-h-12 flex-wrap items-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white" role="status">
          {retakeAllowed && (
            <button
              type="button"
              onClick={retakeScanFrame}
              className="order-last ml-auto rounded-md border border-white/70 bg-white px-3 py-2 text-xs font-extrabold text-green-800"
            >
              Retake Scan Frame
            </button>
          )}
          <FaCheckCircle />
          <div className="min-w-28 text-center leading-tight">
            <p>Uploaded</p>
            <p aria-hidden="true">↓</p>
            <p className="text-xs">Waiting for Inspection</p>
          </div>
          <span>{uploadProgressLabel} · 1 Scan Frame Uploaded</span>
        </div>
      )}
      {uploaded && (
        <FruitScanReview
          session={session}
          accepted={scanAccepted}
          retakeAllowed={retakeAllowed}
          onRetake={retakeScanFrame}
          onAccept={() => {
            setScanAccepted(true);
            setMessage("Scan accepted for this Fruit Lot. Return to the listing form to continue.");
          }}
          onContinue={() => {
            window.close();
            window.setTimeout(() => window.history.back(), 150);
          }}
        />
      )}
    </div>
  );
}

function FruitScanReview({ session, accepted, retakeAllowed, onRetake, onAccept, onContinue }) {
  const analysis = session?.scanRecord?.analysis || {};
  const status = String(analysis.status || "UPLOADED").toUpperCase();
  const detections = (analysis.detections || []).filter(
    (item) => item.category === "FRUIT" && !item.obstruction && item.boundingBox
  );
  const obstructionDetected = (analysis.detections || []).some(
    (item) => item.category === "OBSTRUCTION" || item.obstruction
  );
  const providerUnavailable = (analysis.warningCodes || []).includes("ANALYSIS_PROVIDER_NOT_CONFIGURED");
  const processing = ["PENDING", "PROCESSING", "UPLOADED"].includes(status);

  return (
    <section className="mt-3 space-y-3 rounded-md border border-green-200 bg-white p-3" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-gray-950">Review Fruit Scan</h2>
          <p className="mt-1 text-[11px] font-semibold text-gray-600">1 of 1 scan frames uploaded</p>
        </div>
        <span className={`rounded px-2 py-1 text-[9px] font-extrabold ${status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
          {getFruitScanStatusCopy(status)}
        </span>
      </div>

      {processing && (
        <div className="rounded-md bg-green-50 p-3 text-xs font-bold text-green-800">
          <div className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Analyzing fruits...</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-green-700" />
          </div>
          <p className="mt-2 text-[10px] font-semibold">No percentage is shown while exact provider progress is unavailable.</p>
        </div>
      )}

      {analysis.imageUrl && (
        <div className="relative mx-auto inline-flex max-w-full overflow-hidden rounded-md bg-black">
          <img src={analysis.imageUrl} alt="Captured fruit scan" className="max-h-96 max-w-full object-contain" />
          {detections.map((item, index) => {
            const style = getNormalizedDetectionBoxStyle(item.boundingBox);
            if (!style) return null;
            return (
              <span key={`${item.label}-${index}`} className="absolute border-2 border-green-400" style={style}>
                <span className="absolute -top-5 left-0 whitespace-nowrap bg-green-800 px-1 text-[8px] font-bold text-white">
                  {item.label || "Fruit"}{item.confidence != null ? ` ${Math.round(item.confidence * 100)}%` : ""}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {obstructionDetected && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700">
          Hand/object is obstructing the fruit. Please retake this image.
        </p>
      )}
      {providerUnavailable && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-900">
          Fruit analysis provider is not configured. Analysis requires review; no measurements were fabricated.
        </p>
      )}
      {status === "FAILED" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700">
          Analysis failed. You can safely retry or return to the lot form and continue under review.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {retakeAllowed && (
          <button type="button" onClick={onRetake} className="min-h-11 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-900">Retake Image</button>
        )}
        <button type="button" onClick={onAccept} disabled={processing || obstructionDetected} className="min-h-11 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs font-extrabold text-green-800 disabled:bg-gray-100 disabled:text-gray-400">
          {accepted ? "Scan Accepted" : "Accept Scan"}
        </button>
        <button type="button" onClick={onContinue} className="min-h-11 rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white">Continue Lot Listing</button>
      </div>
    </section>
  );
}

function getUploadSlotNumber(session = {}) {
  const slot = Number(session?.slotIndex);
  return Number.isInteger(slot) && slot >= 0 ? slot + 1 : null;
}

function getUploadProgressLabel(session = {}) {
  const slotNumber = getUploadSlotNumber(session);
  return slotNumber ? `${slotNumber}/5 Uploaded` : "Upload complete";
}
