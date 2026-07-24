import { useRef, useState } from "react";
import { FaShareAlt } from "react-icons/fa";

const SITE_URL = "https://www.efruitmandi.live";
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeProfileType = (profileType) =>
  profileType === "grower" ? "grower" : "buyer";

export const buildPublicProfileShareUrl = ({
  profileType,
  slug = "",
  canonicalUrl = "",
}) => {
  const normalizedType = normalizeProfileType(profileType);
  const normalizedSlug = String(slug || "").trim().toLowerCase();

  if (PUBLIC_SLUG_PATTERN.test(normalizedSlug)) {
    return `${SITE_URL}/${normalizedType === "grower" ? "growers" : "buyers"}/${normalizedSlug}`;
  }

  try {
    const candidate = new URL(canonicalUrl, SITE_URL);
    const pathname = candidate.pathname.replace(/\/+$/, "") || "/";
    if (
      /^\/(?:growers|buyers)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname) ||
      /^\/profiles\/[^/]+\/[^/]+$/.test(pathname)
    ) {
      return `${SITE_URL}${pathname}`;
    }
  } catch {
    // The directory fallback below remains public and contains no route data.
  }

  return `${SITE_URL}/${normalizedType === "grower" ? "growers" : "buyers"}`;
};

const copyWithTextarea = (value) => {
  const textarea = document.createElement("textarea");
  const previouslyFocused = document.activeElement;
  textarea.value = value;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previouslyFocused?.focus?.();
  }
};

const copyProfileUrl = async (url) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Fall through to the temporary textarea copy method.
  }

  return copyWithTextarea(url);
};

const trackProfileShare = (profileType, shareMethod) => {
  import("../services/analytics")
    .then(({ trackUserAction }) => {
      trackUserAction("profile_share", {
        profile_type: profileType,
        share_method: shareMethod,
      });
    })
    .catch(() => undefined);
};

export default function ProfileShareButton({
  profileType,
  profileName,
  slug = "",
  canonicalUrl = "",
}) {
  const sharingRef = useRef(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState(null);
  const normalizedType = normalizeProfileType(profileType);
  const safeName = String(profileName || "").trim() || "eFruitMandi profile";
  const shareUrl = buildPublicProfileShareUrl({
    profileType: normalizedType,
    slug,
    canonicalUrl,
  });
  const shareData = {
    title: `${safeName} on eFruitMandi`,
    text:
      normalizedType === "grower"
        ? `View ${safeName}'s grower profile on eFruitMandi.`
        : `View ${safeName}'s buyer profile on eFruitMandi.`,
    url: shareUrl,
  };

  const handleShare = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setStatus(null);

    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share(shareData);
          trackProfileShare(normalizedType, "native");
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }

      const copied = await copyProfileUrl(shareUrl);
      if (copied) {
        setStatus({ type: "success", text: "Profile link copied" });
        trackProfileShare(normalizedType, "copy");
      } else {
        setStatus({ type: "error", text: "Profile link could not be copied" });
      }
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        aria-label={`Share ${safeName} profile`}
        className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-bold text-green-800 shadow-sm transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        <FaShareAlt aria-hidden="true" />
        Share Profile
      </button>
      {status && (
        <p
          role={status.type === "error" ? "alert" : "status"}
          className={`text-xs font-semibold ${
            status.type === "error" ? "text-red-700" : "text-green-700"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
