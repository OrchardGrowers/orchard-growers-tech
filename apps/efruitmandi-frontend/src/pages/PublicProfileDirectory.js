import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCheckCircle, FaMapMarkerAlt, FaSeedling } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import SEO, { getInitialRobotsDirective } from "../components/SEO";
import { buildBreadcrumbSchema, buildCollectionPageSchema, buildItemListSchema } from "../utils/schemaGenerators";

const SITE_URL = "https://www.efruitmandi.live";
export const PUBLIC_LOCATION_MIN_PROFILES = 2;

const DIRECTORY_META = {
  grower: {
    title: "Fruit Growers and Orchards in India | eFruitMandi",
    description: "Discover public fruit growers, orchards and farms listed on eFruitMandi. Explore grower profiles, locations and available fruit lots across India.",
    h1: "Fruit Growers and Orchards",
    introduction: "Explore public orchard and grower profiles listed on eFruitMandi, including their public locations and marketplace activity.",
    path: "/growers",
    label: "Grower",
  },
  buyer: {
    title: "Fruit Buyers and Traders in India | eFruitMandi",
    description: "Discover public fruit buyers, traders and sourcing businesses listed on eFruitMandi. Explore buyer profiles and fruit sourcing activity across India.",
    h1: "Fruit Buyers and Traders",
    introduction: "Explore public buyer, trader and sourcing-business profiles listed on eFruitMandi.",
    path: "/buyers",
    label: "Buyer",
  },
};

const resolveProfileImage = (value = "") => {
  const image = String(value || "").trim().replace(/\\/g, "/");
  if (!image) return "";
  if (/^https?:/i.test(image)) return image;
  if (image.startsWith("/uploads/")) return `${FILE_BASE_URL}${image}`;
  if (image.startsWith("/")) return image;
  return `${FILE_BASE_URL}/${image}`;
};

export const getProfileName = (profile, role) => String(
  role === "grower"
    ? profile?.orchardName || profile?.companyName || ""
    : profile?.businessName || profile?.companyName || profile?.buyerContactPerson || ""
).trim();

export const getProfilePath = (profile, role) => {
  const slug = String(profile?.slug || "").trim().toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return `/${role === "grower" ? "growers" : "buyers"}/${slug}`;
  }
  const id = profile?._id || profile?.id || profile?.userId;
  return id ? `/profiles/${role}/${id}` : "";
};

export const deduplicateProfiles = (profiles, role) => {
  const seen = new Set();
  return profiles.filter((profile) => {
    const path = getProfilePath(profile, role);
    const name = getProfileName(profile, role);
    if (!path || !name || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
};

export default function PublicProfileDirectory({ role }) {
  const meta = DIRECTORY_META[role] || DIRECTORY_META.grower;
  const [initialRobots] = useState(() =>
    getInitialRobotsDirective(meta.path, "noindex,nofollow")
  );
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [states, setStates] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setProfiles([]);
    setStates([]);

    Promise.all([
      API.get(`/user/public-profiles?role=${encodeURIComponent(role)}&limit=all&devPublicMarketplace=1`),
      API.get(`/user/public-profile-locations?role=${encodeURIComponent(role)}&devPublicMarketplace=1`).catch(() => ({ data: { states: [] } })),
    ])
      .then(([response, locationResponse]) => {
        if (!active) return;
        const results = Array.isArray(response.data?.profiles) ? response.data.profiles : [];
        setProfiles(deduplicateProfiles(results, role));
        setStates(Array.isArray(locationResponse.data?.states) ? locationResponse.data.states : []);
      })
      .catch(() => {
        if (!active) return;
        setProfiles([]);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  const schema = useMemo(() => {
    if (!profiles.length) return undefined;
    const canonicalUrl = `${SITE_URL}${meta.path}`;
    return [
      buildCollectionPageSchema({
        name: meta.h1,
        description: meta.description,
        url: canonicalUrl,
      }),
      buildItemListSchema(profiles.map((profile) => ({
          url: `${SITE_URL}${getProfilePath(profile, role)}`,
          name: getProfileName(profile, role),
      }))),
      buildBreadcrumbSchema([
        { name: "Home", url: `${SITE_URL}/` },
        { name: role === "grower" ? "Growers" : "Buyers", url: canonicalUrl },
      ]),
    ];
  }, [meta, profiles, role]);

  const hasMeaningfulContent = !loading && !failed && profiles.length > 0;
  const robots = loading
    ? initialRobots
    : hasMeaningfulContent
      ? "index,follow"
      : "noindex,nofollow";

  return (
    <>
      <SEO
        title={meta.title}
        description={meta.description}
        canonical={meta.path}
        robots={robots}
        schema={schema}
      />
      <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10">
        <header className="mb-7">
          <h1 className="text-2xl font-extrabold text-gray-950 sm:text-3xl">{meta.h1}</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-gray-600">{meta.introduction}</p>
        </header>

        {states.some((state) => state.count >= PUBLIC_LOCATION_MIN_PROFILES) && (
          <nav className="mb-6 flex flex-wrap gap-2" aria-label={`${meta.label} profiles by state`}>
            {states.filter((state) => state.count >= PUBLIC_LOCATION_MIN_PROFILES).map((state) => (
              <Link key={state.slug} to={`${meta.path}/state/${state.slug}`} className="rounded-full border border-green-200 px-3 py-2 text-xs font-bold text-green-800 hover:bg-green-50">
                {state.name}
              </Link>
            ))}
          </nav>
        )}

        {loading ? (
          <p className="rounded-xl border border-green-100 bg-green-50 p-5 text-sm font-semibold text-green-900">Loading public profiles...</p>
        ) : profiles.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${meta.h1} directory`}>
            {profiles.map((profile) => (
              <DirectoryCard key={getProfilePath(profile, role)} profile={profile} role={role} label={meta.label} />
            ))}
          </section>
        ) : (
          <p className="rounded-xl border border-green-100 bg-green-50 p-5 text-sm font-semibold text-green-900">
            {failed ? "Public profiles are temporarily unavailable." : `No eligible public ${meta.label.toLowerCase()} profiles are available right now.`}
          </p>
        )}
      </main>
    </>
  );
}

export function DirectoryCard({ profile, role, label }) {
  const name = getProfileName(profile, role);
  const profilePath = getProfilePath(profile, role);
  const location = String(profile.mainLocation || "").trim();
  const image = resolveProfileImage(profile.logoUrl || profile.buyerCompanyLogoUrl || profile.companyLogoUrl);
  const buyerSubtype = role === "buyer"
    ? String(profile.businessType || "buyer").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Fruit Grower";

  return (
    <article className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
      <Link
        to={profilePath}
        aria-label={`View ${name} public ${label.toLowerCase()} profile`}
        className="block h-full p-5 transition hover:bg-green-50"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-green-50 text-2xl text-green-700">
            {image ? <img src={image} alt={`${name} public profile`} className="h-full w-full object-contain" loading="lazy" /> : <FaSeedling />}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-gray-950">{name}</h2>
            <p className="mt-1 text-xs font-bold text-green-800">{buyerSubtype}</p>
            {location && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-600"><FaMapMarkerAlt className="shrink-0 text-green-700" />{location}</p>}
            {(profile.isKycVerified || profile.isOgVerified) && <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-green-800"><FaCheckCircle /> Verified profile</p>}
          </div>
        </div>
      </Link>
    </article>
  );
}
