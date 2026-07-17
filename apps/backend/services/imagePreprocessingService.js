import sharp from "sharp";

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1920;
const DEFAULT_JPEG_QUALITY = 88;

const MIN_DIMENSION = 320;
const MAX_DIMENSION = 4096;
const MIN_JPEG_QUALITY = 60;
const MAX_JPEG_QUALITY = 95;

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
};

const normalizeOptions = (options = {}) => ({
  maxWidth: clampInteger(
    options.maxWidth,
    DEFAULT_MAX_WIDTH,
    MIN_DIMENSION,
    MAX_DIMENSION
  ),
  maxHeight: clampInteger(
    options.maxHeight,
    DEFAULT_MAX_HEIGHT,
    MIN_DIMENSION,
    MAX_DIMENSION
  ),
  quality: clampInteger(
    options.quality,
    DEFAULT_JPEG_QUALITY,
    MIN_JPEG_QUALITY,
    MAX_JPEG_QUALITY
  ),
});

const validateInput = (input) => {
  const isBuffer = Buffer.isBuffer(input);
  const isFilePath = typeof input === "string" && input.trim().length > 0;

  if (!isBuffer && !isFilePath) {
    const error = new Error("A valid image buffer or file path is required");
    error.statusCode = 400;
    throw error;
  }

  if (isBuffer && input.length === 0) {
    const error = new Error("Image buffer is empty");
    error.statusCode = 400;
    throw error;
  }

  return isBuffer ? input : input.trim();
};

const sanitizeMetadata = (metadata = {}, byteSize = null) => ({
  format: metadata.format || null,
  width: Number(metadata.width) || null,
  height: Number(metadata.height) || null,
  orientation: Number(metadata.orientation) || null,
  space: metadata.space || null,
  channels: Number(metadata.channels) || null,
  byteSize: Number(byteSize) || null,
});

export const preprocessFruitImage = async (input, options = {}) => {
  const validatedInput = validateInput(input);
  const { maxWidth, maxHeight, quality } = normalizeOptions(options);

  try {
    const source = sharp(validatedInput, {
      failOn: "error",
      limitInputPixels: 80_000_000,
      sequentialRead: true,
    });

    const originalMetadata = await source.metadata();

    if (!originalMetadata.format) {
      const error = new Error("Unsupported or invalid image format");
      error.statusCode = 400;
      throw error;
    }

    if (!originalMetadata.width || !originalMetadata.height) {
      const error = new Error("Image dimensions could not be determined");
      error.statusCode = 400;
      throw error;
    }

    const originalByteSize = Buffer.isBuffer(validatedInput)
      ? validatedInput.length
      : null;

    const processedBuffer = await sharp(validatedInput, {
      failOn: "error",
      limitInputPixels: 80_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColourspace("srgb")
      .normalise({
        lower: 1,
        upper: 99,
      })
      .sharpen({
        sigma: 0.5,
        m1: 0.4,
        m2: 0.2,
      })
      .jpeg({
        quality,
        chromaSubsampling: "4:4:4",
        mozjpeg: true,
      })
      .toBuffer();

    const processedMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      contentType: "image/jpeg",
      extension: "jpg",
      byteSize: processedBuffer.length,
      original: sanitizeMetadata(originalMetadata, originalByteSize),
      processed: {
        ...sanitizeMetadata(processedMetadata, processedBuffer.length),
        maxWidth,
        maxHeight,
        quality,
      },
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    const preprocessingError = new Error(
      "Image preprocessing failed because the uploaded image is invalid or unsupported"
    );
    preprocessingError.statusCode = 400;
    throw preprocessingError;
  }
};
