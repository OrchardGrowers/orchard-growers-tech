import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaBuilding, FaCheckCircle, FaMapMarkerAlt, FaSeedling } from "react-icons/fa";
import API from "../services/api";
import SEO from "../components/SEO";

const BUSINESS_TYPE_LABELS = {
  grower: "Grower",
  buyer: "Buyer",
  exporter: "Exporter",
  "commission-agent": "Commission Agent",
  "cold-storage": "Cold Storage",
  logistics: "Logistics",
};

const fallbackLogo = "/logo-original.png";

export default function PublicBusinessProfile() {
  const navigate = useNavigate();
  const { businessType = "", userId = "" } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    API.get(
      `/user/public-profiles/${encodeURIComponent(businessType)}/${encodeURIComponent(userId)}`
    )
      .then((response) => {
        if (active) setProfile(response.data?.profile || null);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.status === 404
              ? "This public profile is not available."
              : "The public profile could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [businessType, userId]);

  const typeLabel =
    BUSINESS_TYPE_LABELS[businessType] ||
    profile?.businessType
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") ||
    "Business";
  const firmName = profile?.companyName || "eFruitMandi Business";
  const canonical = `/profiles/${businessType}/${userId}`;

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14">
        <p className="text-center text-sm font-semibold text-gray-500">Loading public profile…</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14 text-center">
        <h1 className="text-2xl font-bold text-gray-950">Public profile unavailable</h1>
        <p className="mt-3 text-gray-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 rounded-md bg-green-700 px-5 py-3 text-sm font-bold text-white"
        >
          Visit eFruitMandi
        </button>
      </main>
    );
  }

  return (
    <>
      <SEO
        title={`${firmName} – ${typeLabel} on eFruitMandi`}
        description={`${firmName} is a public ${typeLabel.toLowerCase()} profile in ${profile.mainLocation} on eFruitMandi.`}
        canonical={canonical}
        image={profile.logoUrl || fallbackLogo}
      />
      <main className="mx-auto min-h-[65vh] max-w-3xl px-4 py-10">
        <article className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
          <div className="h-24 bg-gradient-to-r from-green-800 via-green-700 to-emerald-500" />
          <div className="px-5 pb-7 sm:px-8">
            <img
              src={profile.logoUrl || fallbackLogo}
              alt={`${firmName} official firm logo`}
              onError={(event) => {
                event.currentTarget.src = fallbackLogo;
              }}
              className="-mt-12 h-24 w-24 rounded-xl border-4 border-white bg-white object-contain shadow"
            />

            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-green-700">
                  <FaSeedling /> {typeLabel}
                </p>
                <h1 className="mt-2 text-2xl font-extrabold text-gray-950 sm:text-3xl">
                  {firmName}
                </h1>
                <p className="mt-3 inline-flex items-center gap-2 text-gray-600">
                  <FaMapMarkerAlt className="text-green-700" />
                  {profile.mainLocation}
                </p>
              </div>

              {(profile.isKycVerified || profile.isOgVerified) && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
                  <span className="inline-flex items-center gap-2">
                    <FaCheckCircle /> Verified profile
                  </span>
                </div>
              )}
            </div>

            <div className="mt-7 rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="flex items-center gap-2 font-bold text-gray-950">
                <FaBuilding className="text-green-700" />
                Connect through eFruitMandi
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Contact information and private business details are not displayed publicly.
                Sign in to use eFruitMandi’s marketplace connection flow.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate("/profile", {
                    state: { mode: "login", from: canonical },
                  })
                }
                className="mt-4 min-h-11 rounded-md bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800"
              >
                Sign in to connect
              </button>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
