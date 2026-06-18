import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaEye, FaFileAlt, FaSearch, FaSeedling, FaUserCircle } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import { staticPages } from "../data/staticPages";
import { fruitSeoPages } from "../data/fruitSeoPages";

const blogCards = [
  {
    title: "Apple Fruit Buyers",
    url: "/blog/fruit-buyers/apple",
    description: "Find apple buyers, traders, commission agents, wholesalers and direct fruit market connections.",
  },
  {
    title: "Apple Growers Guide",
    url: "/blog/fruit-growers/apple",
    description: "Guide for apple growers to list fruit lots, connect with buyers and improve market reach.",
  },
  {
    title: "Apple Market Price & Trends",
    url: "/blog/apple-market-price",
    description: "Apple market price, mandi bhav, rate discovery, buyer quotations and fruit trade trends.",
  },
  {
    title: "Fruit Transport & Logistics",
    url: "/blog/fruit-transport",
    description: "Fruit transport, logistics, dispatch planning, delivery support and road movement information.",
  },
];
const priorityContentCards = [
  {
    type: "Marketplace",
    title: "Live Fruit Lots",
    url: "/auctions",
    description: "View live fruit lots, available fruit listings, grower lots and marketplace fruit supply.",
    keywords: [
      "live fruit lots",
      "fruit lots",
      "fruit lot",
      "available lots",
      "available fruit lots",
      "live lots",
      "marketplace lots",
      "grower lots",
      "fresh fruit lots",
      "fruit listings",
    ],
  },
  {
    type: "Marketplace",
    title: "No Upcoming Fruit Lots Available",
    url: "/auctions",
    description: "No upcoming fruit lots are available right now. You can still check live fruit lots, buyer quotes, grower listings and related marketplace information below.",
    keywords: [
      "upcoming lots",
      "upcoming fruit lots",
      "new lots",
      "coming lots",
      "future lots",
      "next fruit lots",
    ],
  },
  {
    type: "Marketplace",
    title: "Fruit Lots for Quote",
    url: "/auctions",
    description: "Check fruit lots open for buyer quotation, rate discovery and deal negotiation.",
    keywords: [
      "fruit lots for auctions",
      "fruit auctions",
      "upcoming auctions",
      "auction lots",
      "live auctions",
      "quote lots",
      "quotation lots",
      "buyer quote",
      "rate discovery",
    ],
  },
  {
    type: "Profiles",
    title: "Marketplace Profiles",
    url: "/search",
    description: "Search grower, buyer and driver profiles on eFruitMandi.",
    keywords: [
      "profile",
      "profiles",
      "grower profile",
      "buyer profile",
      "driver profile",
      "seller profile",
      "farmer profile",
      "transporter profile",
    ],
  },
];

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [profiles, setProfiles] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSearch = async () => {
      const cleanQuery = query.trim();

      if (!cleanQuery) {
        setProfiles([]);
        setLots([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await API.get(`/search?q=${encodeURIComponent(cleanQuery)}`);
        setProfiles(Array.isArray(res.data?.profiles) ? res.data.profiles : []);
        setLots(Array.isArray(res.data?.lots) ? res.data.lots : []);
      } catch (err) {
        console.error(err);
        setProfiles([]);
        setLots([]);
      } finally {
        setLoading(false);
      }
    };

    loadSearch();
  }, [query]);

  const words = useMemo(
    () =>
      query
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean),
    [query]
  );

  const contentResults = useMemo(() => {
    if (!words.length) return [];

    const staticItems = Object.values(staticPages || {}).map((page) => ({
      type: "Page",
      title: page.title,
      description: page.description || page.intro,
      url: page.route,
      content: flattenText(page),
    }));

    const fruitItems = [];
    Object.entries(fruitSeoPages || {}).forEach(([type, fruits]) => {
      Object.entries(fruits || {}).forEach(([fruitSlug, page]) => {
        const url =
          type === "buyers"
            ? `/blog/fruit-buyers/${fruitSlug}`
            : type === "growers"
              ? `/blog/fruit-growers/${fruitSlug}`
              : type === "marketPrice"
                ? `/blog/${fruitSlug}-market-price`
                : "/blog/fruit-transport";

        fruitItems.push({
          type: "SEO Resource",
          title: page.h1 || page.title,
          description: page.description || page.intro,
          url,
          content: flattenText(page),
        });
      });
    });

    const blogItems = blogCards.map((card) => ({
      type: "Blog Resource",
      title: card.title,
      description: card.description,
      url: card.url,
      content: flattenText(card),
    }));

    const priorityItems = priorityContentCards
      .filter((card) => {
        const q = query.toLowerCase().trim();
        return card.keywords.some((keyword) => q.includes(keyword));
      })
      .map((card) => ({
        type: card.type,
        title: card.title,
        description: card.description,
        url: card.url === "/search" ? `/search?q=${encodeURIComponent(query)}` : card.url,
        content: flattenText(card),
        priority: true,
      }));

    const mediaItems = [
      {
        type: "Media",
        title: "Media Center",
        description: "Official Media Center of eFruitMandi with company information, media resources, blogs, fruit market insights, press notes and platform updates.",
        url: "/media",
        content: "media center blogs fruit market technology eFruitMandi updates company information media resources fruit market insights press notes platform updates growers buyers traders commission agents logistics partners orchard growers private limited digital fruit marketplace",
      },
      {
        type: "Press Release",
        title: "Press Release",
        description: "Official press release of eFruitMandi by Orchard Growers Private Limited, India's digital fruit marketplace for growers, buyers, traders and logistics partners.",
        url: "/press-release",
        content: "press release official eFruitMandi orchard growers private limited digital fruit marketplace India fruit growers buyers traders logistics partners transparent accessible organized fruit economy agri tech startup",
      },
      {
        type: "News",
        title: "News & Updates",
        description: "Latest eFruitMandi news, platform updates, fruit trade updates, grower guidance and buyer-focused announcements.",
        url: "/news-updates",
        content: "news updates latest eFruitMandi orchard growers platform improvements fruit trade updates grower guidance buyer announcements digital fruit marketplace fruit market news India",
      },
      {
        type: "Blog",
        title: "Blog",
        description: "eFruitMandi blog hub for horticulture, fruit buyers, growers, apple market price, transport, mandi trends and fruit trading knowledge.",
        url: "/blog",
        content: "blog horticulture fruit buyers growers apple market price trends transport logistics mandi trends fruit trading knowledge orchard management grading packing marketing procurement opportunities",
      },
    ];

    return [...blogItems, ...mediaItems, ...fruitItems, ...staticItems].filter((item) => {
      const haystack = flattenText(item).toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [words]);

  const totalResults = profiles.length + lots.length + contentResults.length;

  return (
    <div className="pb-20">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-black">Search Results</h2>
          <p className="text-[10px] font-bold text-gray-500">
            {query ? `For "${query}"` : "Search profiles, fruit lots, pages, guides, blogs and mandi information"}
          </p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold text-green-800">
          {totalResults} found
        </span>
      </div>

      {loading && (
        <p className="py-3 text-sm font-semibold text-green-700">
          Searching live marketplace data...
        </p>
      )}

      {!loading && profiles.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-extrabold text-black">Profiles</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {profiles.map((profile) => (
              <article
                key={profile._id}
                className="rounded-md border border-green-100 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-100 text-xl text-green-700">
                    {profile.image ? (
                      <img
                        src={resolveImageUrl(profile.image)}
                        alt={profile.title || "Profile"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FaUserCircle />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase text-green-700">
                      {profile.type || "Profile"}
                    </p>
                    <h3 className="line-clamp-1 text-sm font-extrabold text-black">
                      {profile.title || profile.name || "Marketplace Profile"}
                    </h3>
                    <p className="truncate text-[11px] font-semibold text-gray-600">
                      {profile.location || (profile.profileTypes || []).join(", ") || "eFruitMandi Profile"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {profile.isKycVerified && <Badge text="KYC" />}
                      {profile.isOgVerified && <Badge text="OG Verified" />}
                      {profile.isTrustedBadge && <Badge text="Trusted" />}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!loading && lots.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-extrabold text-black">Fruit Lots</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {lots.map((product) => (
              <article
                key={product._id}
                className="rounded-md border border-gray-200 bg-white p-2"
              >
                <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-green-100">
                  {getImageUrl(product) ? (
                    <img
                      src={getImageUrl(product)}
                      alt={product.title || "Fruit Lot"}
                      className="h-full w-full object-contain object-center"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl text-green-700">
                      <FaSeedling />
                    </div>
                  )}
                </div>

                <h3 className="line-clamp-1 text-xs font-extrabold text-black">
                  {product.title || product.fruitName || "Fruit Lot"}
                </h3>

                <p className="truncate text-[10px] font-bold text-gray-600">
                  {product.location || "Fruit Mandi"}
                </p>
                <p className="text-[10px] font-bold text-black">
                  {product.quantity || 0} Box Lot
                </p>

                <button
                  type="button"
                  onClick={() => navigate(`/lots/${product._id}`)}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1 text-[9px] font-bold text-gray-700"
                >
                  <FaEye />
                  View Listing
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {contentResults.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-extrabold text-black">Website Content</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {contentResults.map((item) => (
              <article
                key={`${item.type}-${item.url}`}
                className="rounded-md border border-green-100 bg-white p-3 shadow-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold text-green-700">
                  <FaFileAlt />
                  {item.type}
                </div>
                <h3 className="line-clamp-2 text-sm font-extrabold text-black">
                  {item.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-[11px] font-semibold text-gray-600">
                  {item.description}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(item.url)}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-700 px-3 py-1 text-[9px] font-bold text-white"
                >
                  <FaEye />
                  Open Page
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {!loading && !totalResults && <EmptySearch query={query} />}
    </div>
  );
}

function Badge({ text }) {
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[8px] font-extrabold text-green-800">
      {text}
    </span>
  );
}

function flattenText(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return "";
}

function EmptySearch({ query }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <FaSearch className="text-lg" />
      <p className="text-xs font-bold">
        {query ? "No matching profile, fruit lot, or website content found." : "Speak or type a search from the top bar."}
      </p>
    </div>
  );
}

function resolveImageUrl(image = "") {
  const normalizedImage = image ? String(image).replace(/\\/g, "/") : "";
  if (/^https?:\/\//i.test(normalizedImage)) return normalizedImage;
  return normalizedImage ? `${FILE_BASE_URL}/${normalizedImage}` : "";
}

function getImageUrl(product) {
  const objectImage = Array.isArray(product.imageObjects)
    ? product.imageObjects.find((item) => item?.url)?.url
    : "";
  const gradeImage = Array.isArray(product.gradeLots)
    ? product.gradeLots.find((gradeLot) => gradeLot?.images?.[0])?.images?.[0]
    : "";
  const image = Array.isArray(product.images) && product.images[0]
    ? product.images[0]
    : objectImage || gradeImage;

  return resolveImageUrl(image);
}







