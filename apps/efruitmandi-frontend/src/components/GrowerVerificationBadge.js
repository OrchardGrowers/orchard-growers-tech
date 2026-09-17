const LEVELS = Object.freeze({
  REGISTERED: {
    title: "REGISTERED GROWER",
    subtitle: "PART OF OUR GROWER COMMUNITY",
  },
  VERIFIED: {
    title: "VERIFIED GROWER",
    subtitle: "TRUSTED • AUTHENTIC • KYC APPROVED",
  },
  OG_VERIFIED: {
    title: "OG VERIFIED GROWER",
    subtitle: "PREMIUM • VERIFIED • TRUSTED PARTNER",
  },
});

export const normalizeGrowerVerificationLevel = (value) => {
  const level = typeof value === "string" ? value : "";
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : "";
};

export default function GrowerVerificationBadge({ level, size = "compact", className = "" }) {
  return <BusinessVerificationBadge level={level} size={size} className={className} role="grower" />;
}

// Share the existing badge artwork without changing Grower copy or styling.
export function BusinessVerificationBadge({ level, role, size = "compact", className = "" }) {
  const normalizedLevel = normalizeGrowerVerificationLevel(level);
  if (!normalizedLevel) return null;

  const isBuyer = role === "buyer";
  const growerCopy = LEVELS[normalizedLevel];
  const copy = isBuyer ? {
    title: growerCopy.title.replace("GROWER", "BUYER"),
    subtitle: growerCopy.subtitle.replace("GROWER", "BUYER"),
  } : growerCopy;
  return (
    <div
      className={`grower-verification-badge grower-verification-badge--${normalizedLevel.toLowerCase()} grower-verification-badge--${size} ${isBuyer ? "buyer-verification-badge " : ""}${className}`.trim()}
      data-grower-verification-level={isBuyer ? undefined : normalizedLevel}
      data-buyer-verification-level={isBuyer ? normalizedLevel : undefined}
      aria-label={copy.title}
    >
      <span className="grower-verification-badge__emblem" aria-hidden="true">
        <BadgeIcon level={normalizedLevel} role={role} />
      </span>
      <span className="grower-verification-badge__copy">
        <span className="grower-verification-badge__eyebrow">EFRUITMANDI.LIVE</span>
        <strong className="grower-verification-badge__title">{copy.title}</strong>
        <span className="grower-verification-badge__subtitle">{copy.subtitle}</span>
      </span>
      {normalizedLevel === "OG_VERIFIED" && (
        <span className="grower-verification-badge__promise" aria-hidden="true">
          {isBuyer ? "TRUSTED BUYERS" : "STRONGER FARMERS"}<br />BRIGHTER FUTURE
        </span>
      )}
    </div>
  );
}

function BadgeIcon({ level, role }) {
  if (level === "REGISTERED") {
    if (role === "buyer") {
      return (
        <svg viewBox="0 0 64 64" role="presentation">
          <path className="badge-icon-stem" d="M14 28 32 14l18 14v22H14V28Zm11 22V34h14v16M14 28h36" />
          <path className="badge-icon-ground" d="M10 51h44" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 64 64" role="presentation">
        <path className="badge-icon-ground" d="M15 46c9-5 25-5 34 0" />
        <path className="badge-icon-stem" d="M32 47V25" />
        <path className="badge-icon-leaf" d="M31 31C20 31 15 24 16 15c10 0 17 5 17 15" />
        <path className="badge-icon-leaf badge-icon-leaf--light" d="M33 35c11 0 17-7 16-17-10 0-17 6-17 16" />
        <circle className="badge-icon-dot" cx="18" cy="38" r="2" />
        <circle className="badge-icon-dot" cx="48" cy="40" r="1.5" />
      </svg>
    );
  }
  if (level === "VERIFIED") {
    return (
      <svg viewBox="0 0 64 64" role="presentation">
        <path className="badge-icon-shield" d="M32 8 49 15v14c0 12-7 21-17 27-10-6-17-15-17-27V15Z" />
        <path className="badge-icon-check" d="m23 31 6 6 13-15" />
        <path className="badge-icon-accent-leaf" d="M43 44c7-1 10-5 10-11-6 0-10 4-10 11Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" role="presentation">
      <path className="badge-icon-og-leaf" d="M39 17c8 0 12-5 13-11-8 0-13 4-13 11Z" />
      <path className="badge-icon-og-stem" d="M39 18c3-5 7-8 12-10" />
      <text className="badge-icon-og-text" x="32" y="43" textAnchor="middle">OG</text>
      <path className="badge-icon-og-underline" d="M17 48c10 3 20 3 30 0" />
    </svg>
  );
}
