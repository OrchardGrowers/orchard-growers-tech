import { BusinessVerificationBadge } from "./GrowerVerificationBadge";

// These public API flags are calculated by the backend for the Buyer role.
// isOgVerified requires approved KYC and a decided, approved OG request;
// paying for or submitting a verification request alone does not qualify.
export const getBuyerVerificationLevel = (profile = {}) => {
  if (profile?.isKycVerified !== true) return "REGISTERED";
  return profile.isOgVerified === true ? "OG_VERIFIED" : "VERIFIED";
};

export default function BuyerVerificationBadge({ level, size = "compact", className = "" }) {
  return <BusinessVerificationBadge role="buyer" level={level} size={size} className={className} />;
}
