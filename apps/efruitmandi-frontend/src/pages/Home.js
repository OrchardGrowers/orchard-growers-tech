import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import {
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisH,
  FaEye,
  FaGavel,
  FaGlobeAmericas,
  FaInfoCircle,
  FaSearchMinus,
  FaSearchPlus,
  FaSeedling,
  FaShieldAlt,
  FaStar,
  FaTimes,
} from "react-icons/fa";
import BannerSlider from "../components/BannerSlider";
import API, { FILE_BASE_URL } from "../services/api";
import {
  getCurrentUser,
  canQuote,
  hasBuyerProfile,
  hasDriverProfile,
  hasGrowerProfile,
  isGrowerAccount,
} from "../utils/auth";
import { getEfruitMandiProducts } from "../utils/marketProducts";
import { saveUserToStorage } from "../utils/userStorage";
import {
  getSafePublicProfile,
  isClosedDeal,
  isLiveDeal,
  isUpcomingDeal,
  normalizeDealStatus,
} from "../utils/marketplaceVisibility";

const categories = [
  { name: "Apple", icon: "🍎" },
  { name: "Pear", icon: "🍐" },
  { name: "Banana", icon: "🍌" },
  { name: "Mango", icon: "🥭" },
  { name: "Orange", icon: "🍊" },
  { name: "Grapes", icon: "🍇" },
  { name: "Kiwi", icon: "🥝" },
  { name: "Pomegranate", icon: "🔴" },
  { name: "Cherry", icon: "🍒" },
  { name: "Peach", icon: "🍑" },
  { name: "Plum", icon: "🟣" },
  { name: "Apricot", icon: "🟠" },
  { name: "Strawberry", icon: "🍓" },
  { name: "Blueberry", icon: "🔵" },
  { name: "Raspberry", icon: "🔴" },
  { name: "Blackberry", icon: "⚫" },
  { name: "Watermelon", icon: "🍉" },
  { name: "Muskmelon", icon: "🍈" },
  { name: "Pineapple", icon: "🍍" },
  { name: "Papaya", icon: "🟧" },
  { name: "Guava", icon: "🟢" },
  { name: "Lychee", icon: "🌸" },
  { name: "Dragon Fruit", icon: "🌺" },
  { name: "Fig", icon: "🟤" },
  { name: "Date", icon: "🌴" },
  { name: "Coconut", icon: "🥥" },
  { name: "Lemon", icon: "🍋" },
  { name: "Lime", icon: "🟢" },
  { name: "Sweet Lime", icon: "🍋" },
  { name: "Grapefruit", icon: "🟠" },
  { name: "Mandarin", icon: "🍊" },
  { name: "Persimmon", icon: "🟠" },
  { name: "Jamun", icon: "🟣" },
  { name: "Custard Apple", icon: "🟢" },
  { name: "Sapota", icon: "🟤" },
  { name: "Avocado", icon: "🥑" },
  { name: "Passion Fruit", icon: "🟣" },
  { name: "Star Fruit", icon: "⭐" },
  { name: "Mulberry", icon: "🟣" },
  { name: "Cranberry", icon: "🔴" },
  { name: "Gooseberry", icon: "🟢" },
  { name: "Amla", icon: "🟢" },
  { name: "Jackfruit", icon: "🟡" },
  { name: "Breadfruit", icon: "🟢" },
  { name: "Rambutan", icon: "🔴" },
  { name: "Mangosteen", icon: "🟣" },
  { name: "Longan", icon: "🟤" },
  { name: "Durian", icon: "🟡" },
  { name: "Olive", icon: "🫒" },
  { name: "Quince", icon: "🟡" },
  { name: "Ber", icon: "🟢" },
  { name: "Bael", icon: "🟡" },
  { name: "Tamarind", icon: "🟤" },
  { name: "Walnut", icon: "🌰" },
  { name: "Almond", icon: "🌰" },
  { name: "Cashew", icon: "🌰" },
];

const previousSections = [
  { title: "Top Deal of the Day", text: "No top deal yet." },
  { title: "Most Expensive Deals", text: "No expensive deals yet." },
  { title: "Highest Deal of the Week", text: "No weekly deal data yet." },
  { title: "Monthly Highest Deal", text: "No monthly deal data yet." },
  { title: "Our Trusted Growers", text: "Trusted growers will appear here after verification." },
  { title: "Our Trusted Buyers", text: "Trusted buyers will appear here after verification." },
  { title: "Organic Growers", text: "Organic growers will appear here after verification." },
  { title: "Organic Buyers", text: "Organic buyers will appear here after verification." },
  { title: "Youtube Stories", text: "No YouTube stories available yet." },
];

const categoryKeywords = categories.map((category) => category.name);

const desktopSections = [
  { key: "liveLots", label: "Live Fruit Deals" },
  { key: "upcomingLots", label: "Upcoming Fruit Deals" },
  { key: "highestDeals", label: "Highest Deals of The Day" },
  ...previousSections.map((section) => ({
    key: section.title,
    label: section.title,
  })),
];

const mobileTabs = [
  { key: "liveLots", label: "Live Fruit Deals" },
  { key: "upcomingLots", label: "Upcoming Fruit Deals" },
  { key: "highestDeals", label: "Highest Deals of The Day" },
  ...previousSections.map((section) => ({
    key: section.title,
    label: section.title,
  })),
];

const orchardCover = `${process.env.PUBLIC_URL || ""}/profile-banners/efruitmandi-profile-cover.png`;
const fallbackLotImage =
  "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=640&q=70";
const logoUrl = `${process.env.PUBLIC_URL || ""}/logo-240.png`;
const homePageSchemas = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "eFruitMandi",
    url: "https://www.efruitmandi.live",
    description:
      "India's fresh fruit marketplace connecting growers, buyers and logistics partners.",
    email: "support@efruitmandi.live",
    telephone: "+91-7018108900",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "eFruitMandi",
    url: "https://www.efruitmandi.live",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://www.efruitmandi.live/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "eFruitMandi",
    url: "https://www.efruitmandi.live",
    email: "support@efruitmandi.live",
    telephone: "+91-7018108900",
    areaServed: "India",
  },
];

const resolveProfileMediaUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) {
    if (
      window.location.protocol === "https:" &&
      url.startsWith("http://") &&
      !/localhost|127\.0\.0\.1/i.test(url)
    ) {
      return url.replace(/^http:\/\//i, "https://");
    }
    return url;
  }
  const cleanPath = url.replace(/^\/+/, "");
  if (cleanPath.startsWith("uploads/")) return `${FILE_BASE_URL}/${cleanPath}`;
  return url.startsWith("/") ? url : `/${url}`;
};

const CLOUDINARY_UPLOAD_SEGMENT = "/image/upload/";
const CLOUDINARY_TRANSFORM_PATTERN =
  /(^|,)(?:a_|ar_|b_|bo_|c_|co_|d_|dl_|dn_|e_|eo_|f_|fl_|fn_|g_|h_|ki_|l_|o_|q_|r_|so_|t_|u_|vc_|vs_|w_|x_|y_|z_)/;
const LOT_IMAGE_WIDTHS = [360, 420];
const LOT_IMAGE_ASPECT_RATIO = 10 / 14;

const isCloudinaryImageUrl = (url = "") =>
  url.includes("res.cloudinary.com") && url.includes(CLOUDINARY_UPLOAD_SEGMENT);

const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

const hasCloudinaryTransform = (segment = "") =>
  CLOUDINARY_TRANSFORM_PATTERN.test(segment);

const transformCloudinaryImage = (url = "", transform = "") => {
  if (!url || !isCloudinaryImageUrl(url)) return url;

  const suffixMatch = url.match(/[?#].*$/);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const cleanUrl = suffix ? url.slice(0, -suffix.length) : url;
  const [prefix, uploadPath = ""] = cleanUrl.split(CLOUDINARY_UPLOAD_SEGMENT);
  const parts = uploadPath.split("/");
  const pathWithoutTransform = hasCloudinaryTransform(parts[0])
    ? parts.slice(1).join("/")
    : uploadPath;

  return `${prefix}${CLOUDINARY_UPLOAD_SEGMENT}${transform}/${pathWithoutTransform}${suffix}`;
};

const optimizeImageUrl = (url = "", width = 640) =>
  transformCloudinaryImage(url, `f_auto,q_auto:eco,c_limit,w_${width}`);

const optimizeLotImageUrl = (url = "", width = 420) => {
  const height = Math.round(width * LOT_IMAGE_ASPECT_RATIO);
  return transformCloudinaryImage(url, `f_auto,q_auto:eco,c_fill,w_${width},h_${height}`);
};

const buildLotImageSrcSet = (url = "") => {
  if (!isCloudinaryImageUrl(url)) return "";
  return LOT_IMAGE_WIDTHS.map((width) => `${optimizeLotImageUrl(url, width)} ${width}w`).join(", ");
};

const optimizeProfileLogoUrl = (url = "") =>
  transformCloudinaryImage(url, "f_auto,q_auto:eco,c_fit,w_224,h_224");

const policyLinkGroups = [
  {
    title: "Who is eFruitMandi?",
    links: [
      { label: "About Us", path: "/about" },
      { label: "Our Story", path: "/our-story" },
      { label: "Vision & Mission", path: "/vision-mission" },
      { label: "Why eFruitMandi", path: "/why-efruitmandi" },
      { label: "Contact Us", path: "/contact" },
    ],
  },
  {
    title: "Help Center",
    links: [
      { label: "FAQs", path: "/faqs" },
      { label: "Buyer Guide", path: "/buyer-guide" },
      { label: "Grower Guide", path: "/grower-guide" },
      { label: "Logistics Guide", path: "/logistics-partner-guide" },
      { label: "Report a Problem", path: "/report-problem" },
    ],
  },
  {
    title: "Trust & Safety",
    links: [
      { label: "KYC Policy", path: "/kyc-verification-policy" },
      { label: "OG Verified / Trusted Badge", path: "/og-verified-policy" },
      { label: "Community Guidelines", path: "/community-guidelines" },
      { label: "Fruit Grading & Packing Guidelines", path: "/fruit-grading-packing-guidelines" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", path: "/terms-of-service" },
      { label: "Privacy Policy", path: "/privacy-policy" },
      { label: "Refund Policy", path: "/refund-cancellation-policy" },
      { label: "Payment / Escrow Policy", path: "/payment-escrow-policy" },
      { label: "Commission & Fee Policy", path: "/commission-fee-policy" },
      { label: "Shipping & Logistics Policy", path: "/shipping-logistics-policy" },
    ],
  },
  {
  title: "Media & Press Release",
  links: [
    { label: "Media Center", path: "/media" },
    { label: "Press Release", path: "/press-release" },
    { label: "News & Updates", path: "/news-updates" },
    { label: "Horticulture Blog", path: "/blog" },
  ],
},
];

const LOT_OPEN_HOUR = 12;
const LOGIN_REQUIRED_MESSAGE = "Please login first to continue.";
const MOBILE_INITIAL_DEAL_COUNT = 1;
let homeMarketDataPromise = null;
const scheduleAfterPaint = (callback, delay = 0) => {
  let timeoutId;
  const frameId = window.requestAnimationFrame(() => {
    timeoutId = window.setTimeout(callback, delay);
  });

  return () => {
    window.cancelAnimationFrame(frameId);
    if (timeoutId) window.clearTimeout(timeoutId);
  };
};
const fetchHomeMarketData = ({ force = false } = {}) => {
  if (force || !homeMarketDataPromise) {
    homeMarketDataPromise = Promise.all([
      API.get("/products?platform=efruitmandi").catch(() => ({ data: [] })),
      API.get("/auctions").catch(() => ({ data: [] })),
    ]);
  }

  return homeMarketDataPromise;
};

if (typeof window !== "undefined" && window.location.pathname === "/") {
  fetchHomeMarketData();
}

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentUser());
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [publicGrowers, setPublicGrowers] = useState([]);
  const [publicBuyers, setPublicBuyers] = useState([]);
  const [offlineMandiRates, setOfflineMandiRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [ratesError, setRatesError] = useState("");
  const [marketClock, setMarketClock] = useState(() => Date.now());
  const [marketSocket, setMarketSocket] = useState(null);
  const [deferredSectionsReady, setDeferredSectionsReady] = useState(false);
  const fullMarketDataRef = useRef({ products: [], auctions: [] });
  const deferredSectionsReadyRef = useRef(false);
  const isGrower = isGrowerAccount(user);
  const isPublicVisitor = !localStorage.getItem("accessToken");
  const loadMarketData = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const [productRes, auctionRes] = await fetchHomeMarketData({ force: !showLoading });

      const nextProducts = getEfruitMandiProducts(productRes.data);
      const nextAuctions = Array.isArray(auctionRes.data) ? auctionRes.data : [];
      fullMarketDataRef.current = {
        products: nextProducts,
        auctions: nextAuctions,
      };

      if (isMobileViewport() && !deferredSectionsReadyRef.current) {
        const initialData = getInitialMobileMarketData(nextProducts, nextAuctions);
        setProducts(initialData.products);
        setAuctions(initialData.auctions);
        return;
      }

      setProducts(nextProducts);
      setAuctions(nextAuctions);
    } finally {
      setLoading(false);
    }
  }, []);
  const loadSupplementalHomeData = useCallback(async () => {
    setProfilesLoading(true);
    setRatesLoading(true);
    setProfilesError("");
    setRatesError("");

    const [growerRes, buyerRes, ratesRes] = await Promise.all([
      API.get("/user/public-profiles?role=grower&limit=8").catch(() => {
        setProfilesError("Unable to load latest public profiles.");
        return { data: { profiles: [] } };
      }),
      API.get("/user/public-profiles?role=buyer&limit=8").catch(() => {
        setProfilesError("Unable to load latest public profiles.");
        return { data: { profiles: [] } };
      }),
      API.get("/mandi-rates/latest?limit=10").catch(() => {
        setRatesError("Unable to load offline mandi rates.");
        return { data: { records: [] } };
      }),
    ]);

    setPublicGrowers(Array.isArray(growerRes.data?.profiles) ? growerRes.data.profiles : []);
    setPublicBuyers(Array.isArray(buyerRes.data?.profiles) ? buyerRes.data.profiles : []);
    setOfflineMandiRates(Array.isArray(ratesRes.data?.records) ? ratesRes.data.records : []);
    setProfilesLoading(false);
    setRatesLoading(false);
  }, []);

  const openProfileEntry = () => {
    if (localStorage.getItem("accessToken")) {
      navigate("/profile-dashboard");
      return;
    }

    navigate("/profile", { state: { mode: "signup" } });
  };
  const buildLoginState = (from, requiredProfile) => ({
    mode: "login",
    from,
    requiredProfile,
    message: LOGIN_REQUIRED_MESSAGE,
  });
  const openListLotFlow = () => {
    const listPath = "/list-new-lot";
    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(listPath, "grower") });
      return;
    }

    if (!isGrower) {
      navigate("/register-grower", { state: { from: listPath } });
      return;
    }

    navigate(listPath);
  };

  useEffect(() => {
    loadMarketData({ showLoading: true });
  }, [loadMarketData]);

  useEffect(() => {
    deferredSectionsReadyRef.current = deferredSectionsReady;

    if (!deferredSectionsReady || !isMobileViewport()) return;

    const cachedData = fullMarketDataRef.current;
    if (cachedData.products.length || cachedData.auctions.length) {
      setProducts(cachedData.products);
      setAuctions(cachedData.auctions);
    }
  }, [deferredSectionsReady]);

  useEffect(() => {
    const revealDeferredSections = () => setDeferredSectionsReady(true);
    const isMobileHome = window.matchMedia("(max-width: 767px)").matches;

    if (!isMobileHome) {
      return scheduleAfterPaint(revealDeferredSections, 1800);
    }

    let idleId;
    const timerId = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(revealDeferredSections, { timeout: 3000 });
      } else {
        revealDeferredSections();
      }
    }, 10000);

    window.addEventListener("scroll", revealDeferredSections, { passive: true, once: true });
    window.addEventListener("touchstart", revealDeferredSections, { passive: true, once: true });

    return () => {
      window.clearTimeout(timerId);
      if (idleId) window.cancelIdleCallback(idleId);
      window.removeEventListener("scroll", revealDeferredSections);
      window.removeEventListener("touchstart", revealDeferredSections);
    };
  }, []);

  useEffect(() => {
    if (!deferredSectionsReady) return undefined;
    return scheduleAfterPaint(() => loadSupplementalHomeData(), 900);
  }, [deferredSectionsReady, loadSupplementalHomeData]);

  useEffect(() => {
    let active = true;

    const connectMarketSocket = () => {
      import("../services/socket").then(({ default: socket }) => {
        if (!active) return;
        if (!socket.connected) socket.connect();
        setMarketSocket(socket);
      });
    };

    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(connectMarketSocket, { timeout: 8000 });
      } else {
        connectMarketSocket();
      }
    }, 12000);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!marketSocket) return undefined;
    const refreshMarket = () => {
      loadMarketData();
    };
    const handleDealUpdate = ({ dealAmount, auctionId, highestGradeRate, dealBreakdown }) => {
      setAuctions((current) =>
        current.map((auction) =>
          auction._id === auctionId
            ? {
                ...auction,
                currentBid: dealAmount,
                highestGradeRate: highestGradeRate ?? auction.highestGradeRate,
                dealBreakdown: dealBreakdown ?? auction.dealBreakdown,
              }
            : auction
        )
      );
    };

    marketSocket.on("efruitmandiMarketUpdated", refreshMarket);
    marketSocket.on("auctionStarted", refreshMarket);
    marketSocket.on("dealStarted", refreshMarket);
    marketSocket.on("auctionEnded", refreshMarket);
    marketSocket.on("dealEnded", refreshMarket);
    marketSocket.on("dealUpdate", handleDealUpdate);

    return () => {
      marketSocket.off("efruitmandiMarketUpdated", refreshMarket);
      marketSocket.off("auctionStarted", refreshMarket);
      marketSocket.off("dealStarted", refreshMarket);
      marketSocket.off("auctionEnded", refreshMarket);
      marketSocket.off("dealEnded", refreshMarket);
      marketSocket.off("dealUpdate", handleDealUpdate);
    };
  }, [loadMarketData, marketSocket]);

  useEffect(() => {
    const syncLocalUser = () => {
      setUser(getCurrentUser());
    };

    const loadProfile = async () => {
      if (!localStorage.getItem("accessToken")) {
        syncLocalUser();
        return;
      }

      try {
        const res = await API.get("/user/profile");
        const freshUser = res.data || getCurrentUser();
        setUser(freshUser);
        saveUserToStorage(freshUser);
      } catch {
        syncLocalUser();
      }
    };

    loadProfile();

    const handleFocus = () => loadProfile();
    const handleStorage = (event) => {
      if (!event.key || event.key === "user" || event.key === "accessToken") {
        loadProfile();
      }
    };
    const handleVisibility = () => {
      if (!document.hidden) loadProfile();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setMarketClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!marketSocket) return;
    auctions.forEach((auction) => {
      if (auction?._id) marketSocket.emit("joinAuction", auction._id);
    });
  }, [auctions, marketSocket]);

  const lotTiming = useMemo(() => getDailyLotTiming(new Date(marketClock)), [marketClock]);
  const timedProducts = useMemo(
    () => products.map((product) => attachLotTiming(product, lotTiming)),
    [products, lotTiming]
  );
  const auctionDealLots = useMemo(
    () =>
      auctions
        .filter((auction) => auction.product)
        .map((auction) => normalizeAuctionLot(auction, lotTiming)),
    [auctions, lotTiming]
  );
  const allDealListings = useMemo(
    () => mergeUniqueLots([...auctionDealLots, ...timedProducts]),
    [auctionDealLots, timedProducts]
  );
  const liveLots = useMemo(
    () => sortDealsNewestFirst(allDealListings.filter((deal) => isLiveDeal(deal))),
    [allDealListings]
  );
  const upcomingLots = useMemo(
    () => sortDealsNewestFirst(allDealListings.filter((deal) => isUpcomingDeal(deal))),
    [allDealListings]
  );
  const closedLots = useMemo(
    () => sortDealsNewestFirst(allDealListings.filter((deal) => isClosedDeal(deal))),
    [allDealListings]
  );
  const canQuoteFromFeed = isPublicVisitor || hasBuyerProfile(user);
  const canRateFromFeed = hasBuyerProfile(user);
  const currentUserId = user?._id || user?.id || "";
  const openLotDetails = useCallback((lotIdValue) => {
    if (!lotIdValue) return;
    navigate(`/lots/${lotIdValue}`);
  }, [navigate]);
  const openQuoteFlow = useCallback((productId) => {
    if (!productId) return;
    const quotePath = `/lots/${productId}/quote`;
    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(quotePath, "buyer") });
      return;
    }

    if (!hasBuyerProfile(user)) {
      navigate("/register-buyer", { state: { from: quotePath } });
      return;
    }

    if (!canQuote(user)) {
      navigate("/kyc", {
        state: {
          from: quotePath,
          roleType: "buyer",
          intent: "quote",
          message:
            "To keep eFruitMandi safe and trusted, KYC verification is required before placing a quote or deal. Please complete your KYC and wait for admin approval.",
        },
      });
      return;
    }

    navigate(quotePath);
  }, [navigate, user]);
  const openRateGrowerFlow = useCallback((productId) => {
    if (!productId) return;
    const ratingPath = `/lots/${productId}/rating`;
    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(ratingPath, "buyer") });
      return;
    }

    if (!hasBuyerProfile(user)) {
      navigate("/register-buyer", { state: { from: ratingPath } });
      return;
    }

    navigate(ratingPath);
  }, [navigate, user]);

  const openPublicProfileFlow = (profile, role) => {
    const profileId = profile?._id || profile?.id || profile?.userId;
    const profilePath = profileId ? `/profile/${profileId}` : "/profile-dashboard";

    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(profilePath, role) });
      return;
    }

    navigate(profilePath);
  };

  const openRateProfileFlow = (profile, role) => {
    const profileId = profile?._id || profile?.id || profile?.userId;
    const ratingPath = profileId ? `/profile/${profileId}/rating` : "/profile-dashboard";

    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(ratingPath, role) });
      return;
    }

    navigate(ratingPath);
  };

  return (
  <>
    <SEO
  title="eFruitMandi - Fruit Buyers & Growers Marketplace in India"
  description="Connect directly with verified fruit growers, buyers, commission agents, wholesalers, exporters and logistics partners across India."
  canonical="/"
  schema={homePageSchemas}
/>
    <h1 className="sr-only">
  eFruitMandi - Fruit Buyers & Growers Marketplace in India
</h1>

    <FloatingLotActions
        onList={openListLotFlow}
        onBuy={() => navigate("/auctions")}
      />

      <div className="pb-32 pt-2 md:hidden">
        <BannerSlider />

        <FruitIconRail
          className="-mx-3 pt-1"
          onSelect={(name) => navigate(`/search?q=${encodeURIComponent(name)}`)}
        />
        <PublicHomeFeed
          className="pt-2"
          liveLots={liveLots}
          upcomingLots={upcomingLots}
          closedLots={closedLots}
          dealLoading={loading}
          growers={publicGrowers}
          buyers={publicBuyers}
          profilesLoading={profilesLoading}
          profilesError={profilesError}
          rates={offlineMandiRates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
          showProfiles={deferredSectionsReady}
          showRates={deferredSectionsReady}
          deferSecondarySections
          onOpenLotById={openLotDetails}
          onQuoteLot={openQuoteFlow}
          onRateLot={openRateGrowerFlow}
          onOpenProfile={openPublicProfileFlow}
          onRateProfile={openRateProfileFlow}
          canQuoteLot={canQuoteFromFeed}
          canRateLot={canRateFromFeed}
          currentUserId={currentUserId}
        />
      </div>

    <div className="hidden md:block">
      <FruitIconRail
        className="-mx-4 px-4 pb-3"
        onSelect={(name) => navigate(`/search?q=${encodeURIComponent(name)}`)}
      />
    </div>

    <div className="hidden h-[calc(100vh-8.4rem)] w-full gap-5 overflow-hidden md:grid md:grid-cols-[218px_minmax(0,1fr)] lg:grid-cols-[218px_minmax(0,1fr)_314px] xl:grid-cols-[240px_minmax(0,1fr)_340px]">
      <aside className="auto-hide-column-scroll h-full min-h-0 space-y-2.5 overflow-y-auto pr-1 overscroll-contain">
        <ProfileCard
          user={user}
          onOpen={openProfileEntry}
        />
        {deferredSectionsReady && (
          <>
            <StatsCard onOpen={openProfileEntry} />
            <CompanyCard onOpen={openProfileEntry} />
            <PolicyMiniLinks />
          </>
        )}
      </aside>

      <section className="auto-hide-column-scroll min-h-0 min-w-0 space-y-3 overflow-y-auto pr-1 overscroll-contain">
        <BannerSlider />

        <PublicHomeFeed
          liveLots={liveLots}
          upcomingLots={upcomingLots}
          closedLots={closedLots}
          dealLoading={loading}
          growers={publicGrowers}
          buyers={publicBuyers}
          profilesLoading={profilesLoading}
          profilesError={profilesError}
          rates={offlineMandiRates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
          showProfiles={deferredSectionsReady}
          onOpenLotById={openLotDetails}
          onQuoteLot={openQuoteFlow}
          onRateLot={openRateGrowerFlow}
          onOpenProfile={openPublicProfileFlow}
          onRateProfile={openRateProfileFlow}
          canQuoteLot={canQuoteFromFeed}
          canRateLot={canRateFromFeed}
          currentUserId={currentUserId}
        />
      </section>

      <aside className="auto-hide-column-scroll hidden h-full min-h-0 space-y-2.5 overflow-y-auto pr-1 overscroll-contain lg:block">
        {deferredSectionsReady && (
          <>
            <OfflineMandiRatesCard
              rates={offlineMandiRates}
              loading={ratesLoading}
              error={ratesError}
            />
            <AdCard user={user} onListLot={openListLotFlow} />
          </>
        )}
      </aside>
    </div>
    </>
  );
}

function HeroCard({ onList }) {
  return (
    <section className="-mx-0 mt-2 rounded-[18px] bg-white shadow-sm ring-1 ring-green-100">
      <div className="relative overflow-hidden rounded-[28px]">
        <img
          src={orchardCover}
          alt="Fresh orchard fruits"
          width="1200"
          height="528"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-44 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/75 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-200">
            Market updates from the mandi
          </p>
          <h2 className="mt-2 text-xl font-black leading-tight">
  Search lots, fruit, mandi...
</h2>
          <p className="mt-2 max-w-xl text-sm text-green-100">
            Discover live fruit lots, upcoming deals and trusted growers across the market.
          </p>
          <button
            type="button"
            onClick={onList}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-black uppercase text-green-950 shadow-lg shadow-amber-300/50 transition hover:bg-amber-300"
          >
            List a fruit lot
          </button>
        </div>
      </div>
    </section>
  );
}

function FruitIconRail({ className = "", onSelect }) {
  const railRef = useRef(null);
  const scroll = (direction) => {
    railRef.current?.scrollBy({
      left: direction * 280,
      behavior: "smooth",
    });
  };

  return (
    <section className={className} aria-label="Browse fruits">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-green-800 hover:bg-green-50 md:ml-0"
          aria-label="Scroll fruit icons left"
        >
          <FaChevronLeft />
        </button>
        <div
          ref={railRef}
          className="no-scrollbar flex flex-1 gap-3 overflow-x-auto scroll-smooth px-1 py-1"
        >
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              onClick={() => onSelect?.(category.name)}
              className="flex min-w-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-transparent px-1 py-1.5 text-center transition hover:bg-green-50"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {category.icon}
              </span>
              <span className="max-w-[54px] truncate text-[8px] font-semibold text-gray-950">
                {category.name}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => scroll(1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-green-800 hover:bg-green-50 md:mr-0"
          aria-label="Scroll fruit icons right"
        >
          <FaChevronRight />
        </button>
      </div>
    </section>
  );
}

function FloatingLotActions({ onList, onBuy }) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div className="fixed inset-x-2 bottom-[calc(3.85rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-2 gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:flex md:w-52 md:flex-col md:pt-7">
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="absolute right-1 -top-7 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[11px] text-green-800 shadow md:right-0 md:top-0"
        aria-label="Hide lot action buttons"
      >
        <FaTimes />
      </button>
      <button
        type="button"
        onClick={onList}
        className="min-h-10 min-w-0 rounded-full border border-green-700/30 bg-green-700/90 px-2 text-center text-[10px] font-black leading-tight text-white shadow-lg backdrop-blur transition hover:bg-green-800 sm:text-[11px] md:flex-none md:px-3"
      >
        List a fruit lot
      </button>
      <button
        type="button"
        onClick={onBuy}
        className="min-h-10 min-w-0 rounded-full border border-green-700/30 bg-green-700/90 px-2 text-center text-[10px] font-black leading-tight text-white shadow-lg backdrop-blur transition hover:bg-green-800 sm:text-[11px] md:flex-none md:px-3"
      >
        Buy Bulk Fruit Lots
      </button>
    </div>
  );
}

function PublicHomeFeed({
  className = "",
  liveLots = [],
  upcomingLots = [],
  closedLots = [],
  dealLoading,
  growers = [],
  buyers = [],
  profilesLoading,
  profilesError,
  rates = [],
  ratesLoading,
  ratesError,
  showProfiles = true,
  showRates = false,
  deferSecondarySections = false,
  onOpenLotById,
  onQuoteLot,
  onRateLot,
  onOpenProfile,
  onRateProfile,
  canQuoteLot,
  canRateLot,
  currentUserId,
}) {
  const dealSections = [
    {
      key: "live",
      title: "Live Fruit Deals",
      emptyText: "No live fruit deals right now. Fresh mandi deals will appear here.",
      deals: liveLots,
    },
    {
      key: "upcoming",
      title: "Upcoming Fruit Deals",
      emptyText: "No upcoming fruit deals yet. Scheduled lots will appear here.",
      deals: upcomingLots,
    },
    {
      key: "closed",
      title: "Recently Closed Deals",
      emptyText: "No recently closed deals yet. Closed deals will appear here.",
      deals: closedLots,
    },
  ];
  const primaryDealSection = deferSecondarySections
    ? dealSections.find((section) => section.deals.length) || dealSections[0]
    : dealSections[0];
  const deferredDealSections = deferSecondarySections
    ? dealSections.filter((section) => section.key !== primaryDealSection.key)
    : dealSections.slice(1);
  const renderDealSection = (section, extraProps = {}) => (
    <PublicDealList
      key={section.key}
      title={section.title}
      emptyText={section.emptyText}
      deals={section.deals}
      loading={dealLoading}
      onOpenLotById={onOpenLotById}
      onQuoteLot={onQuoteLot}
      onRateLot={onRateLot}
      canQuoteLot={canQuoteLot}
      canRateLot={canRateLot}
      currentUserId={currentUserId}
      {...extraProps}
    />
  );
  const secondaryDealSections = (
    <>
      {deferredDealSections.map((section) => renderDealSection(section))}
    </>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {renderDealSection(primaryDealSection, {
        initialItemLimit: deferSecondarySections ? MOBILE_INITIAL_DEAL_COUNT : undefined,
        deferRemaining: deferSecondarySections,
        priorityFirstImage: true,
      })}

      {deferSecondarySections ? (
        <DeferredFeedMount enabled>{secondaryDealSections}</DeferredFeedMount>
      ) : (
        secondaryDealSections
      )}

      {showProfiles && (
        <>
          <PublicProfilesSection
            title="Latest Registered Buyers"
            role="buyer"
            profiles={buyers}
            loading={profilesLoading}
            error={profilesError}
            emptyText="Latest buyer profiles will appear soon."
            onOpenProfile={onOpenProfile}
            onRateProfile={onRateProfile}
          />

          <PublicProfilesSection
            title="Latest Registered Growers"
            role="grower"
            profiles={growers}
            loading={profilesLoading}
            error={profilesError}
            emptyText="Latest grower profiles will appear soon."
            onOpenProfile={onOpenProfile}
            onRateProfile={onRateProfile}
          />
        </>
      )}

      {showRates && (
        <OfflineMandiRatesCard
          rates={rates}
          loading={ratesLoading}
          error={ratesError}
        />
      )}
    </div>
  );
}

function DeferredFeedMount({ enabled = false, children }) {
  const [visible, setVisible] = useState(!enabled);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return undefined;
    }

    if (visible) return undefined;

    let observer;
    const reveal = () => setVisible(true);
    const marker = markerRef.current;

    if ("IntersectionObserver" in window && marker) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) reveal();
        },
        { rootMargin: "0px 0px -20% 0px", threshold: 0 }
      );
      observer.observe(marker);
    }

    window.addEventListener("scroll", reveal, { passive: true, once: true });
    window.addEventListener("touchstart", reveal, { passive: true, once: true });

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("touchstart", reveal);
    };
  }, [enabled, visible]);

  if (visible) return children;

  return <div ref={markerRef} className="h-px" aria-hidden="true" />;
}

function PublicDealList({
  title,
  deals = [],
  loading,
  emptyText,
  onOpenLotById,
  onQuoteLot,
  onRateLot,
  canQuoteLot,
  canRateLot,
  currentUserId,
  initialItemLimit,
  deferRemaining = false,
  priorityFirstImage = false,
}) {
  const hasItemLimit = Number.isFinite(initialItemLimit);
  const visibleDeals = hasItemLimit ? deals.slice(0, initialItemLimit) : deals;
  const remainingDeals = hasItemLimit ? deals.slice(initialItemLimit) : [];
  const renderDeal = (deal, index, imagePriority = false) => (
    <DesktopLotPost
      key={getLotDetailId(deal) || deal.id || deal.lotNo || deal.title}
      items={[deal]}
      emptyText={emptyText}
      onOpenLot={onOpenLotById}
      onQuoteLot={onQuoteLot}
      onRateLot={onRateLot}
      canQuoteLot={canQuoteLot}
      canRateLot={canRateLot}
      currentUserId={currentUserId}
      imagePriority={imagePriority && index === 0}
    />
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-black md:text-base">{title}</h2>
        <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-green-800">
          Latest First
        </span>
      </div>

      {loading ? (
        <PublicFeedSkeleton count={hasItemLimit ? initialItemLimit : 2} />
      ) : visibleDeals.length ? (
        <div className="space-y-3">
          {visibleDeals.map((deal, index) => renderDeal(deal, index, priorityFirstImage))}
          {remainingDeals.length > 0 && (
            <DeferredFeedMount enabled={deferRemaining}>
              <div className="space-y-3">
                {remainingDeals.map((deal, index) => renderDeal(deal, index, false))}
              </div>
            </DeferredFeedMount>
          )}
        </div>
      ) : (
        <DesktopEmptyState text={emptyText} />
      )}
    </section>
  );
}

function PublicFeedSkeleton({ count = 2 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, item) => (
        <div key={item} className="min-h-[480px] animate-pulse rounded-lg border border-gray-200 bg-white p-4 md:min-h-0">
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-gray-100" />
          <div className="mt-4 h-[300px] rounded-md bg-green-50 md:h-72" />
          <div className="mt-4 h-3 w-3/4 rounded bg-gray-100" />
          <div className="mt-3 h-9 rounded-md bg-green-50" />
        </div>
      ))}
    </div>
  );
}

function PublicProfilesSection({ title, role, profiles = [], loading, error, emptyText, onOpenProfile, onRateProfile }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-extrabold text-black md:text-base">{title}</h2>
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => (
            <div key={item} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-gray-200" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-3/4 rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <DesktopEmptyState text={error} />
      ) : profiles.length ? (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <PublicProfileCard
              key={profile._id || `${role}-${profile.companyName || profile.name}`}
              profile={profile}
              role={role}
              onOpenProfile={onOpenProfile}
              onRateProfile={onRateProfile}
            />
          ))}
        </div>
      ) : (
        <DesktopEmptyState text={emptyText} />
      )}
    </section>
  );
}

function PublicProfileCard({ profile, role, onOpenProfile, onRateProfile }) {
  const safeProfile = getSafePublicProfile({ ...profile, businessType: role });
  const displayName =
    safeProfile.companyName ||
    safeProfile.orchardName ||
    safeProfile.businessName ||
    safeProfile.name ||
    (role === "grower" ? "Grower Profile" : "Buyer Profile");
  const location = safeProfile.mainLocation || safeProfile.city || safeProfile.state || "India";
  const imageUrl = optimizeProfileLogoUrl(
    resolveProfileMediaUrl(
      safeProfile.logoUrl || safeProfile.profileImage || safeProfile.avatar
    )
  );
  const badgeText = role === "grower" ? "Registered Grower" : "Registered Buyer";
  const roleTitle = role === "grower" ? "Fruit Grower Profile" : "Fruit Buyer Profile";

  return (
    <article className="overflow-hidden border border-gray-200 bg-white md:rounded-md">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-base font-extrabold text-black">
              {displayName}
            </h3>
            <p className="mt-1 truncate text-sm font-semibold text-gray-600">
              {location}
            </p>
            <p className="mt-2 text-sm font-bold text-black">
              {roleTitle}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded bg-green-100 px-2 py-1 text-[10px] font-extrabold uppercase text-green-800">
              {badgeText}
            </span>
            {safeProfile.isOgVerified && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700">
                <FaShieldAlt />
                OG Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-64 items-center justify-center bg-gradient-to-br from-green-50 via-white to-amber-50 p-4 md:h-80">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            width="224"
            height="224"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <Avatar
            name={displayName}
            imageUrl={imageUrl}
            className="h-24 w-24 border-4 border-white text-3xl shadow-lg"
          />
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="grid gap-2 rounded-md bg-green-50 px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-extrabold text-gray-950">{displayName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-gray-600">
              <span>{location}</span>
              <span>{role === "grower" ? "Latest registered grower" : "Latest registered buyer"}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => onOpenProfile?.(safeProfile, role)}
              className="min-w-0 rounded-full bg-white px-2 py-2 text-[10px] font-extrabold leading-tight text-green-800 ring-1 ring-green-200 hover:bg-green-100 sm:px-3 sm:text-[11px]"
            >
              View Profile
            </button>
            <button
              type="button"
              onClick={() => onRateProfile?.(safeProfile, role)}
              className="min-w-0 rounded-full bg-green-700 px-2 py-2 text-[10px] font-extrabold leading-tight text-white hover:bg-green-800 sm:px-3 sm:text-[11px]"
            >
              {role === "grower" ? "Rate Grower" : "Rate Buyer"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MobileSectionContent({
  activeTab,
  visibleListings,
  upcomingLots,
  highestDeals,
  dealDisplayGroup,
  selectedInfoSection,
  onOpenLotById,
  onQuoteLot,
  onRateLot,
  onOpenProfile,
  onRateProfile,
}) {
  if (activeTab === "highestDeals") {
    return (
      <div className="px-3">
        <HighestDealsSection items={highestDeals} />
      </div>
    );
  }

  if (selectedInfoSection) {
    return (
      <div className="px-3">
        <InfoSection title={selectedInfoSection.title} text={selectedInfoSection.text} />
      </div>
    );
  }

  const filteredListings = getMobileFilterListings(activeTab, visibleListings, upcomingLots);
  const emptyTextByTab = {
    liveLots: "No live fruit lots yet.",
    upcomingLots: "No upcoming fruit lots yet.",
    trustedGrowers: "No trusted grower live lots yet.",
    organicFarms: "No organic farm live lots yet.",
  };

  return (
    <section className="-mx-3 mt-1">
      {activeTab === "liveLots" && (
        <h2 className="px-3 pb-2 text-sm font-extrabold text-black">
          {dealDisplayGroup?.title || "Live Fruit Deals"}
        </h2>
      )}
      <DesktopLotPost
        items={filteredListings}
        emptyText={
          activeTab === "liveLots"
            ? dealDisplayGroup?.emptyText || emptyTextByTab.liveLots
            : emptyTextByTab[activeTab] || emptyTextByTab.liveLots
        }
        onOpenLot={onOpenLotById}
        onQuoteLot={onQuoteLot}
        onRateLot={onRateLot}
      />
    </section>
  );
}

function getMobileFilterListings(activeTab, liveLots, upcomingLots) {
  if (activeTab === "upcomingLots") return upcomingLots;
  if (activeTab === "trustedGrowers") {
    return liveLots.filter((lot) =>
      Boolean(
        lot.createdBy?.ogVerificationByRole?.grower?.requestId &&
          String(lot.createdBy?.ogVerificationByRole?.grower?.status || "").toUpperCase() === "APPROVED" ||
          lot.createdBy?.trusted
      )
    );
  }
  if (activeTab === "organicFarms") {
    return liveLots.filter((lot) => isOrganicLot(lot));
  }
  return liveLots;
}

function isOrganicLot(lot = {}) {
  const quality = String(lot.quality || "").toLowerCase();
  return (
    quality.includes("organic") ||
    Boolean(lot.organicCertificationNo || lot.organicCertificateUrl)
  );
}

function getHighestDealsByCategory(auctions) {
  const result = {};

  auctions.forEach((auction) => {
    const product = auction.product || {};
    const title = product.title || "";
    const category =
      categoryKeywords.find((keyword) =>
        title.toLowerCase().includes(keyword.toLowerCase())
      ) || "Other Fruit";
    const dealPrice = Number(auction.currentBid || auction.startingPrice || 0);

    if (!dealPrice) return;

    if (!result[category] || dealPrice > result[category].amount) {
      result[category] = {
        category,
        amount: dealPrice,
        title: title || "Fruit Lot",
        location: product.location || "Fruit Mandi",
      };
    }
  });

  return Object.values(result).sort((a, b) => b.amount - a.amount);
}

function ListingScroller({ items, emptyText, onView }) {
  if (!items.length) return <MobileEmptyState text={emptyText} icon={<FaSeedling />} />;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {items.slice(0, 6).map((product) => (
        <MarketCard
          key={product._id}
          item={product}
          badge={formatLotStatus(product.status)}
          buttonLabel="View Listing"
          icon={<FaSeedling />}
          onView={() => onView(product)}
          showPrice={false}
        />
      ))}
    </div>
  );
}

function MarketCard({ item, amount, badge, buttonLabel, icon, onView, showPrice = true }) {
  const image = Array.isArray(item.images) ? item.images[0] : "";
  const normalizedImage = image ? image.replace(/\\/g, "/") : "";
  const imageUrl = normalizedImage
    ? /^https?:\/\//i.test(normalizedImage)
      ? normalizedImage
      : `${FILE_BASE_URL}/${normalizedImage}`
    : "";

  return (
    <article className="min-w-[165px] rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-green-100">
        {imageUrl ? (
          <img
            src={optimizeImageUrl(imageUrl, 360)}
            alt={item.title}
            width="165"
            height="124"
            className="h-full w-full object-contain"
            loading="lazy"
decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-green-700">
            {icon}
          </div>
        )}
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="line-clamp-1 text-xs font-extrabold text-black">
          {item.title || "Fruit Lot"}
        </h3>
        <span className={`rounded px-2 py-0.5 text-[8px] font-extrabold ${getLotStatusBadgeClass(item)}`}>
          {formatLotStatus(item.status, item.dealTiming)}
        </span>
      </div>

      <p className="truncate text-[10px] font-bold text-gray-600">
        {item.location || "Fruit Mandi"}
      </p>
      <p className="text-[10px] font-bold text-black">
        {item.quantity || 0} Box Lot
      </p>
      <LotCountdownText timing={item.dealTiming} compact />
      {showPrice && (
        <p className="text-[10px] font-bold text-black">
          Rs. {amount || 0} Per box
        </p>
      )}

      <button
        type="button"
        onClick={onView}
        className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1 text-[9px] font-bold text-gray-700"
      >
        <FaEye />
        {buttonLabel}
      </button>
    </article>
  );
}

function HighestDealsSection({ items }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-extrabold text-black">
        Highest Deals of The Day
      </h2>

      {!items.length ? (
        <MobileEmptyState
          text="No highest deal recorded today for fruit or dryfruit categories."
          icon={<FaGavel />}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {items.map((item) => (
            <article
              key={item.category}
              className="min-w-[165px] rounded-md border border-gray-200 bg-white p-3"
            >
              <p className="text-xs font-extrabold text-green-800">
                {item.category}
              </p>
              <h3 className="mt-1 line-clamp-1 text-xs font-extrabold text-black">
                {item.title}
              </h3>
              <p className="truncate text-[10px] font-bold text-gray-600">
                {item.location}
              </p>
              <p className="mt-2 text-sm font-extrabold text-black">
                Rs. {item.amount}
              </p>
              <p className="text-[9px] font-bold text-gray-500">
                Highest deal
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MobileEmptyState({ text, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <span className="text-lg">{icon}</span>
      <p className="text-xs font-bold">{text}</p>
    </div>
  );
}

function InfoSection({ title, text }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-extrabold text-black">{title}</h2>
      <MobileEmptyState text={text} icon={<FaSeedling />} />
    </section>
  );
}

function DesktopSection({
  section,
  feedItems,
  visibleListings,
  upcomingLots,
  highestDeals,
  dealDisplayGroup,
  selectedInfoSection,
  onAdd,
  onOpenLot,
  onQuoteLot,
  onRateLot,
  onOpenProfile,
  onRateProfile,
}) {
  if (section === "liveLots") {
    const sectionTextByGroup = {
      live: "Fresh orchard deals available for mandi buyers.",
      upcoming: "Scheduled deals will open for price quoting automatically at their live time.",
      closed: "Recently closed fruit deals remain available to review.",
      empty: "Fresh orchard deals available for mandi buyers.",
    };

    return (
      <WebSectionPost
        title={dealDisplayGroup?.title || "Live Fruit Deals"}
        text={sectionTextByGroup[dealDisplayGroup?.key] || sectionTextByGroup.empty}
      >
        <DesktopLotPost
          items={visibleListings}
          emptyText={dealDisplayGroup?.emptyText || "No fruit deal yet. New mandi deals will appear here."}
          onOpenLot={onOpenLot}
          onQuoteLot={onQuoteLot}
          onRateLot={onRateLot}
        />
      </WebSectionPost>
    );
  }

  if (section === "upcomingLots") {
    return (
      <WebSectionPost
        title="Upcoming Fruit Deals"
        text="Scheduled lots will open for price quoting automatically at their live time."
      >
        <DesktopLotPost
          items={upcomingLots}
          emptyText="No upcoming fruit lot yet. Scheduled lots will appear here."
          onOpenLot={onOpenLot}
          onQuoteLot={onQuoteLot}
          onRateLot={onRateLot}
        />
      </WebSectionPost>
    );
  }

  if (section === "highestDeals") {
    return (
      <WebSectionPost
        title="Highest Deals of The Day"
        text="Track the best deal price activity from current mandi deals."
      >
        {!highestDeals.length ? (
          <DesktopEmptyState text="No highest deal recorded today for fruit or dryfruit categories." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {highestDeals.map((item) => (
              <article key={item.category} className="rounded-md border border-gray-200 p-3">
                <p className="text-xs font-extrabold text-green-800">{item.category}</p>
                <h3 className="mt-1 line-clamp-1 text-sm font-bold text-black">{item.title}</h3>
                <p className="truncate text-xs font-semibold text-gray-600">{item.location}</p>
                <p className="mt-3 text-base font-extrabold text-black">Rs. {item.amount}</p>
                <p className="text-[10px] font-bold text-gray-500">Highest deal</p>
              </article>
            ))}
          </div>
        )}
      </WebSectionPost>
    );
  }

  if (selectedInfoSection) {
    return (
      <WebSectionPost
        title={selectedInfoSection.title}
        text="This section will update as verified marketplace activity grows."
      >
        <DesktopEmptyState text={selectedInfoSection.text} />
      </WebSectionPost>
    );
  }

  if (!feedItems.length) {
    return <EmptyFeed onAdd={onAdd} />;
  }

  return feedItems.slice(0, 4).map((item) => (
    <FeedPost
      key={item.id}
      item={item}
      onOpen={() => onOpenLot(item.productId)}
    />
  ));
}

function WebSectionPost({ title, text, children }) {
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-green-800 text-xs font-bold text-white">
            OG
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
            <p className="flex items-center gap-1 text-xs text-gray-600">
              19h <span>-</span> <FaGlobeAmericas className="text-[11px]" />
            </p>
          </div>
          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="Section options">
            <FaEllipsisH />
          </button>
          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="Close section">
            <FaTimes />
          </button>
        </div>

        <p className="mt-3 text-sm leading-5 text-gray-900">{text}</p>
      </div>
      <div className="border-t border-gray-100 p-3">{children}</div>
    </article>
  );
}

function DesktopLotPost({
  items,
  emptyText,
  onOpenLot,
  onQuoteLot,
  onRateLot,
  canQuoteLot = true,
  canRateLot = true,
  currentUserId = "",
  imagePriority = false,
}) {
  const [showAllDetails, setShowAllDetails] = useState(false);
  if (!items.length) return <DesktopEmptyState text={emptyText} />;

  const product = items[0];
  const detailId = getLotDetailId(product);
  const productId = getLotProductId(product);
  const images = getProductImages(product);
  const lotDetails = getLotDetails(product);
  const visibleDetails = showAllDetails ? lotDetails : [];
  const growerName =
    product.createdBy?.orchardName ||
    product.createdBy?.businessName ||
    product.createdBy?.name ||
    "Grower's Orchard";
  const rating = Number(product.createdBy?.rating || product.growerRating || 0);
  const growerRating = Number(product.createdBy?.growerRatingAverage || rating || 0);
  const growerRatingCount = Number(product.createdBy?.growerRatingCount || 0);
  const closedDeal = isClosedDeal(product);
  const liveDeal = isLiveDeal(product);
  const isOwnLot = currentUserId && getLotOwnerId(product) === String(currentUserId);
  const showQuoteAction = liveDeal && canQuoteLot && !isOwnLot;
  const showRateAction = liveDeal && canRateLot && !isOwnLot;

  return (
    <article className="min-h-[480px] overflow-hidden border border-gray-200 bg-white md:min-h-0 md:rounded-md">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenLot(detailId)}
            disabled={!detailId}
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="line-clamp-1 text-base font-extrabold text-black">
              {product.title || "Fruit Lot"}
            </h3>
            <p className="mt-1 truncate text-sm font-semibold text-gray-600">
              {product.location || "Fruit Mandi"}
            </p>
            <p className="mt-2 text-sm font-bold text-black">
              {product.quantity || 0} Box Lot
            </p>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`rounded px-2 py-1 text-[10px] font-extrabold ${getLotStatusBadgeClass(product)}`}>
              {formatLotStatus(product.status, product.dealTiming)}
            </span>
            <LotCountdownText timing={product.dealTiming} />
          </div>
        </div>

        {visibleDetails.length > 0 && (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            {visibleDetails.map((detail) => (
              <div key={detail.label} className="rounded-md bg-gray-50 px-3 py-2">
                <p className="font-bold text-gray-500">{detail.label}</p>
                <p className="mt-0.5 font-extrabold text-gray-950">{detail.value}</p>
              </div>
            ))}
          </div>
        )}

        {lotDetails.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllDetails((value) => !value)}
            className="mt-3 text-xs font-extrabold text-green-700 hover:text-green-800"
          >
            {showAllDetails ? "Show less" : "Show Full Lot Information........"}
          </button>
        )}
      </div>
      <DesktopLotImageCarousel
        images={images}
        product={product}
        title={product.title || "Fruit Lot"}
        onOpen={() => onOpenLot(detailId)}
        imagePriority={imagePriority}
      />
      <div className="border-t border-gray-100 p-3">
        <div className="grid gap-2 rounded-md bg-green-50 px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-extrabold text-gray-950">{growerName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-gray-600">
              <span className="inline-flex items-center gap-1 text-amber-600">
                <FaStar />
                {growerRating ? `${growerRating.toFixed(1)} (${growerRatingCount})` : "No rating yet"}
              </span>
              <span>{product.location || "Fruit Mandi"}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {showRateAction && (
              <button
                type="button"
                onClick={() => onRateLot(productId)}
                disabled={!productId}
                className="min-w-0 rounded-full bg-white px-2 py-2 text-[10px] font-extrabold leading-tight text-green-800 ring-1 ring-green-200 hover:bg-green-100 sm:px-3 sm:text-[11px]"
              >
                Rate Grower
              </button>
            )}
            {showQuoteAction ? (
              <button
                type="button"
                onClick={() => onQuoteLot(productId)}
                disabled={!productId}
                className="min-w-0 rounded-full bg-green-700 px-2 py-2 text-[10px] font-extrabold leading-tight text-white hover:bg-green-800 sm:px-3 sm:text-[11px]"
              >
                Quote Your Price
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenLot(detailId)}
                disabled={!detailId}
                className="min-w-0 rounded-full bg-white px-2 py-2 text-[10px] font-extrabold leading-tight text-green-800 ring-1 ring-green-200 hover:bg-green-100 sm:px-3 sm:text-[11px]"
              >
                {closedDeal ? "View Closed Deal" : "View Details"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function DesktopLotImageCarousel({ images, product, title, onOpen, imagePriority = false }) {
  const [activeImage, setActiveImage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  if (!images.length) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-[420px] w-full items-center justify-center bg-green-50 text-4xl text-green-700"
        aria-label={`Open ${title}`}
      >
        <FaSeedling />
      </button>
    );
  }

  const showPrevious = (event) => {
    event.stopPropagation();
    setActiveImage((current) => (current === 0 ? images.length - 1 : current - 1));
  };
  const showNext = (event) => {
    event.stopPropagation();
    setActiveImage((current) => (current + 1) % images.length);
  };
  const openPreview = () => {
    setZoom(1);
    setPreviewOpen(true);
  };
  const activeImageUrl = images[activeImage];
  const gradeLabel = getImageGradeLabel(product, activeImageUrl);
  const lotImageSrcSet = buildLotImageSrcSet(activeImageUrl);

  return (
    <div className="relative bg-white">
      <button
        type="button"
        onClick={openPreview}
        className="flex h-[300px] w-full items-center justify-center bg-white sm:h-[380px] md:h-[560px]"
        aria-label={`Open ${title}`}
      >
        <span className="relative inline-flex max-h-full max-w-full">
          <img
            src={optimizeLotImageUrl(activeImageUrl, 420)}
            srcSet={lotImageSrcSet || undefined}
            sizes="(max-width: 767px) 420px, 640px"
            alt={`${title} ${activeImage + 1}`}
            width="420"
            height="300"
            className="h-full w-full object-cover md:max-h-full md:max-w-full md:object-contain"
            loading={imagePriority ? "eager" : "lazy"}
            fetchPriority={imagePriority ? "high" : "low"}
            decoding={imagePriority ? "sync" : "async"}
          />
          {gradeLabel && <FruitGradeBadge label={gradeLabel} />}
        </span>
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-xl text-slate-700 shadow hover:bg-white"
            aria-label="Show previous lot image"
          >
            <FaChevronLeft />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-xl text-slate-700 shadow hover:bg-white"
            aria-label="Show next lot image"
          >
            <FaChevronRight />
          </button>
        </>
      )}
      {previewOpen && (
        <ImageZoomModal
          imageUrl={images[activeImage]}
          title={title}
          zoom={zoom}
          onZoomIn={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
          onZoomOut={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
          onReset={() => setZoom(1)}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function ImageZoomModal({ imageUrl, title, zoom, onZoomIn, onZoomOut, onReset, onClose }) {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-black/90 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-extrabold text-white">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onZoomOut} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900" aria-label="Zoom out">
            <FaSearchMinus />
          </button>
          <button type="button" onClick={onReset} className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-gray-900">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onZoomIn} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900" aria-label="Zoom in">
            <FaSearchPlus />
          </button>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900" aria-label="Close image preview">
            <FaTimes />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md bg-black">
        <img
          src={optimizeImageUrl(imageUrl, 1200)}
          alt={title}
          width="1200"
          height="900"
          className="max-h-full max-w-full object-contain transition-transform"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

function DesktopEmptyState({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <FaSeedling className="text-lg" />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}

function ProfileCard({ user, onOpen }) {
  const hasProfileSession = Boolean(
    localStorage.getItem("accessToken") &&
      user &&
      (user._id || user.email || user.phone || user.name)
  );
  const isGrower = hasGrowerProfile(user);
  const isBuyer = hasBuyerProfile(user);
  const isDriver = hasDriverProfile(user);
  const isTrustedAccount = isGrower
    ? Boolean(
        user.ogVerificationByRole?.grower?.requestId &&
          String(user.ogVerificationByRole?.grower?.status || "").toUpperCase() === "APPROVED"
      )
    : isBuyer
      ? Boolean(
          user.ogVerificationByRole?.buyer?.requestId &&
            String(user.ogVerificationByRole?.buyer?.status || "").toUpperCase() === "APPROVED"
        )
      : isDriver
        ? Boolean(
            user.ogVerificationByRole?.driver?.requestId &&
              String(user.ogVerificationByRole?.driver?.status || "").toUpperCase() === "APPROVED"
          )
        : false;
  const firmName = isGrower
    ? user.orchardName
    : isBuyer
      ? user.businessName
      : isDriver
        ? user.logisticsName
        : "";
  const displayName = firmName || user.name || "Visitor";
  const ownerName = user.name || "Guest User";
  const location = user.location || (firmName ? "Mandi, Himachal Pradesh" : "Location not available");
  const joinedLabel = formatJoinDate(user.createdAt);
  const bannerUrl = hasProfileSession ? resolveProfileMediaUrl(user.bannerUrl) || orchardCover : "";
  const avatarUrl = hasProfileSession ? resolveProfileMediaUrl(user.avatarUrl) : "";
  const accountLabel = isGrower
    ? "Growers Profile Dashboard"
    : isBuyer
      ? "Buyer Profile Dashboard"
      : isDriver
        ? "Logistic Partner Profile Dashboard"
        : "User Profile Dashboard";
  const roleLabel = isGrower
    ? "Grower account"
    : isBuyer
      ? "Buyer account"
      : isDriver
        ? "Logistic partner account"
        : "Visitor account";

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="block w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-green-300 hover:shadow-sm"
    >
      <div
        className="group relative h-20 bg-gray-100 bg-cover bg-center"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
      />
      <div className="px-4 pb-4">
        {avatarUrl && (
          <div className="relative -mt-10 h-20 w-20">
            <Avatar
              name={displayName}
              imageUrl={avatarUrl}
              className="h-20 w-20 border-2 border-white text-2xl"
            />
          </div>
        )}
        <h2 className="mt-3 flex items-center gap-1 text-xl font-semibold leading-tight text-gray-900">
          {displayName}
          {isTrustedAccount && <FaShieldAlt className="text-sm text-green-700" />}
        </h2>
        <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-green-700">
          {accountLabel}
        </p>
        {firmName && (
          <p className="mt-1 text-xs font-semibold leading-4 text-gray-800">
            Owner: {ownerName}
          </p>
        )}
        {!firmName && (
          <p className="mt-1 text-xs font-semibold leading-4 text-gray-800">
            {roleLabel}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">{location}</p>
        <p className="mt-2 text-xs font-semibold text-gray-700">
          Since with us: {joinedLabel}
        </p>
        {isTrustedAccount && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-extrabold text-green-800">
            <FaShieldAlt className="text-green-700" />
            OG Verified
          </div>
        )}
      </div>
    </section>
  );
}

function StatsCard({ onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-lg border border-gray-200 bg-white p-4 text-left text-xs transition hover:border-green-300 hover:shadow-sm"
    >
      <div className="flex justify-between gap-3 py-1.5">
        <span className="font-semibold text-gray-800">Profile Impression</span>
        <span className="font-bold text-green-700">0</span>
      </div>
      <div className="flex justify-between gap-3 py-1.5">
        <span className="font-semibold text-gray-800">Profile visitor</span>
        <span className="font-bold text-green-700">0</span>
      </div>
    </button>
  );
}

function CompanyCard({ onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-green-300 hover:shadow-sm"
    >
      <img src={logoUrl} alt="Orchard Growers logo" width="80" height="32" className="mb-8 h-8 w-20 object-contain" />
      <h2 className="text-base font-semibold text-gray-900">Orchard Growers</h2>
      <p className="mt-2 text-xs text-gray-600">Agriculture marketplace updates and fruit lots.</p>
    </button>
  );
}

function FruitGradeBadge({ label }) {
  return (
    <span className="absolute left-3 top-3 rounded bg-green-800 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow">
      {label}
    </span>
  );
}

function PolicyMiniLinks() {
  return (
    <nav className="space-y-3 px-1 text-xs font-semibold leading-5 text-gray-500" aria-label="eFruitMandi policy links">
      {policyLinkGroups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-700">
            {group.title}
          </h2>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {group.links.map((link) => (
              <Link key={link.path} to={link.path} className="hover:text-green-700 hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h2 className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-700">
          Data Deletion Policy
        </h2>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <Link to="/user-data-deletion" className="hover:text-green-700 hover:underline">
            User Data Deletion
          </Link>
        </div>
      </section>
      <p>(c) eFruitMandi All rights reserved. A Product by Orchard Growers Pvt. Ltd.</p>
    </nav>
  );
}

function FeedPost({ item, onOpen }) {
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="p-3 pb-0">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-green-800 text-xs font-bold text-white">
            {item.brand.slice(0, 3)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-gray-900">{item.brand}</h2>
            <p className="flex items-center gap-1 text-xs text-gray-600">
              {item.timeLabel} <span>-</span> <FaGlobeAmericas className="text-[11px]" />
            </p>
          </div>
          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="Post options">
            <FaEllipsisH />
          </button>
          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="Close post">
            <FaTimes />
          </button>
        </div>

        <p className="mt-3 text-sm leading-5 text-gray-900">
          {item.text}
          <br />
          <button type="button" onClick={onOpen} className="text-gray-600 hover:underline">
            ... more
          </button>
        </p>
      </div>

      <button type="button" onClick={onOpen} className="mt-3 block w-full bg-gray-100 text-left">
        <img
          src={optimizeImageUrl(item.imageUrl, 720)}
          alt={item.title}
          width="720"
          height="420"
          loading="lazy"
decoding="async"
          className="h-auto max-h-[420px] w-full object-contain"
        />
      </button>
    </article>
  );
}

function OfflineMandiRatesCard({ rates = [], loading = false, error = "" }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-black">APMC, Govt. Mandi Auction and Rates</h2>
        <FaInfoCircle className="text-xs text-gray-600" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="animate-pulse rounded-md border border-gray-100 p-3">
              <div className="h-3 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="h-3 rounded bg-green-50" />
                <div className="h-3 rounded bg-green-50" />
                <div className="h-3 rounded bg-green-50" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="rounded-md border border-red-100 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : rates.length ? (
        <div className="space-y-3">
          {rates.map((rate) => (
            <article key={rate.id || rate._id || `${rate.commodity}-${rate.market}-${rate.arrivalDate}`} className="rounded-md border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-gray-950 whitespace-normal break-words">
                    Commodity: {rate.commodity || rate.Commodity || rate.commodityName || rate.fruitName || rate.FruitName || "Fruit"}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-gray-600 whitespace-normal break-words">
                    Market/Mandi: {rate.market || rate.mandi || "-"}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-800">
                  Date: {formatMandiRateDate(rate.arrivalDate)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <RateMiniStat label="Min Rate" value={formatKgRate(getRateKg(rate, "minPrice"))} />
                <RateMiniStat label="Modal Rate" value={formatKgRate(getRateKg(rate, "modalPrice"))} />
                <RateMiniStat label="Max Rate" value={formatKgRate(getRateKg(rate, "maxPrice"))} />
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-gray-600">
                State: {rate.state || "-"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-sm font-semibold text-green-800">
          Offline mandi rates will appear soon.
        </p>
      )}
      <Link to="/mandi-rates" className="mt-4 inline-flex text-sm font-semibold text-green-700 hover:text-green-800">
        View all mandi rates
      </Link>
    </section>
  );
}

function RateMiniStat({ label, value }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-2">
      <p className="font-bold text-gray-500">{label}</p>
      <p className="mt-1 font-extrabold text-gray-950">{value}</p>
    </div>
  );
}

function AdCard({ user, onListLot }) {
  return (
    <section className="rounded-sm border border-gray-300 bg-white p-4 text-center">
      <p className="rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
        List your fruit lots and reach verified buyers
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <Avatar name={user.name || "P"} className="h-14 w-14 text-base" />
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-green-100 bg-green-50 p-2">
          <img src={logoUrl} alt="Orchard Growers logo" width="56" height="56" className="h-full w-full object-contain" />
        </div>
      </div>
      <button
        type="button"
        onClick={onListLot}
        className="mt-4 rounded-full border border-green-700 px-5 py-1 text-sm font-semibold text-green-700 hover:bg-green-50"
      >
        List lot
      </button>
    </section>
  );
}

function EmptyFeed({ onAdd }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl text-green-700">
        <FaSeedling />
      </div>
      <h2 className="text-base font-semibold text-gray-900">No fruit posts yet</h2>
      <p className="mt-1 text-sm text-gray-600">New orchard listings will appear in this feed.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white"
      >
        Start a post
      </button>
    </section>
  );
}

function Avatar({ name, imageUrl, className = "" }) {
  if (imageUrl) {
    return (
      <img
        src={optimizeImageUrl(imageUrl, 160)}
        alt={name}
        width="80"
        height="80"
        loading="lazy"
decoding="async"
        className={`shrink-0 rounded-full bg-white object-contain p-1 ${className}`}
      />
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gray-900 font-semibold text-white ${className}`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function formatJoinDate(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

function buildFeed(products, auctions) {
  const productPosts = products.map((product) => {
    const image = getProductImage(product);
    return {
      id: product._id,
      productId: product._id,
      brand: product.createdBy?.orchardName || product.createdBy?.businessName || "Orchard Growers",
      title: product.title || "Fresh Fruit Lot",
      text: `${product.title || "Fresh fruit lot"} is now listed from ${product.location || "Fruit Mandi"} with ${product.quantity || 0} boxes available.`,
      timeLabel: "19h",
      imageUrl: image || fallbackLotImage,
    };
  });

  const auctionPosts = auctions
    .filter((auction) => auction.product)
    .map((auction) => {
      const rawProduct = auction.product || {};
      const product = typeof rawProduct === "object" && rawProduct !== null ? rawProduct : { _id: rawProduct };
      const productId = product._id || product.id || (typeof rawProduct === "string" ? rawProduct : "") || auction._id;
      const image = getProductImage(product);
      return {
        id: `auction-${auction._id}`,
        productId,
        brand: "Orchard Growers Market",
        title: product.title || "Live Fruit Deal",
        text: `Deal is open for ${product.title || "this orchard lot"}. Current deal price is Rs. ${auction.currentBid || auction.startingPrice || 0}.`,
        timeLabel: auction.status === "ACTIVE" ? "Live" : "19h",
        imageUrl: image || fallbackLotImage,
      };
    });

  return [...auctionPosts, ...productPosts];
}

function getProductImage(product) {
  return getProductImages(product)[0] || "";
}

function getProductImages(product) {
  const imageSources = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.gradeLots)
      ? product.gradeLots.flatMap((lot) => lot.images || [])
      : []),
  ];

  return Array.from(new Set(imageSources.map(normalizeProductImageUrl).filter(Boolean)));
}

function normalizeProductImageUrl(image = "") {
  const normalized = image ? image.replace(/\\/g, "/") : "";

  if (/^https?:\/\//i.test(normalized)) return optimizeImageUrl(normalized, 720);
  return normalized
    ? `${FILE_BASE_URL}/${normalized}`
    : "";
}

function getImageGradeLabel(product = {}, imageUrl = "") {
  if (!imageUrl) return "";
  const normalizedActive = normalizeProductImageUrl(imageUrl);
  const gradeLot = Array.isArray(product.gradeLots)
    ? product.gradeLots.find((lot) =>
        (lot.images || []).some((image) => normalizeProductImageUrl(image) === normalizedActive)
      )
    : null;
  const grade = gradeLot?.grade || product.grade || "";
  return grade ? `Grade ${grade}` : "";
}

function getDailyLotTiming(now = new Date()) {
  const openAt = new Date(now);
  openAt.setHours(LOT_OPEN_HOUR, 0, 0, 0);

  const closeAt = new Date(now);
  closeAt.setTime(openAt.getTime() + 24 * 60 * 60 * 1000);

  if (now >= openAt && now <= closeAt) {
    return {
      state: "live",
      label: "Deal Open",
      targetAt: closeAt.toISOString(),
      countdownPrefix: "Closes in",
    };
  }

  const nextOpenAt = new Date(openAt);
  if (now > closeAt) {
    nextOpenAt.setDate(nextOpenAt.getDate() + 1);
  }

  return {
    state: "upcoming",
    label: "Upcoming Deal",
    targetAt: nextOpenAt.toISOString(),
    countdownPrefix: "Starts in",
  };
}

function attachLotTiming(product = {}, timing) {
  const normalizedStatus = String(product.status || "").trim().toUpperCase();
  if (["SOLD", "ENDED", "CLOSED", "COMPLETED", "QUOTE_ACCEPTED", "DEAL_CONFIRMED"].includes(normalizedStatus)) {
    return {
      ...product,
      dealTiming: {
        state: "closed",
        label: "Deal Closed",
        targetAt: "",
        countdownPrefix: "",
      },
    };
  }

  if (["SCHEDULED", "UPCOMING", "PENDING"].includes(normalizedStatus)) {
    return {
      ...product,
      status: "UPCOMING",
      dealTiming: {
        state: "upcoming",
        label: "Upcoming Deal",
        targetAt: product.auctionStartTime || timing.targetAt,
        countdownPrefix: "Starts in",
      },
    };
  }

  if (["LIVE", "ACTIVE", "OPEN", "IN_AUCTION"].includes(normalizedStatus)) {
    return {
      ...product,
      status: "ACTIVE",
      dealTiming: {
        state: "live",
        label: "Deal Open",
        targetAt: product.auctionEndTime || product.endTime || timing.targetAt,
        countdownPrefix: "Closes in",
      },
    };
  }

  return {
    ...product,
    status: timing.state === "live" ? "ACTIVE" : "UPCOMING",
    dealTiming: timing,
  };
}

function normalizeAuctionLot(auction = {}, timing) {
  const rawProduct = auction.product || {};
  const product = typeof rawProduct === "object" && rawProduct !== null ? rawProduct : { _id: rawProduct };
  const productId = product._id || product.id || auction.productId || (typeof rawProduct === "string" ? rawProduct : "");
  const auctionId = auction._id || auction.id || "";
  const dealStatus = normalizeDealStatus({
    status: auction.status,
    product,
  });
  const auctionTiming =
    dealStatus === "closed"
      ? {
          state: "closed",
          label: "Deal Closed",
          targetAt: "",
          countdownPrefix: "",
        }
      : dealStatus === "upcoming"
        ? {
            state: "upcoming",
            label: "Upcoming Deal",
            targetAt: auction.startTime || product.auctionStartTime || timing.targetAt,
            countdownPrefix: "Starts in",
          }
        : auction.endTime || auction.closeTime
          ? {
              state: "live",
              label: "Deal Open",
              targetAt: auction.endTime || auction.closeTime,
              countdownPrefix: "Closes in",
            }
          : timing;

  return {
    ...product,
    _id: productId || auctionId,
    productId,
    auctionId,
    status:
      dealStatus === "closed"
        ? "CLOSED"
        : dealStatus === "upcoming"
          ? "UPCOMING"
          : "ACTIVE",
    auctionStatus: auction.status,
    currentBid: auction.currentBid || auction.startingPrice || product.currentBid,
    dealCreatedAt: auction.createdAt || product.createdAt,
    dealUpdatedAt: auction.updatedAt || product.updatedAt,
    dealStartAt: auction.startTime || product.auctionStartTime || product.startTime,
    dealTiming: auctionTiming,
  };
}

function getLotProductId(lot = {}) {
  const product = typeof lot.product === "object" && lot.product !== null ? lot.product : null;
  return (
    lot.productId ||
    product?._id ||
    product?.id ||
    (typeof lot.product === "string" ? lot.product : "") ||
    lot.product_id ||
    ""
  );
}

function getLotDetailId(lot = {}) {
  return getLotProductId(lot) || lot.auctionId || lot._id || lot.id || "";
}

function getLotOwnerId(lot = {}) {
  const createdBy = lot.createdBy || lot.product?.createdBy || {};
  const ownerId = typeof createdBy === "object" && createdBy !== null
    ? createdBy._id || createdBy.id
    : createdBy;
  return ownerId ? String(ownerId) : "";
}

function mergeUniqueLots(lots = []) {
  const seen = new Set();
  return lots.filter((lot) => {
    const key = getLotProductId(lot) || lot?.auctionId || lot?._id || lot?.id || lot?.lotNo || lot?.title;
    if (!key) return false;
    const normalizedKey = String(key);
    if (seen.has(normalizedKey)) return false;
    seen.add(normalizedKey);
    return true;
  });
}

function getDealSortTime(deal = {}) {
  const candidates = [
    deal.dealCreatedAt,
    deal.createdAt,
    deal.dealUpdatedAt,
    deal.updatedAt,
    deal.listedAt,
    deal.dealStartAt,
    deal.auctionStartTime,
    deal.startTime,
    deal.product?.createdAt,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }

  return 0;
}

function sortDealsNewestFirst(deals = []) {
  return [...deals].sort((a, b) => getDealSortTime(b) - getDealSortTime(a));
}

function getInitialMobileMarketData(products = [], auctions = []) {
  const timing = getDailyLotTiming(new Date());
  const auctionLots = auctions
    .filter((auction) => auction.product)
    .map((auction) => normalizeAuctionLot(auction, timing));
  const productLots = products.map((product) => attachLotTiming(product, timing));
  const allDeals = mergeUniqueLots([...auctionLots, ...productLots]);
  const primaryDeal =
    sortDealsNewestFirst(allDeals.filter((deal) => isLiveDeal(deal)))[0] ||
    sortDealsNewestFirst(allDeals.filter((deal) => isUpcomingDeal(deal)))[0] ||
    sortDealsNewestFirst(allDeals.filter((deal) => isClosedDeal(deal)))[0];

  if (!primaryDeal) {
    return { products: [], auctions: [] };
  }

  const primaryDetailId = getLotDetailId(primaryDeal);
  const primaryProductId = getLotProductId(primaryDeal);
  const isSameId = (left, right) =>
    Boolean(left && right && String(left) === String(right));
  const matchingAuction = auctions.find((auction) => {
    if (!auction?.product) return false;
    const auctionLot = normalizeAuctionLot(auction, timing);
    return (
      isSameId(getLotDetailId(auctionLot), primaryDetailId) ||
      isSameId(getLotProductId(auctionLot), primaryProductId) ||
      isSameId(auctionLot.auctionId, primaryDeal.auctionId)
    );
  });
  const matchingProduct = products.find((product) => {
    const productId = getLotProductId(product) || product._id || product.id;
    return (
      isSameId(productId, primaryProductId) ||
      isSameId(productId, primaryDetailId) ||
      isSameId(product._id || product.id, primaryDeal._id || primaryDeal.id)
    );
  });

  return {
    products: matchingProduct ? [matchingProduct] : [],
    auctions: matchingAuction ? [matchingAuction] : [],
  };
}

function getRateKg(rate = {}, field = "") {
  const kgField = `${field}Kg`;
  const kgValue = rate[kgField];
  if (kgValue !== undefined && kgValue !== null && kgValue !== "") {
    const number = Number(kgValue);
    if (Number.isFinite(number)) return number;
  }

  const quintalValue = rate[field];
  if (quintalValue !== undefined && quintalValue !== null && quintalValue !== "") {
    const number = Number(quintalValue);
    if (Number.isFinite(number)) return number / 100;
  }

  return null;
}

function formatKgRate(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  })}/kg`;
}

function formatMandiRateDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCountdown(targetAt = "") {
  const targetTime = targetAt ? new Date(targetAt).getTime() : 0;
  const remaining = targetTime - Date.now();

  if (!targetTime || remaining <= 0) return "00:00:00";

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function LotCountdownText({ timing, compact = false }) {
  if (!timing?.targetAt || timing.state === "closed") return null;

  return (
    <p
      className={`font-extrabold ${
        compact ? "mt-1 text-[9px]" : "text-[10px]"
      } ${timing.state === "live" ? "text-red-600" : "text-amber-700"}`}
    >
      {timing.countdownPrefix}: {formatCountdown(timing.targetAt)}
    </p>
  );
}

function formatLotStatus(status = "", timing = null) {
  if (timing?.label) return timing.label;

  const normalized = String(status || "AVAILABLE").trim().toUpperCase();
  const labels = {
    IN_AUCTION: "Deal Open",
    LIVE: "Deal Open",
    OPEN: "Deal Open",
    ACTIVE: "Deal Open",
    AVAILABLE: "Available",
    SCHEDULED: "Upcoming Deal",
    UPCOMING: "Upcoming Deal",
    PENDING: "Upcoming Deal",
    SOLD: "Deal Closed",
    ENDED: "Deal Closed",
    CLOSED: "Deal Closed",
    COMPLETED: "Deal Closed",
    QUOTE_ACCEPTED: "Deal Closed",
    DEAL_CONFIRMED: "Deal Closed",
  };
  return labels[normalized] || normalized.replace(/_/g, " ");
}

function getLotStatusBadgeClass(deal = {}) {
  if (isClosedDeal(deal)) return "bg-gray-200 text-gray-700";
  if (isUpcomingDeal(deal)) return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

function getLotDetails(product = {}) {
  const gradeSummary = Array.isArray(product.gradeLots)
    ? product.gradeLots
        .filter((lot) => lot?.grade || lot?.boxes || lot?.weightKg)
        .map((lot) =>
          [
            lot.grade || "Grade",
            lot.boxes ? `${lot.boxes} boxes` : "",
            lot.weightKg ? `${lot.weightKg} kg` : "",
          ]
            .filter(Boolean)
            .join(" - ")
        )
        .join(", ")
    : "";
  const growerName =
    product.createdBy?.orchardName ||
    product.createdBy?.businessName ||
    product.createdBy?.name ||
    "";

  return [
    { label: "Fruit", value: product.fruitName },
    { label: "Variety", value: product.variety },
    { label: "Quality", value: product.quality },
    { label: "Grower", value: growerName },
    { label: "Lot No.", value: product.lotNo },
    { label: "Packing", value: product.packingType },
    { label: "Total quantity", value: product.quantity ? `${product.quantity} boxes` : "" },
    { label: "Total weight", value: product.totalWeightKg ? `${product.totalWeightKg} kg` : "" },
    { label: "Packing weight", value: product.packingWeightKg ? `${product.packingWeightKg} kg each` : "" },
    { label: "Base price", value: product.basePrice ? `Rs. ${product.basePrice} per box` : "" },
    { label: "Location", value: product.location },
    { label: "Grades", value: gradeSummary },
    { label: "Description", value: product.description },
  ].filter((detail) => detail.value !== undefined && detail.value !== null && String(detail.value).trim());
}





































