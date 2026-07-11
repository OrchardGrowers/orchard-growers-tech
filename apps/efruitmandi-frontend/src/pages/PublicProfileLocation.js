import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import API from "../services/api";
import SEO from "../components/SEO";
import { buildBreadcrumbSchema, buildCollectionPageSchema, buildItemListSchema } from "../utils/schemaGenerators";
import {
  DirectoryCard,
  PUBLIC_LOCATION_MIN_PROFILES,
  deduplicateProfiles,
  getProfileName,
  getProfilePath,
} from "./PublicProfileDirectory";

const SITE_URL = "https://www.efruitmandi.live";
const safeSlug = (value = "") => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
const slugifyLocation = (value = "") => String(value || "").trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export default function PublicProfileLocation({ role }) {
  const { stateSlug = "", districtSlug = "" } = useParams();
  const [profiles, setProfiles] = useState([]);
  const [stateEntry, setStateEntry] = useState(null);
  const [districtEntry, setDistrictEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const basePath = role === "grower" ? "/growers" : "/buyers";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnavailable(false);
    setProfiles([]);
    setStateEntry(null);
    setDistrictEntry(null);
    const normalizedStateSlug = slugifyLocation(stateSlug);
    const normalizedDistrictSlug = slugifyLocation(districtSlug);

    if (stateSlug.includes("..") || districtSlug.includes("..") || !safeSlug(normalizedStateSlug) || (districtSlug && !safeSlug(normalizedDistrictSlug))) {
      setUnavailable(true);
      setLoading(false);
      return () => { active = false; };
    }

    API.get(`/user/public-profile-locations?role=${encodeURIComponent(role)}`)
      .then(async (response) => {
        const states = Array.isArray(response.data?.states) ? response.data.states : [];
        const matchingStates = states.filter((state) => state.slug === normalizedStateSlug);
        if (matchingStates.length !== 1) throw new Error("LOCATION_UNAVAILABLE");
        const resolvedState = matchingStates[0];
        const matchingDistricts = districtSlug
          ? (resolvedState.districts || []).filter((district) => district.slug === normalizedDistrictSlug)
          : [];
        if (districtSlug && matchingDistricts.length !== 1) throw new Error("LOCATION_UNAVAILABLE");
        const resolvedDistrict = matchingDistricts[0] || null;
        const query = new URLSearchParams({ role, limit: "all", state: resolvedState.name });
        if (resolvedDistrict) query.set("district", resolvedDistrict.name);
        const profileResponse = await API.get(`/user/public-profiles?${query.toString()}`);
        if (!active) return;
        setStateEntry(resolvedState);
        setDistrictEntry(resolvedDistrict);
        setProfiles(deduplicateProfiles(Array.isArray(profileResponse.data?.profiles) ? profileResponse.data.profiles : [], role));
      })
      .catch(() => {
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [districtSlug, role, stateSlug]);

  const isDistrict = Boolean(districtEntry);
  const locationName = isDistrict ? `${districtEntry.name}, ${stateEntry?.name}` : stateEntry?.name || "";
  const roleHeading = role === "grower" ? "Fruit Growers and Orchards" : "Fruit Buyers and Traders";
  const canonicalPath = stateEntry
    ? `${basePath}/state/${stateEntry.slug}${isDistrict ? `/district/${districtEntry.slug}` : ""}`
    : `${basePath}/state/${stateSlug}${districtSlug ? `/district/${districtSlug}` : ""}`;
  const title = locationName ? `${roleHeading} in ${locationName} | eFruitMandi` : `Location unavailable | eFruitMandi`;
  const description = locationName
    ? role === "grower"
      ? `Discover public fruit growers, orchards and farms listed on eFruitMandi in ${locationName}. Explore grower profiles, public locations and available fruit lots.`
      : `Discover public fruit buyers, traders and sourcing businesses listed on eFruitMandi in ${locationName}. Explore buyer profiles and fruit sourcing activity.`
    : "This public profile location is unavailable.";
  const indexable = !loading && !unavailable && profiles.length >= PUBLIC_LOCATION_MIN_PROFILES;
  const schema = useMemo(() => {
    if (!indexable) return undefined;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const crumbs = [
      { name: "Home", url: `${SITE_URL}/` },
      { name: role === "grower" ? "Growers" : "Buyers", url: `${SITE_URL}${basePath}` },
      { name: stateEntry.name, url: `${SITE_URL}${basePath}/state/${stateEntry.slug}` },
    ];
    if (isDistrict) crumbs.push({ name: districtEntry.name, url: canonicalUrl });
    return [
      buildCollectionPageSchema({ name: `${roleHeading} in ${locationName}`, description, url: canonicalUrl }),
      buildItemListSchema(profiles.map((profile) => ({ name: getProfileName(profile, role), url: `${SITE_URL}${getProfilePath(profile, role)}` }))),
      buildBreadcrumbSchema(crumbs),
    ];
  }, [basePath, canonicalPath, description, districtEntry, indexable, isDistrict, locationName, profiles, role, roleHeading, stateEntry]);

  if (!loading && stateEntry && canonicalPath !== `${basePath}/state/${stateSlug}${districtSlug ? `/district/${districtSlug}` : ""}`) {
    return <Navigate to={canonicalPath} replace />;
  }

  if (!loading && (unavailable || !stateEntry)) {
    return <LocationUnavailable basePath={basePath} />;
  }

  return (
    <>
      <SEO title={title} description={description} canonical={canonicalPath} noIndex={!indexable} schema={schema} />
      <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-gray-950 sm:text-3xl">{locationName ? `${roleHeading} in ${locationName}` : roleHeading}</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-gray-600">{description}</p>
        {isDistrict ? (
          <Link to={`${basePath}/state/${stateEntry.slug}`} className="mt-5 inline-flex text-sm font-bold text-green-800">View all profiles in {stateEntry.name}</Link>
        ) : (
          <nav className="mt-5 flex flex-wrap gap-2" aria-label={`Districts in ${stateEntry?.name || "state"}`}>
            {(stateEntry?.districts || []).filter((district) => district.count >= PUBLIC_LOCATION_MIN_PROFILES).map((district) => (
              <Link key={district.slug} to={`${basePath}/state/${stateEntry.slug}/district/${district.slug}`} className="rounded-full border border-green-200 px-3 py-2 text-xs font-bold text-green-800">{district.name}</Link>
            ))}
          </nav>
        )}
        {loading ? <p className="mt-6 text-sm font-semibold text-gray-600">Loading public profiles...</p> : profiles.length ? (
          <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => <DirectoryCard key={getProfilePath(profile, role)} profile={profile} role={role} label={role === "grower" ? "Grower" : "Buyer"} />)}
          </section>
        ) : <p className="mt-6 rounded-xl bg-green-50 p-5 text-sm font-semibold text-green-900">No eligible public profiles are available for this location.</p>}
      </main>
    </>
  );
}

function LocationUnavailable({ basePath }) {
  return <><SEO title="Location unavailable | eFruitMandi" canonical={basePath} noIndex image={null} /><main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14 text-center"><h1 className="text-2xl font-bold text-gray-950">Location unavailable</h1><p className="mt-3 text-gray-600">This public profile location is unavailable.</p><Link to={basePath} className="mt-6 inline-flex rounded-md bg-green-700 px-5 py-3 text-sm font-bold text-white">Browse public profiles</Link></main></>;
}
