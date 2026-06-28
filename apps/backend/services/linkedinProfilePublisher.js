import axios from "axios";

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const cleanText = (value = "", maxLength = 500) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const isEnabled = (value) => String(value || "").trim().toLowerCase() === "true";

const currentLinkedInVersion = () => {
  const date = new Date();
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const normalizeOrganizationUrn = (value = "") => {
  const organization = cleanText(value, 120);
  if (/^urn:li:organization:\d+$/.test(organization)) return organization;
  if (/^\d+$/.test(organization)) return `urn:li:organization:${organization}`;
  return "";
};

export const getLinkedInPublisherConfig = () => ({
  enabled: isEnabled(process.env.LINKEDIN_PROFILE_PUBLISHING_ENABLED),
  accessToken: cleanText(process.env.LINKEDIN_ACCESS_TOKEN, 4000),
  organizationUrn: normalizeOrganizationUrn(process.env.LINKEDIN_ORGANIZATION_ID),
  apiVersion: cleanText(process.env.LINKEDIN_API_VERSION, 6) || currentLinkedInVersion(),
});

const getLinkedInHeaders = (config, contentType = "application/json") => ({
  Authorization: `Bearer ${config.accessToken}`,
  "Linkedin-Version": config.apiVersion,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": contentType,
});

const getAllowedImageHosts = () => {
  const configured = String(process.env.PROFILE_PUBLISH_IMAGE_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([
    "res.cloudinary.com",
    "efruitmandi.live",
    "www.efruitmandi.live",
    "api.efruitmandi.live",
    ...configured,
  ]);
};

export const isAllowedPublishingImageUrl = (value = "") => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      getAllowedImageHosts().has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const fetchImage = async (imageUrl, redirectCount = 0) => {
  if (!isAllowedPublishingImageUrl(imageUrl)) {
    const error = new Error("Profile image host is not allowed for publishing");
    error.publisherStage = "image_download";
    throw error;
  }

  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 15000,
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    maxRedirects: 0,
    validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
  });

  if (response.status >= 300) {
    if (redirectCount >= 3 || !response.headers.location) {
      const error = new Error("Profile image redirected too many times");
      error.publisherStage = "image_download";
      throw error;
    }
    const redirectedUrl = new URL(response.headers.location, imageUrl).toString();
    return fetchImage(redirectedUrl, redirectCount + 1);
  }

  const contentType = cleanText(response.headers["content-type"], 100).toLowerCase();
  if (!contentType.startsWith("image/")) {
    const error = new Error("Profile image URL did not return an image");
    error.publisherStage = "image_download";
    throw error;
  }

  const data = Buffer.from(response.data);
  if (!data.length || data.length > MAX_IMAGE_BYTES) {
    const error = new Error("Profile image is empty or too large");
    error.publisherStage = "image_download";
    throw error;
  }

  return { data, contentType: contentType.split(";")[0] };
};

export const buildLinkedInPostPayload = ({ organizationUrn, snapshot, imageUrn }) => ({
  author: organizationUrn,
  commentary: snapshot.description,
  visibility: "PUBLIC",
  distribution: {
    feedDistribution: "MAIN_FEED",
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  },
  content: {
    media: {
      title: snapshot.title,
      id: imageUrn,
    },
  },
  lifecycleState: "PUBLISHED",
  isReshareDisabledByAuthor: false,
});

const initializeImageUpload = async (config) => {
  try {
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/images?action=initializeUpload`,
      {
        initializeUploadRequest: {
          owner: config.organizationUrn,
        },
      },
      {
        headers: getLinkedInHeaders(config),
        timeout: 15000,
      }
    );

    const uploadUrl = response.data?.value?.uploadUrl;
    const imageUrn = response.data?.value?.image;
    if (!uploadUrl || !imageUrn) {
      throw new Error("LinkedIn did not return image upload details");
    }
    return { uploadUrl, imageUrn };
  } catch (error) {
    error.publisherStage = "image_initialize";
    throw error;
  }
};

const uploadImage = async (config, uploadUrl, image) => {
  try {
    await axios.put(uploadUrl, image.data, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": image.contentType,
      },
      maxBodyLength: MAX_IMAGE_BYTES,
      timeout: 30000,
    });
  } catch (error) {
    error.publisherStage = "image_upload";
    throw error;
  }
};

const createLinkedInPost = async (config, snapshot, imageUrn) => {
  try {
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/posts`,
      buildLinkedInPostPayload({
        organizationUrn: config.organizationUrn,
        snapshot,
        imageUrn,
      }),
      {
        headers: getLinkedInHeaders(config),
        timeout: 20000,
      }
    );
    const postUrn = cleanText(response.headers["x-restli-id"], 240);
    if (!postUrn) {
      const error = new Error("LinkedIn created the post but did not return its identifier");
      error.publisherStage = "post_create_ambiguous";
      throw error;
    }
    return postUrn;
  } catch (error) {
    if (!error.publisherStage) error.publisherStage = "post_create";
    throw error;
  }
};

export const publishProfileToLinkedIn = async (snapshot) => {
  const config = getLinkedInPublisherConfig();
  if (!config.enabled) {
    const error = new Error("LinkedIn profile publishing is disabled");
    error.publisherStage = "configuration";
    throw error;
  }
  if (!config.accessToken || !config.organizationUrn) {
    const error = new Error("LinkedIn access token or organization ID is not configured");
    error.publisherStage = "configuration";
    throw error;
  }
  if (!/^\d{6}$/.test(config.apiVersion)) {
    const error = new Error("LinkedIn API version must use YYYYMM format");
    error.publisherStage = "configuration";
    throw error;
  }

  const defaultBrandImage =
    process.env.EFRUITMANDI_DEFAULT_BRAND_IMAGE_URL ||
    "https://www.efruitmandi.live/logo-original.png";
  const preferredImageUrl = isAllowedPublishingImageUrl(snapshot.logoUrl)
    ? snapshot.logoUrl
    : defaultBrandImage;
  let image;
  try {
    image = await fetchImage(preferredImageUrl);
  } catch (error) {
    if (preferredImageUrl === defaultBrandImage) throw error;
    image = await fetchImage(defaultBrandImage);
  }
  const { uploadUrl, imageUrn } = await initializeImageUpload(config);
  await uploadImage(config, uploadUrl, image);
  const postUrn = await createLinkedInPost(config, snapshot, imageUrn);

  return { postUrn, imageUrn };
};

export const getSafeLinkedInError = (error) => {
  const status = Number(error?.response?.status) || 0;
  const apiMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error_description ||
    error?.message ||
    "LinkedIn publishing failed";
  return {
    stage: cleanText(error?.publisherStage || "unknown", 80),
    status,
    message: cleanText(apiMessage, 500),
  };
};
