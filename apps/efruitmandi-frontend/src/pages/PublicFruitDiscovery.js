import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import API from "../services/api";
import SEO, { getInitialRobotsDirective } from "../components/SEO";
import { DirectoryCard, deduplicateProfiles, getProfileName, getProfilePath } from "./PublicProfileDirectory";
import { buildBreadcrumbSchema, buildCollectionPageSchema, buildItemListSchema } from "../utils/schemaGenerators";

const SITE_URL = "https://www.efruitmandi.live";
const safeSlug = (value = "") => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));

export default function PublicFruitDiscovery({ view = "overview", role = "" }) {
  const { fruitSlug = "", varietySlug = "", stateSlug = "", districtSlug = "" } = useParams();
  const locationRoute = useLocation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null); setFailed(false);
    API.get("/user/public-fruit-discovery").then((response) => { if (active) setData(response.data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const fruit = data?.fruits?.find((item) => item.slug === fruitSlug);
  const variety = fruit?.varieties?.find((item) => item.slug === varietySlug);
  const entity = varietySlug ? variety : fruit;
  const sourceProfiles = role ? entity?.[`${role}s`] || [] : [];
  const profiles = deduplicateProfiles(sourceProfiles, role || "grower").filter((profile) => {
    if (stateSlug && profile.state && slug(profile.state) !== stateSlug) return false;
    if (districtSlug && profile.district && slug(profile.district) !== districtSlug) return false;
    return !stateSlug || slug(profile.state) === stateSlug;
  });
  const threshold = role ? data?.thresholds?.profiles || 2 : varietySlug ? data?.thresholds?.variety || 2 : data?.thresholds?.overview || 1;
  const unavailable = failed || Boolean(data && ((fruitSlug && (!safeSlug(fruitSlug) || !fruit)) || (varietySlug && (!safeSlug(varietySlug) || !variety))));
  const indexable = view === "directory" ? Boolean(data?.fruits?.length) : !unavailable && (role ? profiles.length : entity?.lotCount || 0) >= threshold;
  const baseName = variety ? `${variety.name} ${fruit.name}` : fruit?.name || "";
  const resolvedState = profiles.find((profile) => slug(profile.state) === stateSlug)?.state || "";
  const resolvedDistrict = profiles.find((profile) => slug(profile.district) === districtSlug)?.district || "";
  const location = districtSlug ? [resolvedDistrict, resolvedState].filter(Boolean).join(", ") : resolvedState;
  const heading = view === "directory" ? "Fruits Traded on eFruitMandi" : role ? `${baseName} ${role === "grower" ? "Growers and Orchards" : "Buyers and Traders"}${location ? ` in ${location}` : ""}` : `${baseName} on eFruitMandi`;
  const path = locationRoute.pathname;
  const [initialRobots] = useState(() =>
    getInitialRobotsDirective(path, "noindex,nofollow")
  );
  const title = view === "directory" ? "Fruits, Growers and Buyers in India | eFruitMandi" : `${heading}${role || variety ? "" : " Growers, Buyers and Fruit Lots in India"} | eFruitMandi`;
  const description = view === "directory" ? "Explore fruits publicly listed on eFruitMandi. Discover fruit lots, eligible growers, orchards, buyers and traders across India." : `Explore public ${baseName} marketplace activity, eligible profiles and fruit lots on eFruitMandi${location ? ` in ${location}` : ""}.`;
  const items = view === "directory" ? data?.fruits || [] : role ? profiles : [];
  const stateLinks = !role && fruit ? ["grower", "buyer"].flatMap((profileRole) => {
    const groups = new Map();
    (fruit[`${profileRole}s`] || []).forEach((profile) => {
      const stateKey = slug(profile.state);
      if (stateKey) groups.set(stateKey, { name: profile.state, count: (groups.get(stateKey)?.count || 0) + 1, role: profileRole });
    });
    return Array.from(groups.entries()).filter(([, entry]) => entry.count >= 2).map(([stateKey, entry]) => ({ ...entry, path: `/fruits/${fruit.slug}/${entry.role}s/state/${stateKey}` }));
  }) : [];
  const schema = useMemo(() => !indexable ? undefined : [
    buildCollectionPageSchema({ name: heading, description, url: `${SITE_URL}${path}` }),
    ...(items.length ? [buildItemListSchema(items.map((item) => ({ name: role ? getProfileName(item, role) : item.name, url: `${SITE_URL}${role ? getProfilePath(item, role) : `/fruits/${item.slug}`}` })))] : []),
    buildBreadcrumbSchema([{ name: "Home", url: `${SITE_URL}/` }, { name: "Fruits", url: `${SITE_URL}/fruits` }, ...(fruit ? [{ name: fruit.name, url: `${SITE_URL}/fruits/${fruit.slug}` }] : [])]),
  ], [description, fruit, heading, indexable, items, path, role]);

  if (unavailable) return <Unavailable />;
  const robots = !data && !failed
    ? initialRobots
    : indexable
      ? "index,follow"
      : "noindex,nofollow";
  return <><SEO title={title} description={description} canonical={path} robots={robots} schema={schema} /><main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10"><h1 className="text-2xl font-extrabold text-gray-950 sm:text-3xl">{heading}</h1><p className="mt-3 text-sm font-semibold text-gray-600">{description}</p>{!data ? <p className="mt-6">Loading public fruit activity...</p> : view === "directory" ? <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.fruits.map((item) => <Link className="rounded-xl border border-green-100 bg-white p-5 font-extrabold text-green-900" key={item.slug} to={`/fruits/${item.slug}`}>{item.name}</Link>)}</div> : role ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((profile) => <DirectoryCard key={getProfilePath(profile, role)} profile={profile} role={role} label={role} />)}</div> : <nav className="mt-7 flex flex-wrap gap-3"><Link to={`/fruit-lots/${fruit.slug}`} className="font-bold text-green-800">View public {fruit.name} lots</Link>{fruit.growerCount >= 2 && <Link to={`/fruits/${fruit.slug}/growers`} className="font-bold text-green-800">View {fruit.name} growers</Link>}{fruit.buyerCount >= 2 && <Link to={`/fruits/${fruit.slug}/buyers`} className="font-bold text-green-800">View {fruit.name} buyers</Link>}{fruit.varieties?.filter((item) => item.lotCount >= 2).map((item) => <Link key={item.slug} to={`/fruits/${fruit.slug}/varieties/${item.slug}`} className="font-bold text-green-800">{item.name}</Link>)}{stateLinks.map((item) => <Link key={item.path} to={item.path} className="font-bold text-green-800">{item.name} {item.role}s</Link>)}</nav>}</main></>;
}

const slug = (value = "") => String(value).trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function Unavailable() { return <><SEO title="Fruit page unavailable | eFruitMandi" canonical="/fruits" noIndex image={null} /><main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14 text-center"><h1 className="text-2xl font-bold">Fruit page unavailable</h1><Link to="/fruits" className="mt-6 inline-flex font-bold text-green-800">Browse public fruits</Link></main></>; }
