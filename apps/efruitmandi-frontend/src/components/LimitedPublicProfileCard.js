import { FaCalendarAlt, FaHandshake, FaMapMarkerAlt, FaSeedling, FaShieldAlt } from "react-icons/fa";
import { getSafePublicProfile } from "../utils/marketplaceVisibility";

export default function LimitedPublicProfileCard({
  profile,
  title = "Public Profile",
  emptyName = "Marketplace Profile",
  trustedLabel = "Trusted",
  resolveImageUrl,
}) {
  const safeProfile = getSafePublicProfile(profile);
  const displayName = safeProfile.companyName || safeProfile.name || emptyName;
  const logoUrl = safeProfile.logoUrl && resolveImageUrl
    ? resolveImageUrl(safeProfile.logoUrl)
    : safeProfile.logoUrl;
  const hasProfile = Boolean(
    displayName ||
      logoUrl ||
      safeProfile.mainLocation ||
      safeProfile.isKycVerified ||
      safeProfile.isOgVerified ||
      safeProfile.memberSince ||
      safeProfile.totalLots !== undefined ||
      safeProfile.totalDeals !== undefined
  );

  if (!hasProfile) return null;

  return (
    <section className="rounded-md border border-green-100 bg-green-50 p-3">
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-green-800">
        {title}
      </p>
      <div className="flex min-w-0 items-start gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${displayName} logo`}
            width="48"
            height="48"
            className="h-12 w-12 shrink-0 rounded-md bg-white object-cover ring-1 ring-green-100"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-lg font-black text-green-700 ring-1 ring-green-100">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-gray-950">
            {displayName}
          </h2>
          {safeProfile.name && safeProfile.name !== displayName && (
            <p className="truncate text-[11px] font-bold text-gray-600">
              {safeProfile.name}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {safeProfile.isKycVerified && (
              <ProfileBadge icon={<FaShieldAlt />} label="KYC Verified" />
            )}
            {safeProfile.isOgVerified && (
              <ProfileBadge icon={<FaShieldAlt />} label="OG Verified" />
            )}
            {safeProfile.isTrusted && !safeProfile.isOgVerified && (
              <ProfileBadge icon={<FaHandshake />} label={trustedLabel} />
            )}
          </div>

          <div className="mt-2 space-y-1 text-[11px] font-bold text-gray-600">
            {safeProfile.mainLocation && (
              <ProfileLine icon={<FaMapMarkerAlt />} text={safeProfile.mainLocation} />
            )}
            {safeProfile.memberSince && (
              <ProfileLine icon={<FaCalendarAlt />} text={`Member since ${formatMemberSince(safeProfile.memberSince)}`} />
            )}
            {safeProfile.totalLots !== undefined && (
              <ProfileLine icon={<FaSeedling />} text={`${safeProfile.totalLots} listed lots`} />
            )}
            {safeProfile.totalDeals !== undefined && (
              <ProfileLine icon={<FaHandshake />} text={`${safeProfile.totalDeals} deals / quotes`} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileBadge({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-extrabold text-green-800 ring-1 ring-green-100">
      {icon}
      {label}
    </span>
  );
}

function ProfileLine({ icon, text }) {
  return (
    <p className="flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-green-700">{icon}</span>
      <span className="truncate">{text}</span>
    </p>
  );
}

function formatMemberSince(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}
