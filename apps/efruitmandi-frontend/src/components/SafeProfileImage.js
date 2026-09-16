import { useState } from "react";
import { FILE_BASE_URL } from "../services/api";
import { DEFAULT_PROFILE_MEDIA, normalizeProfileRole, resolveProfileMediaUrl } from "../utils/profileMedia";

export default function SafeProfileImage({ src, role, kind = "logo", baseUrl = FILE_BASE_URL, ...props }) {
  const profileRole = normalizeProfileRole(role);
  const mediaKind = kind === "banner" ? "banner" : "logo";
  const fallback = DEFAULT_PROFILE_MEDIA[profileRole][mediaKind];
  const uploaded = resolveProfileMediaUrl(src, baseUrl);

  // A later upload or role change must retry the new image, even if the old
  // source failed. Keeping this state keyed also avoids a stale fallback frame.
  return <ProfileImage key={`${uploaded}|${fallback}`} {...props} uploaded={uploaded} fallback={fallback} role={profileRole} kind={mediaKind} />;
}

function ProfileImage({ uploaded, fallback, role, kind, businessName = "Marketplace", alt, className = "", imageClassName = "", loading = "lazy", width, height, srcSet, sizes, style }) {
  const [uploadFailed, setUploadFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const isDefault = !uploaded || uploadFailed || uploaded === fallback;
  const isBanner = kind === "banner";
  const description = alt || `${businessName || "Marketplace"} ${role} profile ${kind}`;

  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${isBanner ? "bg-green-900" : "rounded-full bg-white"} ${className}`}
      style={{ aspectRatio: isBanner ? "16 / 5" : "1 / 1", ...style }}
      data-profile-media={kind}
      data-profile-role={role}
      data-default-media={isDefault ? "true" : "false"}
    >
      {fallbackFailed ? (
        <span role="img" aria-label={description} className="absolute inset-0 flex items-center justify-center bg-green-100 text-green-800">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {role === "buyer" ? <path d="M8 21 24 10l16 11v19H8V21Zm9 19V26h14v14M8 21h32" /> : <path d="M24 40V23m0 8C10 31 8 23 8 14c11 0 16 5 16 17Zm0-7C24 14 30 8 40 8c0 10-5 16-16 16ZM14 40h20" />}
          </svg>
        </span>
      ) : (
        <img
          src={isDefault ? fallback : uploaded}
          srcSet={isDefault ? undefined : srcSet}
          sizes={isDefault ? undefined : sizes}
          alt={description}
          width={width || (isBanner ? 1600 : 96)}
          height={height || (isBanner ? 500 : 96)}
          loading={loading}
          decoding="async"
          className={`absolute inset-0 h-full w-full ${isBanner ? "object-cover" : "object-contain"} ${imageClassName}`}
          onError={() => {
            if (isDefault) setFallbackFailed(true);
            else setUploadFailed(true);
          }}
        />
      )}
      {isBanner && isDefault && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-green-950/55 via-green-950/20 to-green-950/10" />}
    </span>
  );
}
