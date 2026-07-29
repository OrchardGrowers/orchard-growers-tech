import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaCalendarAlt, FaChartLine, FaFilter, FaMapMarkerAlt, FaSearch } from "react-icons/fa";
import SEO from "../components/SEO";
import API from "../services/api";
import {
  findFruitEntity,
  getMandiPageRobots,
} from "../../../../packages/shared-config/fruitSearch.mjs";

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const fromSlug = (value = "") =>
  String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatPrice = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `₹${number.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const uniqueSorted = (items) =>
  Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );

export default function MandiRates() {
  const { commoditySlug } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [fruits, setFruits] = useState([]);
  const [availableMandiSlugs, setAvailableMandiSlugs] = useState(null);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const slugCommodity = useMemo(() => {
    if (!commoditySlug) return "";
    const fallback = fromSlug(commoditySlug);
    const knownFruit = findFruitEntity(commoditySlug);
    return fruits.find((fruit) => slugify(fruit) === commoditySlug) || knownFruit?.name || fallback;
  }, [commoditySlug, fruits]);

  const selectedCommodity = commodity || slugCommodity;
  const selectedFruit = findFruitEntity(selectedCommodity || commoditySlug);
  const selectedFruitSlug = selectedFruit?.slug || slugify(selectedCommodity);
  const availabilityResolved = Array.isArray(availableMandiSlugs);
  const hasResolvedRates =
    Boolean(selectedFruitSlug) &&
    availabilityResolved &&
    availableMandiSlugs.includes(selectedFruitSlug);
  const pageTitle = selectedCommodity
    ? hasResolvedRates
      ? `${selectedCommodity} Mandi Rates Today | eFruitMandi`
      : `${selectedCommodity} Mandi Rates | eFruitMandi`
    : "Fruit Mandi Rates Today | eFruitMandi";
  const pageDescription = selectedCommodity
    ? hasResolvedRates
      ? `Check latest ${selectedCommodity.toLowerCase()} mandi rates from AGMARKNET markets across India with min, modal and max price per kg.`
      : `Check available ${selectedCommodity.toLowerCase()} mandi-rate information and related fruit marketplace pages on eFruitMandi.`
    : "Check latest fruit mandi rates from AGMARKNET markets across India with commodity, variety, market, district, state and price per kg.";
  const robots = getMandiPageRobots({
    isFruitPage: Boolean(commoditySlug),
    loading: Boolean(commoditySlug) && !availabilityResolved,
    recordCount: hasResolvedRates ? 1 : 0,
  });

  useEffect(() => {
    API.get("/mandi-rates/fruits")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.fruits || [];
        setFruits(list);
      })
      .catch(() => setFruits([]));
  }, []);

  useEffect(() => {
    API.get("/mandi-rates/available-fruits")
      .then((res) => {
        const slugs = Array.isArray(res.data?.slugs) ? res.data.slugs : [];
        setAvailableMandiSlugs((current) => [
          ...new Set([...(Array.isArray(current) ? current : []), ...slugs]),
        ]);
      })
      .catch(() =>
        setAvailableMandiSlugs((current) => (Array.isArray(current) ? current : []))
      );
  }, []);

  useEffect(() => {
    setCommodity(slugCommodity || "");
  }, [slugCommodity]);

  useEffect(() => {
    const loadRates = async () => {
      setLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (selectedCommodity) params.set("commodity", selectedCommodity);
        if (state) params.set("state", state);
        if (district) params.set("district", district);

        const response = await API.get(`/mandi-rates${params.toString() ? `?${params}` : ""}`);
        const records = Array.isArray(response.data?.records) ? response.data.records : [];
        setRates(records);
        if (selectedFruitSlug && records.length > 0) {
          setAvailableMandiSlugs((current) => [
            ...new Set([...(Array.isArray(current) ? current : []), selectedFruitSlug]),
          ]);
        }
      } catch (error) {
        console.error(error);
        setRates([]);
        setMessage("Unable to load mandi rates right now.");
      } finally {
        setLoading(false);
      }
    };

    loadRates();
  }, [district, query, selectedCommodity, selectedFruitSlug, state]);

  const stateOptions = useMemo(() => uniqueSorted(rates.map((rate) => rate.state)), [rates]);
  const districtOptions = useMemo(
    () => uniqueSorted(rates.map((rate) => rate.district)),
    [rates]
  );

  const handleCommodityChange = (value) => {
    setCommodity(value);
    setState("");
    setDistrict("");
    const fruitSlug = findFruitEntity(value)?.slug || slugify(value);
    navigate(value ? `/mandi-rates/${fruitSlug}` : "/mandi-rates");
  };

  return (
    <>
      <SEO
        title={pageTitle}
        description={pageDescription}
        canonical={selectedCommodity ? `/mandi-rates/${selectedFruitSlug}` : "/mandi-rates"}
        robots={robots}
      />

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-20 md:px-0">
        <header className="-mx-4 bg-green-800 px-4 pb-5 pt-4 text-white md:-mx-4 md:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-green-100">
              <FaChartLine />
              AGMARKNET fruit rates
            </p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-black leading-tight md:text-3xl">
                  {selectedCommodity ? `${selectedCommodity} Mandi Rates` : "Fruit Mandi Rates"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-green-50">
                  Stored Government of India mandi prices for fruit markets across India.
                </p>
              </div>
              <div className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-extrabold text-green-800">
                <FaCalendarAlt />
                {rates.length} records
              </div>
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-3 rounded-md border border-green-100 bg-white p-3 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(150px,1fr))]">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3">
            <FaSearch className="shrink-0 text-green-700" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commodity, market, district, state"
              className="w-full bg-transparent text-sm font-bold text-gray-950 outline-none placeholder:text-gray-400"
            />
          </label>

          <FilterSelect
            icon={<FaFilter />}
            label="Commodity"
            value={selectedCommodity}
            onChange={handleCommodityChange}
            options={fruits}
          />
          <FilterSelect
            icon={<FaMapMarkerAlt />}
            label="State"
            value={state}
            onChange={(value) => {
              setState(value);
              setDistrict("");
            }}
            options={stateOptions}
          />
          <FilterSelect
            icon={<FaMapMarkerAlt />}
            label="District"
            value={district}
            onChange={setDistrict}
            options={districtOptions}
          />
        </section>

        {selectedCommodity && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold leading-5 text-gray-600">
              Latest available {selectedCommodity.toLowerCase()} rates are shown with their market
              and update date. If no records are available, eFruitMandi does not estimate or
              fabricate a price.
            </p>
            <nav aria-label={`${selectedCommodity} related pages`} className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              to="/mandi-rates"
              onClick={() => {
                setCommodity("");
                setState("");
                setDistrict("");
              }}
              className="inline-flex min-h-10 items-center rounded-full bg-white px-3 py-1.5 text-green-800 ring-1 ring-green-100"
            >
              All fruits
            </Link>
            <Link
              to={`/fruit-lots/${findFruitEntity(selectedCommodity)?.slug || slugify(selectedCommodity)}`}
              className="inline-flex min-h-10 items-center rounded-full bg-white px-3 py-1.5 text-green-800 ring-1 ring-green-100"
            >
              {selectedCommodity} fruit lots
            </Link>
            <Link
              to="/auctions"
              className="inline-flex min-h-10 items-center rounded-full bg-white px-3 py-1.5 text-green-800 ring-1 ring-green-100"
            >
              Fruit marketplace
            </Link>
            {["apple", "mango", "pear"].map((slug) => (
              <Link
                key={slug}
                to={`/mandi-rates/${slug}`}
                className="inline-flex min-h-10 items-center rounded-full bg-green-50 px-3 py-1.5 text-green-800 ring-1 ring-green-100"
              >
                {fromSlug(slug)}
              </Link>
            ))}
            </nav>
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {message}
          </p>
        )}

        <section className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-md border border-green-100 bg-white px-3 py-8 text-center text-sm font-bold text-green-700">
              Loading mandi rates...
            </div>
          ) : rates.length ? (
            rates.map((rate) => (
              <article key={rate._id || rate.id} className="rounded-md border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 text-sm font-extrabold text-gray-950">
                      {rate.commodity || "-"}
                    </h2>
                    <p className="mt-1 truncate text-xs font-bold text-gray-600">
                      {rate.variety || "Variety not available"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-800">
                    {formatDate(rate.arrivalDate)}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-gray-700">
                  {rate.market || "-"}, {rate.district || "-"}, {rate.state || "-"}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <RateStat label="Min" value={formatPrice(rate.minPriceKg)} />
                  <RateStat label="Modal" value={formatPrice(rate.modalPriceKg)} strong />
                  <RateStat label="Max" value={formatPrice(rate.maxPriceKg)} />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-gray-200 bg-white px-3 py-8 text-center text-sm font-bold text-gray-600">
              No mandi rates found.
            </div>
          )}
        </section>

        <section className="mt-4 hidden overflow-hidden rounded-md border border-gray-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-xs">
              <thead className="bg-green-50 text-[11px] uppercase text-green-900">
                <tr>
                  <Th>Commodity</Th>
                  <Th>Variety</Th>
                  <Th>Market</Th>
                  <Th>District</Th>
                  <Th>State</Th>
                  <Th>Min ₹/kg</Th>
                  <Th>Modal ₹/kg</Th>
                  <Th>Max ₹/kg</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-3 py-8 text-center text-sm font-bold text-green-700">
                      Loading mandi rates...
                    </td>
                  </tr>
                ) : rates.length ? (
                  rates.map((rate) => (
                    <tr key={rate._id || rate.id} className="hover:bg-green-50/60">
                      <Td strong>{rate.commodity || "-"}</Td>
                      <Td>{rate.variety || "-"}</Td>
                      <Td>{rate.market || "-"}</Td>
                      <Td>{rate.district || "-"}</Td>
                      <Td>{rate.state || "-"}</Td>
                      <Td>{formatPrice(rate.minPriceKg)}</Td>
                      <Td strong>{formatPrice(rate.modalPriceKg)}</Td>
                      <Td>{formatPrice(rate.maxPriceKg)}</Td>
                      <Td>{formatDate(rate.arrivalDate)}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-3 py-8 text-center text-sm font-bold text-gray-600">
                      No mandi rates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function FilterSelect({ icon, label, value, onChange, options }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3">
      <span className="shrink-0 text-green-700">{icon}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm font-bold text-gray-950 outline-none"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }) {
  return <th className="whitespace-nowrap px-3 py-3 font-black">{children}</th>;
}

function Td({ children, strong = false }) {
  return (
    <td className={`whitespace-nowrap px-3 py-3 ${strong ? "font-extrabold text-gray-950" : "font-semibold text-gray-700"}`}>
      {children}
    </td>
  );
}

function RateStat({ label, value, strong = false }) {
  return (
    <div className="rounded-md bg-green-50 px-2 py-2">
      <p className="font-bold text-green-800">{label}</p>
      <p className={`mt-1 ${strong ? "font-extrabold text-gray-950" : "font-bold text-gray-700"}`}>
        {value}
      </p>
    </div>
  );
}
