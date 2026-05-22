import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChevronDown,
  FaEllipsisH,
  FaEye,
  FaGavel,
  FaGlobeAmericas,
  FaInfoCircle,
  FaSeedling,
  FaShieldAlt,
  FaTimes,
} from "react-icons/fa";
import BannerSlider from "../components/BannerSlider";
import TopFilters from "../components/TopFilters";
import API, { FILE_BASE_URL } from "../services/api";
import { getCurrentUser, isGrowerAccount } from "../utils/auth";
import { getEfruitMandiProducts } from "../utils/marketProducts";
import { saveUserToStorage } from "../utils/userStorage";

const categories = [
  { name: "Pear", img: "https://cdn-icons-png.flaticon.com/128/590/590685.png" },
  { name: "Apple", img: "https://cdn-icons-png.flaticon.com/128/415/415682.png" },
  { name: "Banana", img: "https://cdn-icons-png.flaticon.com/128/590/590684.png" },
  { name: "Mango", img: "https://cdn-icons-png.flaticon.com/128/590/590679.png" },
  { name: "Persimmon", img: "https://cdn-icons-png.flaticon.com/128/1625/1625048.png" },
  { name: "Orange", img: "https://cdn-icons-png.flaticon.com/128/135/135620.png" },
  { name: "Grapes", img: "https://cdn-icons-png.flaticon.com/128/765/765560.png" },
  { name: "Kiwi", img: "https://cdn-icons-png.flaticon.com/128/1412/1412511.png" },
  { name: "Pomegranate", img: "https://cdn-icons-png.flaticon.com/128/6866/6866550.png" },
  { name: "Cherry", img: "https://cdn-icons-png.flaticon.com/128/590/590682.png" },
  { name: "Peach", img: "https://cdn-icons-png.flaticon.com/128/6866/6866506.png" },
  { name: "Plum", img: "https://cdn-icons-png.flaticon.com/128/2224/2224312.png" },
  { name: "Apricot", img: "https://cdn-icons-png.flaticon.com/128/2224/2224242.png" },
  { name: "Walnut", img: "https://cdn-icons-png.flaticon.com/128/590/590722.png" },
  { name: "Almond", img: "https://cdn-icons-png.flaticon.com/128/2909/2909761.png" },
  { name: "Cashew", img: "https://cdn-icons-png.flaticon.com/128/2224/2224318.png" },
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
  { key: "liveLots", label: "Live Fruit Lots" },
  { key: "upcomingLots", label: "Upcoming Fruit Lots" },
  { key: "categories", label: "Fruit Categories" },
  { key: "highestDeals", label: "Highest Deals of The Day" },
  ...previousSections.map((section) => ({
    key: section.title,
    label: section.title,
  })),
];

const mobileTabs = [
  { key: "liveLots", label: "Live Fruit Lots" },
  { key: "upcomingLots", label: "Upcoming Lots" },
  { key: "trustedGrowers", label: "Trusted Growers" },
  { key: "organicFarms", label: "Organic Farms" },
];

const orchardCover =
  "https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=900&q=80";
const fallbackLotImage =
  "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=1200&q=80";
const logoUrl = `${process.env.PUBLIC_URL || ""}/logo.png`;

const newsItems = [
  "Fresh apple lots opening in Himachal mandis",
  "Verified growers can list new lots in minutes",
  "Live price quoting closes automatically after 5 minutes",
  "Organic fruit demand rises across buyer network",
  "Delivery partners available for orchard dispatch",
];

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentUser());
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [desktopSection, setDesktopSection] = useState("liveLots");
  const isGrower = isGrowerAccount(user);
  const openProfileEntry = () => {
    if (localStorage.getItem("accessToken")) {
      navigate("/profile-dashboard");
      return;
    }

    navigate("/profile", { state: { mode: "signup" } });
  };

  useEffect(() => {
    const loadHome = async () => {
      try {
        const [productRes, auctionRes] = await Promise.all([
          API.get("/products").catch(() => ({ data: [] })),
          API.get("/auctions").catch(() => ({ data: [] })),
        ]);

        setProducts(getEfruitMandiProducts(productRes.data));
        setAuctions(auctionRes.data || []);
      } finally {
        setLoading(false);
      }
    };

    loadHome();
  }, []);

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

  const feedItems = useMemo(
    () => buildFeed(products, auctions),
    [products, auctions]
  );
  const [activeMobileTab, setActiveMobileTab] = useState("liveLots");
  const visibleListings = products.slice(0, 6);
  const upcomingLots = auctions
    .filter((auction) => auction.status === "SCHEDULED" && auction.product)
    .map((auction) => ({
      ...(auction.product || {}),
      auctionStartTime: auction.startTime || auction.product?.auctionStartTime,
      status: "UPCOMING",
    }))
    .slice(0, 6);
  const highestDeals = getHighestDealsByCategory(auctions);
  const selectedInfoSection = previousSections.find(
    (section) => section.title === desktopSection
  );

  return (
    <>
      <div className="pb-4 md:hidden">
        <BannerSlider />

        <div className="px-3 pt-3">
          <TopFilters
            tabs={mobileTabs}
            active={activeMobileTab}
            onChange={setActiveMobileTab}
          />
        </div>

        <HeroCard onList={() => navigate(isGrower ? "/list-new-lot" : "/profile")} />

        {loading && (
          <p className="px-3 py-3 text-sm font-semibold text-green-700">
            Loading market data...
          </p>
        )}

        <MobileSectionContent
          activeTab={activeMobileTab}
          visibleListings={visibleListings}
          upcomingLots={upcomingLots}
          onOpenLot={(product) => navigate(`/lots/${product._id}`)}
          onAdd={() => navigate(isGrower ? "/list-new-lot" : "/profile")}
        />

        <section className="mt-4 px-3">
          <h2 className="mb-2 text-sm font-extrabold text-black">Fruit Categories</h2>
          <div className="grid grid-cols-4 gap-3">
            {categories.slice(0, 8).map((category) => (
              <button
                key={category.name}
                type="button"
                className="rounded-2xl border border-green-100 bg-green-50 p-3 text-center transition hover:bg-green-100"
              >
                <img src={category.img} alt={category.name} className="mx-auto h-9 w-9" />
                <p className="mt-2 text-[11px] font-semibold text-gray-900">
                  {category.name}
                </p>
              </button>
            ))}
          </div>
        </section>

        <div className="px-3">
          <HighestDealsSection items={highestDeals} />
          {previousSections.map((section) => (
            <InfoSection
              key={section.title}
              title={section.title}
              text={section.text}
            />
          ))}
        </div>
      </div>

    <div className="hidden w-full gap-5 md:grid md:grid-cols-[218px_minmax(0,1fr)] lg:grid-cols-[218px_minmax(0,1fr)_314px] xl:grid-cols-[240px_minmax(0,1fr)_340px]">
      <aside className="auto-hide-column-scroll sticky top-16 max-h-[calc(100vh-5rem)] self-start space-y-2.5 overflow-y-auto pr-1">
        <ProfileCard
          user={user}
          onOpen={openProfileEntry}
        />
        <StatsCard onOpen={openProfileEntry} />
        <CompanyCard onOpen={openProfileEntry} />
      </aside>

      <section className="min-w-0 space-y-3">
        <BannerSlider />

        <PostComposer
          user={user}
          onPost={() => navigate(isGrower ? "/list-new-lot" : "/profile")}
        />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-300" />
          <label className="inline-flex items-center gap-1 text-xs text-gray-600">
            Sort by:
            <select
              value={desktopSection}
              onChange={(event) => setDesktopSection(event.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 outline-none"
            >
              {desktopSections.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm font-semibold text-gray-600">
            Loading market feed...
          </div>
        ) : (
          <DesktopSection
            section={desktopSection}
            feedItems={feedItems}
            visibleListings={visibleListings}
            upcomingLots={upcomingLots}
            highestDeals={highestDeals}
            selectedInfoSection={selectedInfoSection}
            onAdd={() => navigate(isGrower ? "/list-new-lot" : "/profile")}
            onOpenLot={(productId) => navigate(`/lots/${productId}`)}
          />
        )}
      </section>

      <aside className="auto-hide-column-scroll sticky top-16 hidden max-h-[calc(100vh-5rem)] self-start space-y-2.5 overflow-y-auto pr-1 lg:block">
        <NewsCard />
            <AdCard user={user} onListLot={() => navigate("/register-grower")} />
      </aside>
    </div>
    </>
  );
}

function HeroCard({ onList }) {
  return (
    <section className="mx-3 -mt-3 rounded-[28px] bg-white shadow-sm ring-1 ring-green-100">
      <div className="relative overflow-hidden rounded-[28px]">
        <img
          src={orchardCover}
          alt="Fresh orchard fruits"
          className="h-44 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/75 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-200">
            Market updates from the mandi
          </p>
          <h1 className="mt-2 text-xl font-black leading-tight">
            Search lots, fruit, mandi...
          </h1>
          <p className="mt-2 max-w-xl text-sm text-green-100">
            Discover live fruit lots, upcoming auctions and trusted growers across the market.
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

function MobileSectionContent({
  activeTab,
  visibleListings,
  upcomingLots,
  onOpenLot,
  onAdd,
}) {
  if (activeTab === "liveLots") {
    return (
      <section className="mt-4 px-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-black">Live Fruit Lots</h2>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-green-700 px-4 py-1 text-[10px] font-bold text-white"
          >
            {"View Lots"}
          </button>
        </div>
        <ListingScroller
          items={visibleListings}
          emptyText="No live fruit lot yet. New mandi lots will appear here."
          onView={(product) => onOpenLot(product._id)}
        />
      </section>
    );
  }

  if (activeTab === "upcomingLots") {
    return (
      <section className="mt-4 px-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-black">Upcoming Lots</h2>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-green-700 px-4 py-1 text-[10px] font-bold text-white"
          >
            View Lots
          </button>
        </div>
        <ListingScroller
          items={upcomingLots}
          emptyText="No upcoming fruit lot yet. Scheduled lots will appear here."
          onView={(product) => onOpenLot(product._id)}
        />
      </section>
    );
  }

  if (activeTab === "trustedGrowers") {
    return (
      <section className="mt-4 px-3">
        <div className="rounded-3xl border border-green-100 bg-green-50 p-4">
          <h2 className="text-sm font-extrabold text-black">Trusted Growers</h2>
          <p className="mt-2 text-xs text-gray-700">
            Verified grower accounts and orchards will appear here once they are approved.
          </p>
          <div className="mt-3 grid gap-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="text-sm font-bold text-green-800">Grower Profile #{index}</p>
                <p className="mt-1 text-xs text-gray-600">Verified orchards and mandi trust score coming soon.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 px-3">
      <div className="rounded-3xl border border-green-100 bg-green-50 p-4">
        <h2 className="text-sm font-extrabold text-black">Organic Farms</h2>
        <p className="mt-2 text-xs text-gray-700">
          Organic farms and premium produce listings will be displayed here soon.
        </p>
      </div>
    </section>
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
          badge={product.status || "AVAILABLE"}
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
    ? `${FILE_BASE_URL}/${normalizedImage}`
    : "";

  return (
    <article className="min-w-[165px] rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-green-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
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
        <span className="rounded bg-green-100 px-2 py-0.5 text-[8px] font-extrabold text-green-800">
          {badge}
        </span>
      </div>

      <p className="truncate text-[10px] font-bold text-gray-600">
        {item.location || "Fruit Mandi"}
      </p>
      <p className="text-[10px] font-bold text-black">
        {item.quantity || 0} Box Lot
      </p>
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
  selectedInfoSection,
  onAdd,
  onOpenLot,
}) {
  if (section === "liveLots") {
    return (
      <WebSectionPost
        title="Live Fruit Lots"
        text="Fresh orchard listings available for mandi buyers."
      >
        <DesktopLotPost
          items={visibleListings}
          emptyText="No live fruit lot yet. New mandi lots will appear here."
          onOpenLot={onOpenLot}
        />
      </WebSectionPost>
    );
  }

  if (section === "upcomingLots") {
    return (
      <WebSectionPost
        title="Upcoming Fruit Lots"
        text="Scheduled lots will open for price quoting automatically at their live time."
      >
        <DesktopLotPost
          items={upcomingLots}
          emptyText="No upcoming fruit lot yet. Scheduled lots will appear here."
          onOpenLot={onOpenLot}
        />
      </WebSectionPost>
    );
  }

  if (section === "categories") {
    return (
      <WebSectionPost
        title="Fruit Categories"
        text="Browse fruit and dry fruit categories used across the app home page."
      >
        <div className="grid grid-cols-4 gap-3">
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              className="rounded-md border border-green-100 bg-green-50 p-3 text-center hover:bg-green-100"
            >
              <img src={category.img} alt={category.name} className="mx-auto h-9 w-9" />
              <p className="mt-2 text-xs font-semibold text-gray-900">{category.name}</p>
            </button>
          ))}
        </div>
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

function DesktopLotPost({ items, emptyText, onOpenLot }) {
  if (!items.length) return <DesktopEmptyState text={emptyText} />;

  const product = items[0];
  const imageUrl = getProductImage(product);

  return (
    <button
      type="button"
      onClick={() => onOpenLot(product._id)}
      className="flex w-full overflow-hidden rounded-md border border-gray-200 bg-white text-left hover:border-green-400"
    >
      <div className="h-36 w-44 shrink-0 bg-green-50">
        {imageUrl ? (
          <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-green-700">
            <FaSeedling />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-base font-extrabold text-black">
            {product.title || "Fruit Lot"}
          </h3>
          <span className="rounded bg-green-100 px-2 py-1 text-[10px] font-extrabold text-green-800">
            {product.status || "AVAILABLE"}
          </span>
        </div>
        <p className="truncate text-sm font-semibold text-gray-600">
          {product.location || "Fruit Mandi"}
        </p>
        <p className="mt-2 text-sm font-bold text-black">
          {product.quantity || 0} Box Lot
        </p>
        {product.basePrice !== undefined && (
          <p className="mt-1 text-sm font-bold text-black">
            Rs. {product.basePrice || 0} Per box
          </p>
        )}
      </div>
    </button>
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
  const isGrower = user.role === "grower" || Boolean(user.orchardName);
  const isBuyer = user.role === "buyer" || Boolean(user.businessName);
  const isDriver = user.role === "driver" || Boolean(user.logisticsName);
  const isTrustedAccount = Boolean(user.isVerified);
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
  const bannerUrl = user.bannerUrl || orchardCover;
  const avatarUrl = user.avatarUrl;
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
        className="group relative h-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${bannerUrl})` }}
      />
      <div className="px-4 pb-4">
        <div className="relative -mt-10 h-20 w-20">
          <Avatar
            name={displayName}
            imageUrl={avatarUrl}
            className="h-20 w-20 border-2 border-white text-2xl"
          />
        </div>
        <h1 className="mt-3 flex items-center gap-1 text-xl font-semibold leading-tight text-gray-900">
          {displayName}
          {isTrustedAccount && <FaShieldAlt className="text-sm text-green-700" />}
        </h1>
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
      <img src={logoUrl} alt="" className="mb-8 h-8 w-20 object-contain" />
      <h2 className="text-base font-semibold text-gray-900">Orchard Growers</h2>
      <p className="mt-2 text-xs text-gray-600">Agriculture marketplace updates and fruit lots.</p>
    </button>
  );
}

function PostComposer({ user, onPost }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <Avatar name={user.name || "Pavan Kumar"} className="h-12 w-12 text-base" />
        <button
          type="button"
          onClick={onPost}
          className="min-h-11 flex-1 rounded-full bg-green-700 px-5 text-center text-sm font-bold text-white shadow-sm hover:bg-green-800"
        >
          List a fruit lot
        </button>
      </div>
    </section>
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
        <img src={item.imageUrl} alt={item.title} className="h-auto max-h-[420px] w-full object-cover" />
      </button>
    </article>
  );
}

function NewsCard() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-black">Mandi News</h2>
        <FaInfoCircle className="text-xs text-gray-600" />
      </div>
      <p className="mb-3 text-base font-semibold text-gray-600">Top updates</p>
      <div className="space-y-3">
        {newsItems.map((title, index) => (
          <div key={title}>
            <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">
              {index + 1 + 13}h ago - {index ? `${index * 125} growers` : "1,909 growers"}
            </p>
          </div>
        ))}
      </div>
      <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-600">
        Show more updates <FaChevronDown />
      </button>
    </section>
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
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
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
        src={imageUrl}
        alt={name}
        className={`shrink-0 rounded-full bg-gray-900 object-cover ${className}`}
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
      const product = auction.product || {};
      const image = getProductImage(product);
      return {
        id: `auction-${auction._id}`,
        productId: product._id,
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
  const image = Array.isArray(product.images) ? product.images[0] : "";
  const normalized = image ? image.replace(/\\/g, "/") : "";

  return normalized
    ? `${FILE_BASE_URL}/${normalized}`
    : "";
}
