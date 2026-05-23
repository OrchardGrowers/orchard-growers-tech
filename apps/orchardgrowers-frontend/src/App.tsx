import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FaCamera,
  FaCheck,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaSearchMinus,
  FaSearchPlus,
  FaEye,
  FaEyeSlash,
  FaFacebookF,
  FaGoogle,
  FaInstagram,
  FaLinkedinIn,
  FaMicrophone,
  FaSearch,
  FaShoppingCart,
  FaStar,
  FaUser,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import Products from "./pages/Products";
import API, { FILE_BASE_URL } from "./services/api";
import InstallAppPrompt, { openOrchardInstallPrompt } from "./components/InstallAppPrompt";
import type { Product } from "./types";
import { normalizeIndianMobile } from "./utils/msg91OtpWidget";

type Auction = {
  _id: string;
  status?: string;
  currentBid?: number;
  startingPrice?: number;
  product?: Product;
};

type UserProfile = {
  name?: string;
  email?: string;
  phone?: string;
  orchardName?: string;
  businessName?: string;
  buyerContactPerson?: string;
  logisticsName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  location?: string;
  contact?: string;
  businessAddressLine1?: string;
  businessAddressLine2?: string;
  businessAddressLine3?: string;
  businessPinCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  pinCode?: string;
  role?: string;
  isVerified?: boolean;
  createdAt?: string;
};

type FeedItem = {
  id: string;
  brand: string;
  title: string;
  text: string;
  imageUrl: string;
  timeLabel: string;
};

const stripApiSuffix = (value = "") => value.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
const ORCHARD_APP_NAME = import.meta.env.VITE_APP_NAME || "orchardgrowers";
const DEFAULT_API_ORIGIN = "https://orchard-growers-backend.onrender.com";
const withOAuthAppParam = (url: string, appName: string) => {
  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("app", appName);
    nextUrl.searchParams.delete("platform");
    return nextUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}app=${encodeURIComponent(appName)}`;
  }
};
const addOAuthParams = (url: string, mode: "login" | "signup", termsAccepted: boolean) => {
  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("mode", mode);
    if (termsAccepted) nextUrl.searchParams.set("termsAccepted", "true");
    else nextUrl.searchParams.delete("termsAccepted");
    return nextUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    const termsParam = termsAccepted ? "&termsAccepted=true" : "";
    return `${url}${separator}mode=${encodeURIComponent(mode)}${termsParam}`;
  }
};
const getLoginErrorMessage = (error: unknown) => {
  const err = error as { response?: { status?: number; data?: { msg?: string; message?: string } }; message?: string };
  if (err.response?.data?.msg || err.response?.data?.message) {
    return err.response.data.msg || err.response.data.message || "Authentication failed.";
  }
  if (err.response?.status === 404) {
    return "Login API route was not found. Check VITE_API_BASE_URL and backend /api/auth/login deployment.";
  }
  return err.message || "Authentication failed.";
};
const getOrchardOAuthUrl = (provider: "google" | "facebook", mode: "login" | "signup", termsAccepted: boolean) => {
  const configured =
    provider === "google"
      ? import.meta.env.VITE_GOOGLE_AUTH_URL
      : import.meta.env.VITE_FACEBOOK_AUTH_URL;
  if (configured) return addOAuthParams(withOAuthAppParam(configured, ORCHARD_APP_NAME), mode, termsAccepted);

  const apiOrigin = stripApiSuffix(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || DEFAULT_API_ORIGIN);
  if (!apiOrigin) return "";

  return addOAuthParams(`${apiOrigin}/api/auth/${provider}?app=${encodeURIComponent(ORCHARD_APP_NAME)}`, mode, termsAccepted);
};
const readOAuthUser = (encodedUser: string | null): UserProfile | null => {
  if (!encodedUser) return null;
  try {
    const normalized = encodedUser.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

type HighestDeal = {
  category: string;
  amount: number;
  title: string;
  location: string;
};

type CartItem = {
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
};

type OrderInvoice = {
  _id: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  customer?: { name?: string; phone?: string; email?: string };
  shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; pinCode?: string; country?: string };
  items?: CartItem[];
  subtotal?: number;
  shippingCharge?: number;
  taxAmount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  courierPartner?: string;
  courierBookingStatus?: string;
  trackingNumber?: string;
};

type AddressForm = {
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
  country: string;
};

type SavedAddresses = {
  permanent: AddressForm;
  shipping: AddressForm;
};

type ProductImagePreview = {
  images: string[];
  activeIndex: number;
  title: string;
};

const CART_KEY = "orchardCart";
const ADDRESS_KEY = "orchardAddresses";
const INDIA_POST_TEST_KEY = "INDIA_POST_TEST_KEY";

const fruitPlants = [
  { icon: "🍅", name: "Persimmon" },
  { icon: "🍐", name: "Pear" },
  { icon: "🟣", name: "Plum" },
  { icon: "🍓", name: "Strawberry" },
  { icon: "🍑", name: "Peach" },
  { icon: "🥭", name: "Mango" },
];

const plantCategories = [
  {
    title: "Indoor Plants",
    text: "Bring nature indoors with our easy-care plant collection perfect for your home or office.",
  },
  {
    title: "Outdoor Plants",
    text: "Transform your garden with our selection of hardy and beautiful outdoor plants.",
  },
  {
    title: "Succulents",
    text: "Low-maintenance and beautiful, perfect for beginners and collectors alike.",
  },
  {
    title: "Planters & Pots",
    text: "Find the perfect home for your plants with our stylish selection of containers.",
  },
];

const previousSections = [
  { title: "Monsoon Banner", text: "Seasonal plant care and monsoon offers will appear here." },
  { title: "Consult Banner", text: "Book orchard and garden consultation from Orchard Growers." },
  { title: "Donate Banner", text: "Support plantation and Save Our Earth campaigns." },
  { title: "Planning Banner", text: "Plan orchards, gardens, bonsai spaces, and fruit farms." },
  { title: "Popular Fruit Plants", text: "No products available at the moment." },
  { title: "Ornamental Plants", text: "No ornamental plants available at the moment." },
  { title: "Planters & Pots", text: "No planters and pots available at the moment." },
  { title: "Seeds", text: "No seeds available at the moment." },
  { title: "What Our Customers Say", text: "Customer stories and reviews from orchardists and gardeners." },
];

const desktopSections = [
  { key: "products", label: "All Products" },
  { key: "category:tools", label: "Tools" },
  { key: "category:live-fruit-plants", label: "Live Fruit Plants" },
  { key: "category:live-forest-plants", label: "Live Forest Plants" },
  { key: "category:machineries", label: "Machineries" },
  { key: "category:gardening-inputs", label: "Gardening Inputs" },
  { key: "category:manure", label: "Manure" },
  { key: "category:growth-tonic", label: "Growth Tonic" },
  { key: "category:plant-seeds", label: "Plant Seeds" },
  { key: "category:planters-pots", label: "Planters & Pots" },
  { key: "category:organic-natural", label: "Organic and Natural Products" },
  { key: "category:ornamental-plants", label: "Ornamental Plants" },
  { key: "category:seasonal-plants", label: "Seasonal Plants" },
  { key: "category:all-season-plants", label: "All Season Plants" },
  { key: "price:under-500", label: "Price: Under Rs. 500" },
  { key: "price:500-1000", label: "Price: Rs. 500 - Rs. 1,000" },
  { key: "price:1000-2500", label: "Price: Rs. 1,000 - Rs. 2,500" },
  { key: "price:2500-5000", label: "Price: Rs. 2,500 - Rs. 5,000" },
  { key: "price:above-5000", label: "Price: Above Rs. 5,000" },
  { key: "season:spring", label: "Season: Spring" },
  { key: "season:summer", label: "Season: Summer" },
  { key: "season:monsoon", label: "Season: Monsoon" },
  { key: "season:winter", label: "Season: Winter" },
];

const desktopSectionFilters: Record<string, string[]> = {
  "category:tools": ["tool", "equipment"],
  "category:live-fruit-plants": ["fruit plant", "live fruit", "apple", "mango", "pear", "plum", "peach", "citrus"],
  "category:live-forest-plants": ["forest", "timber", "shade tree", "native tree"],
  "category:machineries": ["machinery", "machine", "sprayer", "tiller", "cutter", "pump"],
  "category:gardening-inputs": ["gardening input", "fertilizer", "soil", "mulch", "cocopeat", "vermicompost"],
  "category:manure": ["manure", "compost", "vermicompost"],
  "category:growth-tonic": ["growth tonic", "tonic", "booster", "bio stimulant", "biostimulant"],
  "category:plant-seeds": ["seed"],
  "category:planters-pots": ["planter", "pot", "grow bag"],
  "category:organic-natural": ["organic", "natural", "bio"],
  "category:ornamental-plants": ["ornamental", "flower", "decorative"],
  "category:seasonal-plants": ["seasonal"],
  "category:all-season-plants": ["all season", "perennial"],
  "season:spring": ["spring"],
  "season:summer": ["summer"],
  "season:monsoon": ["monsoon", "rainy"],
  "season:winter": ["winter"],
};

const mobileTabs = [
  { key: "products", label: "Products and Plants" },
  { key: "services", label: "Our Services" },
  { key: "tips", label: "Education and Tips" },
  { key: "earth", label: "Save Our Earth" },
];

const productDropdownItems = desktopSections
  .filter((section) => section.key !== "products" && !section.key.startsWith("price:"));

const serviceDropdownItems = [
  { label: "FFCCBB (Fruit Farm Cultivation Contract Based Business)", to: "/services/ffccbb" },
  { label: "Nursery Plants Prices", to: "/ourservices/nurseryplantprices" },
  { label: "Nursery Services", to: "/ourservices/nurseryservices" },
  { label: "Gardening Services", to: "/ourservices/gardning" },
  { label: "Services", to: "/ourservices/services" },
  { label: "Landscaping", to: "/ourservices/landscaping" },
  { label: "Orchard Services", to: "/ourservices/orchardservices" },
  { label: "Soil Test", to: "/ourservices/soiltest" },
  { label: "Expert Advice (Free) and Plot Visit", to: "/ourservices/expertadvice" },
  { label: "Download Orchard Growers App", to: "/download/orchard-growers-app" },
  { label: "Download efruitmandi.live App", to: "/download/efruitmandi-app" },
];

type NavLinkItem = { label: string; to: string };

const educationDropdownItems: NavLinkItem[] = [
  { label: "Learn", to: "/education/learn" },
  { label: "Plant Care Tips", to: "/education/plant-care-tips" },
  { label: "Orchard Planning", to: "/education/orchard-planning" },
];
const earthDropdownItems: NavLinkItem[] = [
  { label: "Blogs", to: "/save-our-earth/blogs" },
  { label: "Donate", to: "/save-our-earth/donate" },
];
const footerServiceLinks: NavLinkItem[] = [
  ...serviceDropdownItems,
  { label: "Education and Tips", to: "/education/learn" },
  { label: "Save Our Earth", to: "/save-our-earth/blogs" },
  { label: "Ask Bulk Order Quotation", to: "/bulk-order-enquiry" },
];

const publicAssetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
const logoUrl = publicAssetUrl("/logo.png");
const bannerImages = Array.from({ length: 6 }, (_, index) => publicAssetUrl(`/ad-banners/banner-${index + 1}.png`));
const orchardCover =
  "https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=900&q=80";
const fallbackLotImage =
  "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=1200&q=80";
const newsItems = [
  "Free Shipping on Orders Over ₹499 | New Arrivals Just In!",
  "Bulk Order Enquiry open for nurseries and orchardists",
  "Education and Tips for plants, tools, and orchard care",
  "Save Our Earth plantation campaigns from Orchard Growers",
];
const aboutLinks: NavLinkItem[] = [
  { label: "Blogs", to: "/aboutus/blogs" },
  { label: "Our Story", to: "/aboutus/ourstory" },
  { label: "Our Philosophy", to: "/aboutus/ourphilosophy" },
  { label: "Career", to: "/aboutus/career" },
  { label: "Press Release", to: "/aboutus/pressrelease" },
  { label: "Science Behind Us", to: "/aboutus/sciencebehindus" },
];
const partnerLinks: NavLinkItem[] = [
  { label: "Invest with Us", to: "/partnersprogramme/investwithus" },
  { label: "Sell with Us", to: "/partnersprogramme/workwithus" },
  { label: "Affiliate Nursery With Us", to: "/partnersprogramme/affiliatenurserywithus" },
];
const supportLinks: NavLinkItem[] = [
  { label: "Your Account", to: "/profile" },
  { label: "Shipping Policy", to: "/support/shippingpolicy" },
  { label: "Terms & Conditions", to: "/support/termsandconditions" },
  { label: "Privacy Policy", to: "/support/privacypolicy" },
  { label: "FAQs", to: "/support/faqs" },
  { label: "Return Policy", to: "/support/returnpolicy" },
  { label: "Help", to: "/support/help" },
];

function App() {
  const location = useLocation();
  const showFooter = location.pathname !== "/";

  return (
    <div className="min-h-screen bg-[#eef6f0] text-slate-950">
      <TopNav />
      <main className="w-full pb-16 pt-3 md:px-4 md:pt-5">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/services/ffccbb" element={<FFCCBBPage />} />
          <Route path="/ourservices/nurseryplantprices" element={<NurseryPlantPricesPage />} />
          <Route path="/ourservices/nurseryservices" element={<StandardServicePage service={servicePages.nurseryServices} />} />
          <Route path="/ourservices/gardning" element={<StandardServicePage service={servicePages.gardening} />} />
          <Route path="/ourservices/services" element={<StandardServicePage service={servicePages.services} />} />
          <Route path="/ourservices/landscaping" element={<StandardServicePage service={servicePages.landscaping} />} />
          <Route path="/ourservices/orchardservices" element={<StandardServicePage service={servicePages.orchardServices} />} />
          <Route path="/ourservices/soiltest" element={<StandardServicePage service={servicePages.soilTest} />} />
          <Route path="/ourservices/expertadvice" element={<ExpertAdvicePage />} />
          <Route path="/download/orchard-growers-app" element={<DownloadPage appName="Orchard Growers App" appType="orchard" />} />
          <Route path="/download/efruitmandi-app" element={<DownloadPage appName="efruitmandi.live App" appType="efruitmandi" />} />
          <Route path="/bulk-order-enquiry" element={<BulkOrderPage />} />
          <Route path="/aboutus/blogs" element={<StaticInfoPage page={staticPages.blogs} />} />
          <Route path="/aboutus/ourstory" element={<StaticInfoPage page={staticPages.ourStory} />} />
          <Route path="/aboutus/ourphilosophy" element={<StaticInfoPage page={staticPages.ourPhilosophy} />} />
          <Route path="/aboutus/career" element={<StaticInfoPage page={staticPages.career} />} />
          <Route path="/aboutus/pressrelease" element={<StaticInfoPage page={staticPages.pressRelease} />} />
          <Route path="/aboutus/sciencebehindus" element={<StaticInfoPage page={staticPages.scienceBehindUs} />} />
          <Route path="/partnersprogramme/investwithus" element={<StaticInfoPage page={staticPages.investWithUs} />} />
          <Route path="/partnersprogramme/workwithus" element={<StaticInfoPage page={staticPages.workWithUs} />} />
          <Route path="/partnersprogramme/affiliatenurserywithus" element={<StaticInfoPage page={staticPages.affiliateNursery} />} />
          <Route path="/support/shippingpolicy" element={<StaticInfoPage page={staticPages.shippingPolicy} />} />
          <Route path="/support/termsandconditions" element={<PolicyPage content={termsPolicyContent} />} />
          <Route path="/support/privacypolicy" element={<PolicyPage content={privacyPolicyContent} />} />
          <Route path="/support/faqs" element={<StaticInfoPage page={staticPages.faqs} />} />
          <Route path="/support/returnpolicy" element={<StaticInfoPage page={staticPages.returnPolicy} />} />
          <Route path="/support/help" element={<StaticInfoPage page={staticPages.help} />} />
          <Route path="/education/learn" element={<StaticInfoPage page={staticPages.learn} />} />
          <Route path="/education/plant-care-tips" element={<StaticInfoPage page={staticPages.plantCareTips} />} />
          <Route path="/education/orchard-planning" element={<StaticInfoPage page={staticPages.orchardPlanning} />} />
          <Route path="/save-our-earth/blogs" element={<StaticInfoPage page={staticPages.earthBlogs} />} />
          <Route path="/save-our-earth/donate" element={<StaticInfoPage page={staticPages.donate} />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/invoice/:id" element={<InvoicePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
      {showFooter ? <FooterLinkSection /> : <FooterCopyrightStrip />}
      <InstallAppPrompt />
      <StickyWhatsapp />
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  const [desktopSelections, setDesktopSelections] = useState<string[]>(["products"]);
  const [ratingProduct, setRatingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<ProductImagePreview | null>(null);
  const [stockMessage, setStockMessage] = useState("");
  const user = getStoredUser();
  const isSignedIn = hasSignedInUser();

  useEffect(() => {
    const load = async () => {
      try {
        const [productRes, auctionRes] = await Promise.all([
          API.get<Product[]>("/products").catch(() => ({ data: [] as Product[] })),
          API.get<Auction[]>("/auctions").catch(() => ({ data: [] as Auction[] })),
        ]);
        setProducts(productRes.data || []);
        setAuctions(auctionRes.data || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const section = new URLSearchParams(location.search).get("section") || "products";
    if (desktopSections.some((item) => item.key === section)) {
      setDesktopSelections([section]);
    }
  }, [location.search]);

  const visibleListings = products;
  const sortedListings = useMemo(() => getListingsForDesktopSections(products, desktopSelections), [products, desktopSelections]);
  const highestDeals = useMemo(() => getHighestDealsByCategory(auctions), [auctions]);
  const feedItems = useMemo(() => buildFeed(products, auctions), [products, auctions]);
  const toggleDesktopSelection = (section: string) => {
    setDesktopSelections((current) => {
      if (section === "products") return ["products"];

      const selections = current.filter((item) => item !== "products");
      if (selections.includes(section)) {
        const next = selections.filter((item) => item !== section);
        return next.length ? next : ["products"];
      }

      return [...selections, section];
    });
  };

  return (
    <>
      <div className="md:hidden">
        <BannerSlider />
        <TopFilters active={activeTab} onChange={setActiveTab} />
        <HeroCard onList={() => navigate("/products")} />
        {loading && <p className="px-3 py-3 text-sm font-semibold text-green-700">Loading products and plants...</p>}
        <MobileSectionContent
          activeTab={activeTab}
          items={visibleListings}
          onOpen={() => navigate("/products")}
          onRate={setRatingProduct}
          onOpenImage={setImagePreview}
          onStockIssue={setStockMessage}
        />
        <FruitPlantShortcuts />
        <PlantCategoryGrid mobile />
        <div className="px-3">
          <HighestDealsSection items={highestDeals} />
          {previousSections.map((section) => (
            <InfoSection key={section.title} title={section.title} text={section.text} />
          ))}
        </div>
      </div>

      <div className="hidden w-full gap-5 md:grid md:grid-cols-[218px_minmax(0,1fr)] lg:grid-cols-[218px_minmax(0,1fr)_314px] xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="auto-hide-column-scroll sticky top-16 max-h-[calc(100vh-5rem)] self-start space-y-2.5 overflow-y-auto pr-1">
          <ProfileCard user={user} isSignedIn={isSignedIn} onOpen={() => navigate(isSignedIn ? "/dashboard" : "/login")} />
          <StatsCard />
          <CompanyCard />
          <SidebarContactCard />
        </aside>

        <section className="min-w-0 space-y-3">
          <BannerSlider />
          <PostComposer user={user} onPost={() => navigate("/products")} />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-300" />
            <MultiSortByMenu active={desktopSelections} onChange={toggleDesktopSelection} />
          </div>
          {loading ? (
            <DesktopEmptyState text="Loading Orchard Growers feed..." />
          ) : (
            <DesktopSection
              selections={desktopSelections}
              feedItems={feedItems}
              visibleListings={sortedListings}
              highestDeals={highestDeals}
              onOpen={() => navigate("/products")}
              onRate={setRatingProduct}
              onOpenImage={setImagePreview}
              onStockIssue={setStockMessage}
            />
          )}
        </section>

        <aside className="auto-hide-column-scroll sticky top-16 hidden max-h-[calc(100vh-5rem)] self-start space-y-2.5 overflow-y-auto pr-1 lg:block">
          <NewsCard />
          <AdCard onListLot={() => navigate("/products")} />
          <SidebarLinkCard title="About Us" links={aboutLinks} />
          <SidebarLinkCard title="Become Partner" links={partnerLinks} />
          <SidebarLinkCard title="Support" links={supportLinks} />
        </aside>
      </div>
      <RatingPopup product={ratingProduct} onClose={() => setRatingProduct(null)} />
      <ImagePreviewModal preview={imagePreview} onClose={() => setImagePreview(null)} />
      <StockNoticePopup message={stockMessage} onClose={() => setStockMessage("")} />
    </>
  );
}

const ffccbbPlantPrices = [
  ["Mango (Grafted)", "Kesar/Alphonso", "Rs. 120", "Rs. 250-Rs. 400", "3-4 Years"],
  ["Guava (Hybrid)", "Taiwan Red", "Rs. 100", "Rs. 200-Rs. 350", "2 Years"],
  ["Lemon", "Kagzi", "Rs. 70", "Rs. 180-Rs. 300", "2 Years"],
  ["Papaya", "Red Lady", "Rs. 35", "Rs. 250-Rs. 450", "1 Year"],
  ["Dragon Fruit", "Vietnamese Red", "Rs. 150", "Rs. 500-Rs. 1000", "2 Years"],
  ["Coconut", "Dwarf Green/Tall", "Rs. 90", "Rs. 300-Rs. 500", "4-5 Years"],
  ["Banana", "Grand Naine", "Rs. 25", "Rs. 150-Rs. 300", "1 Year"],
  ["Pomegranate", "Bhagwa", "Rs. 80", "Rs. 200-Rs. 400", "2 Years"],
  ["Sapota", "Cricket Ball", "Rs. 110", "Rs. 250-Rs. 400", "3-4 Years"],
  ["Custard Apple", "Balangar", "Rs. 95", "Rs. 200-Rs. 350", "2-3 Years"],
  ["Jamun", "Narendra Jamun", "Rs. 130", "Rs. 300-Rs. 500", "5-6 Years"],
  ["Amla", "NA-7", "Rs. 85", "Rs. 150-Rs. 300", "3 Years"],
  ["Fig", "Poona", "Rs. 120", "Rs. 300-Rs. 500", "2 Years"],
  ["Ber", "Gola", "Rs. 65", "Rs. 150-Rs. 300", "2 Years"],
  ["Chikoo", "PKM-1", "Rs. 110", "Rs. 250-Rs. 400", "3-4 Years"],
  ["Mousambi", "Sathgudi", "Rs. 95", "Rs. 200-Rs. 350", "3 Years"],
  ["Orange", "Nagpur", "Rs. 105", "Rs. 250-Rs. 450", "3-4 Years"],
  ["Kiwi", "Hayward", "Rs. 180", "Rs. 400-Rs. 700", "3 Years"],
  ["Avocado", "Hass", "Rs. 220", "Rs. 500-Rs. 900", "3-4 Years"],
  ["Litchi", "Shahi", "Rs. 160", "Rs. 350-Rs. 600", "4-5 Years"],
];

const ffccbbIncluded = [
  "Certified fruit plants",
  "Organic sprays and disease management",
  "Expert visits and regular inspections",
  "SOP documentation and orchard file",
  "Plant replacement guarantee",
  "Pest and weed control using natural methods",
  "Guidance on water management and layout",
];

const ffccbbNotIncluded = [
  "Raw cow dung or compost, arranged by the farmer",
  "Fencing or protection from wild animals",
  "Water supply, which must be available and reliable",
];

function FFCCBBPage() {
  const [bookingSent, setBookingSent] = useState(false);

  const handleBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookingSent(true);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <div className="overflow-hidden rounded-lg bg-green-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_360px] md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Contract-Based Orchard Service</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-5xl">
              FFCCBB
            </h1>
            <p className="mt-2 text-xl font-bold text-green-100">Fruit Farm Cultivation Contract-Based Business</p>
            <p className="mt-5 max-w-2xl text-lg font-semibold text-white">You provide the land, we grow the orchard.</p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-green-50">
              Orchard Growers Private Limited helps landowners and farmers establish fruit farms without worrying about technical knowledge, workforce, or organic practices. We develop and maintain the orchard on your land for 1 to 5 years at a minimum annual service cost of Rs. 200 to Rs. 400 per plant, depending on plant variety and location.
            </p>
          </div>
          <form onSubmit={handleBooking} className="rounded-lg bg-white p-4 text-slate-950 shadow-lg">
            <h2 className="text-lg font-black">Book Your FFCCBB Slot Now</h2>
            <div className="mt-4 grid gap-3">
              <FFCCBBInput label="Full Name" name="name" required />
              <FFCCBBInput label="Email Address" name="email" type="email" required />
              <FFCCBBInput label="Phone Number" name="phone" type="tel" required />
              <label className="text-sm font-bold text-slate-700">
                Select Plant Type
                <select name="plantType" required className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-green-700">
                  <option value="">-- Select Fruit Type --</option>
                  {ffccbbPlantPrices.map(([fruit, variety]) => (
                    <option key={fruit} value={fruit}>{fruit} - {variety}</option>
                  ))}
                </select>
              </label>
              <FFCCBBInput label="No. of Plants" name="plants" type="number" min="1" required />
            </div>
            <button className="mt-4 w-full rounded-md bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800">
              Submit Booking Request
            </button>
            {bookingSent && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">Booking request noted. Our team will contact you shortly.</p>}
          </form>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <FFCCBBSection title="What is FFCCBB?">
            <p>FFCCBB is a farmer-friendly service model designed to convert unused or under-managed land into a professionally planned fruit orchard. Farmers sign a 1 to 5-year product/service contract with Orchard Growers. We provide and plant certified fruit plants and manage the orchard with organic and natural methods.</p>
          </FFCCBBSection>
          <FFCCBBSection title="How It Works">
            <p>Our team supports soil preparation guidance, plantation, natural disease control, expert visits, orchard documentation, and plant replacement under agreed terms. From layout to orchard file maintenance, the process is handled in a structured and transparent way.</p>
          </FFCCBBSection>
        </div>
        <aside className="rounded-lg border border-green-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-green-900">Why Farmers Choose It</h2>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
            {[
              "No farming knowledge required",
              "Useful for busy or migrant landowners",
              "Low annual service cost",
              "Organic, soil-safe management",
              "Structured orchard documentation",
              "Improves long-term land value",
            ].map((item) => (
              <li key={item} className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />{item}</li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-slate-950">Price Per Plant List (2025-26)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-green-900 text-xs uppercase text-white">
              <tr>
                {["Fruit Type", "Variety", "Plant Price", "Expected ROI/Year", "First Yield Year"].map((head) => (
                  <th key={head} className="px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ffccbbPlantPrices.map((row) => (
                <tr key={`${row[0]}-${row[1]}`} className="hover:bg-green-50">
                  {row.map((cell) => (
                    <td key={cell} className="px-4 py-3 font-semibold text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <FFCCBBList title="What's Included" items={ffccbbIncluded} tone="green" />
        <FFCCBBList title="What's Not Included" items={ffccbbNotIncluded} tone="amber" />
      </div>

      <FFCCBBSection title="Contract Terms and Payments">
        <p>The service period is one to five years. The total project cost is divided into annual instalments. If the company fails to meet the contract terms, it will refund twice the total paid amount.</p>
      </FFCCBBSection>

      <FFCCBBSection title="A Real Opportunity for Farmers">
        <p>Whether you are a full-time farmer, a landowner with no time, or someone who wants to grow fruit trees for future income, FFCCBB converts unused land into a productive orchard with expert handling, legal agreement, and low input cost.</p>
        <p className="mt-3 font-black text-green-800">Orchard Growers empowers rural communities with a simple vision: You provide the land, we grow the orchard.</p>
      </FFCCBBSection>
    </section>
  );
}

function FFCCBBInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm font-bold text-slate-700">
      {label}
      <input {...props} className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-700" />
    </label>
  );
}

function FFCCBBSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-3 text-sm font-medium leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function FFCCBBList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "amber" }) {
  const classes = tone === "green" ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <section className={`rounded-lg border p-5 shadow-sm ${classes}`}>
      <h2 className="text-xl font-black">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm font-semibold">
        {items.map((item) => (
          <li key={item} className="flex gap-2"><FaCheck className="mt-0.5 shrink-0" />{item}</li>
        ))}
      </ul>
    </section>
  );
}

const nurseryPriceRows = [
  ["Mango (Alphonso, Grafted)", "Fruit", "12-18 in Grafted", "249"],
  ["Apple (Low-chill, Grafted)", "Fruit", "12-18 in Grafted", "299"],
  ["Lemon (Kagzi)", "Citrus", "10-12 in Seedling", "149"],
  ["Sweet Orange (Mosambi, Budded)", "Citrus", "12-18 in Budded", "189"],
  ["Guava (Allahabad Safeda, Grafted)", "Fruit", "12-18 in Grafted", "179"],
  ["Pomegranate (Bhagwa)", "Fruit", "12-18 in Layered", "169"],
  ["Rose (Hybrid Tea)", "Ornamental", "8-10 in Grafted", "129"],
  ["Areca Palm", "Indoor", "6 in Pot", "299"],
  ["Aloe Vera", "Succulent", "4 in Pot", "99"],
  ["Hibiscus (Red)", "Ornamental", "8-10 in Cutting", "119"],
  ["Sapota (Chikoo)", "Fruit", "12-18 in Grafted", "199"],
  ["Jamun (Black Plum)", "Fruit", "12-18 in Seedling", "159"],
];

const servicePages = {
  nurseryServices: {
    kicker: "Full-Time or Part-Time by Orchard Growers",
    title: "Nursery Management Services",
    intro: "Professional nursery management services for small nurseries and large commercial setups, available on a full-time or part-time basis.",
    servicesTitle: "Our experienced team handles",
    items: [
      ["Grafting & Propagation", "Skilled grafting for high-quality plant varieties."],
      ["Daily Caretaking", "Watering, weeding, repotting, and plant health monitoring."],
      ["Tools & Products", "Supply of organic inputs, pots, and nursery tools."],
      ["SOPs & Documentation", "Inventory, plant records, and growth tracking."],
      ["Expert Visits", "Scheduled checkups by horticulture professionals."],
      ["Professional Advice", "On-demand guidance for sales, layout, and plant selection."],
    ],
    closing: "We also support new nursery setup, staff training, and marketing of plants through our platform.",
    cta: "Let your nursery bloom with expert care.",
  },
  gardening: {
    kicker: "For Homes, Farms & Institutions",
    title: "Professional Gardening Services",
    intro: "Expert gardening services for homes, farms, resorts, schools, and business spaces with flexible full-time and part-time packages.",
    servicesTitle: "Our gardening experts provide",
    items: [
      ["Planting & Landscaping", "Garden layout, seasonal plant selection, and plantation."],
      ["Pruning & Trimming", "Regular shaping and health management of plants."],
      ["Caretaking", "Watering, weeding, pest control, and soil care."],
      ["Flower Beds & Kitchen Gardens", "Setup and maintenance for personal use or sale."],
      ["Tools & Organic Products", "Supply of gardening kits, compost, and natural sprays."],
      ["Expert Advice", "Guidance on plant health, design, and sustainability."],
      ["Monthly Expert Visits", "Timely checkups and progress reports."],
    ],
    closing: "We help residential and commercial gardens stay lush, clean, and vibrant throughout the year.",
    cta: "Book your Gardening Service today with Orchard Growers.",
  },
  services: {
    kicker: "Plants, Products & Field Support",
    title: "Orchard Growers Services",
    intro: "A practical service desk for plant purchase, orchard setup, garden care, bulk requirements, and post-purchase advisory.",
    servicesTitle: "Available service support",
    items: [
      ["Plant Selection", "Choose suitable fruit, forest, ornamental, seasonal, and all-season plants."],
      ["Bulk Procurement", "Plan large plant orders with category, season, and delivery guidance."],
      ["Garden Inputs", "Get support for manure, cocopeat, pots, tools, and natural inputs."],
      ["Farm Planning", "Understand spacing, layout, water availability, and basic SOP needs."],
      ["After-Sales Guidance", "Care tips for newly planted saplings and seasonal maintenance."],
      ["Service Booking", "Request nursery, gardening, landscaping, soil test, or expert visit services."],
    ],
    closing: "This page keeps the complete Orchard Growers service menu in one place for customers and farmers.",
    cta: "Select the required service or contact us for a guided recommendation.",
  },
  landscaping: {
    kicker: "Beautify Your Space Naturally",
    title: "Professional Landscaping Services",
    intro: "Landscape design and development for farmhouses, resorts, schools, commercial properties, and public areas using natural and organic methods.",
    servicesTitle: "Our expert landscaping team offers",
    items: [
      ["Landscape Design", "Site analysis, layout planning, and 3D visualization."],
      ["Theme Gardens", "Herbal, ornamental, rock gardens, and fruit garden corners."],
      ["Earthwork & Plantation", "Mound shaping, pathways, turf laying, and tree plantation."],
      ["Decorative Plants & Lawn Setup", "Selection and arrangement of indoor and outdoor plants."],
      ["Seasonal Maintenance", "Weeding, mulching, trimming, watering, and health care."],
      ["Tools & Organic Inputs", "Natural compost, sprays, and landscaping equipment."],
      ["Expert Supervision", "Periodic site visits and performance reports."],
    ],
    closing: "We balance aesthetic appeal with ecological sustainability, creating green spaces that add value to your property.",
    cta: "Choose Orchard Growers for eco-smart and artistic landscaping.",
  },
  orchardServices: {
    kicker: "Fruit Farm Development",
    title: "Orchard Services",
    intro: "End-to-end orchard development and maintenance support for farmers, landowners, institutions, and commercial growers.",
    servicesTitle: "Orchard services include",
    items: [
      ["Site Assessment", "Basic review of soil, water, slope, access, and local climate suitability."],
      ["Planting Layout", "Spacing and variety planning for mango, guava, citrus, apple, pomegranate, and other fruit crops."],
      ["Organic Care Plan", "Natural disease control, manure scheduling, mulching, and weed management guidance."],
      ["Inspection Visits", "Planned visits for plant health, replacement suggestions, and growth monitoring."],
      ["Documentation", "Orchard file, plant list, service record, and field observations."],
      ["Harvest Readiness", "Guidance as the orchard moves toward fruiting and market linkage."],
    ],
    closing: "Our orchard services focus on long-term plant survival, structured management, and practical farmer support.",
    cta: "Share your land details to begin an orchard service plan.",
  },
  soilTest: {
    kicker: "Know Your Land First",
    title: "Soil Test",
    intro: "Soil testing support for better plant selection, nutrient planning, pH correction, and orchard preparation.",
    servicesTitle: "Soil test support covers",
    items: [
      ["Sample Guidance", "Simple instructions for collecting representative soil samples from the plot."],
      ["Lab Coordination", "Support for soil testing through reliable local or regional laboratories."],
      ["Report Reading", "Easy explanation of pH, EC, organic carbon, NPK, and micronutrient indicators."],
      ["Crop Suitability", "Fruit and plant recommendations based on soil type and climate context."],
      ["Correction Plan", "Organic amendments, compost, gypsum, lime, or drainage suggestions where applicable."],
      ["Pre-Planting Checklist", "Action list before plantation begins so avoidable failures are reduced."],
    ],
    closing: "Testing before planting helps prevent wrong crop selection and unnecessary input cost.",
    cta: "Book soil test guidance before orchard development.",
  },
};

function NurseryPlantPricesPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <ServiceHero eyebrow="Updated: Aug 2025 - Demo price list" title="Nursery Plants Price for 2025-26" subtitle="Transparent, farmer-friendly pricing for fruit plants, citrus, ornamentals, and grafted saplings." chips={["Pan-India delivery", "Bulk discounts", "Expert orchard guidance"]} />
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-slate-950">Price List (Retail) - 2025-26</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">Prices include nursery handling. Shipping and taxes are calculated at checkout.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-green-900 text-xs uppercase text-white">
              <tr>{["Plant", "Category", "Size / Grade", "Retail Price", "Buy"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nurseryPriceRows.map(([plant, category, size, price]) => (
                <tr key={plant} className="hover:bg-green-50">
                  <td className="px-4 py-3 font-black text-slate-900">{plant}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{category}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{size}</td>
                  <td className="px-4 py-3 font-black text-green-800">Rs. {price}</td>
                  <td className="px-4 py-3"><Link to="/products" className="rounded-md bg-green-700 px-3 py-2 text-xs font-black text-white hover:bg-green-800">Add to Cart</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <ServiceCard title="Bulk / Wholesale"><p>50-99 plants: 8% off. 100-249 plants: 12% off. 250+ plants: 18% off.</p></ServiceCard>
        <ServiceCard title="How We Price"><p>Prices factor in rootstock quality, survival rate, plant age, hardening, and seasonality while maintaining certified nursery standards.</p></ServiceCard>
      </div>
      <FAQBlock />
    </section>
  );
}

function StandardServicePage({ service }: { service: typeof servicePages.nurseryServices }) {
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <ServiceHero eyebrow={service.kicker} title={service.title} subtitle={service.intro} chips={["Full-time support", "Part-time packages", "Organic methods"]} />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">{service.servicesTitle}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {service.items.map(([title, text]) => <div key={title} className="rounded-lg border border-green-100 bg-green-50 p-4"><h3 className="font-black text-green-950">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text}</p></div>)}
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <ServiceCard title="Service Promise"><p>{service.closing}</p><p className="mt-3 font-black text-green-800">{service.cta}</p></ServiceCard>
        <ContactCard />
      </div>
    </section>
  );
}

function ExpertAdvicePage() {
  const [sent, setSent] = useState(false);
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <ServiceHero eyebrow="by Orchard Growers" title="Free Expert Advice on Call & On-Site Plot Visit" subtitle="Talk with horticulture advisors for soil planning, plant selection, layout design, water management, disease control, and orchard planning." chips={["Free phone consultation", "Paid expert visit if needed", "WhatsApp and call support"]} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ServiceCard title="How Our Experts Help"><p>Our experts can visit selected areas to assess plots and suggest practical solutions tailored to climate, terrain, and budget.</p><ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">{["Personalized orchard plan", "Plant and layout recommendations", "Water and disease management guidance", "Support for beginners and experienced farmers"].map((item) => <li key={item} className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />{item}</li>)}</ul></ServiceCard>
        <form onSubmit={(event) => { event.preventDefault(); setSent(true); }} className="rounded-lg border border-green-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Request Free Expert Advice</h2>
          <div className="mt-4 grid gap-3">
            <FFCCBBInput label="Full Name" name="name" required />
            <FFCCBBInput label="Phone Number" name="phone" type="tel" required />
            <FFCCBBInput label="Your Plot Location" name="location" required />
            <FFCCBBInput label="Preferred Time to Call" name="time" />
            <label className="text-sm font-bold text-slate-700">Need Expert Visit?<select name="visit" className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-green-700"><option>No</option><option>Yes</option></select></label>
            <label className="text-sm font-bold text-slate-700">Describe Your Query (Optional)<textarea name="query" rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-700" /></label>
          </div>
          <button className="mt-4 w-full rounded-md bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800">Request Call</button>
          {sent && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">Request received. Our team will contact you shortly.</p>}
        </form>
      </div>
      <ContactCard />
    </section>
  );
}

function ServiceHero({ eyebrow, title, subtitle, chips }: { eyebrow: string; title: string; subtitle: string; chips: string[] }) {
  return <section className="overflow-hidden rounded-lg bg-green-950 p-6 text-white shadow-sm md:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p><h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{title}</h1><p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-green-50 md:text-base">{subtitle}</p><div className="mt-5 flex flex-wrap gap-2">{chips.map((chip) => <span key={chip} className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-green-50">{chip}</span>)}</div></section>;
}

function ServiceCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-slate-950">{title}</h2><div className="mt-3 text-sm font-medium leading-6 text-slate-700">{children}</div></section>;
}

function ContactCard() {
  return <section className="rounded-lg border border-green-200 bg-green-50 p-5 shadow-sm"><h2 className="text-xl font-black text-green-950">Contact Orchard Growers</h2><div className="mt-3 space-y-2 text-sm font-bold text-green-900"><p>WhatsApp: +91 7018108900</p><p>Call: +91 7018108900</p><p>Email: care@orchardgrowers.in</p></div></section>;
}

function FAQBlock() {
  const faqs = [["What is the average nursery plant price in India?", "Ornamentals commonly range from Rs. 99-Rs. 199, while fruit saplings vary by variety, rootstock, and size."], ["Do you offer pan-India delivery?", "Yes. Protective packaging is used and charges depend on weight and destination PIN code."], ["Are wholesale rates available?", "Yes. Slab-wise discounts start at 50+ plants, and custom quotes are available for institutions and nurseries."], ["How do I choose the right plant?", "Check climate zone, chill hours, soil pH, irrigation availability, and your expected yield timeline."]];
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-slate-950">Frequently Asked Questions</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{faqs.map(([question, answer]) => <div key={question} className="rounded-lg bg-slate-50 p-4"><h3 className="font-black text-slate-950">{question}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{answer}</p></div>)}</div></section>;
}

type StaticPage = {
  eyebrow: string;
  title: string;
  subtitle: string;
  chips: string[];
  sections: { title: string; body: string; items?: string[] }[];
};

const staticPages: Record<string, StaticPage> = {
  blogs: page("About Us", "Blogs", "Updates, guides, and field learning from Orchard Growers.", ["Plant care", "Orchard ideas"], [["Latest Updates", "Read practical notes on fruit plants, nursery care, seasonal planning, and sustainable orchard practices."], ["Featured Topics", "Our blog area is prepared for upcoming articles and farmer education content.", ["Fruit plant care", "Organic inputs", "Garden planning", "Save Our Earth"]]]),
  ourStory: page("About Us", "Our Story", "Orchard Growers was built to make quality plants, orchard services, and practical guidance easier to access.", ["Plants", "Farmers", "Services"], [["Who We Are", "We connect growers, gardeners, nurseries, and landowners with plants, services, and support that help green spaces become productive."], ["What We Do", "Our work covers nursery plants, orchard development, gardening, landscaping, expert advice, and service-based farm support."]]),
  ourPhilosophy: page("About Us", "Our Philosophy", "Healthy plants, transparent service, and nature-first practices are the core of Orchard Growers.", ["Organic focus", "Farmer-first"], [["Our Belief", "Good orchards begin with the right plant, right place, and right care plan."], ["Working Method", "We prefer practical guidance, natural inputs where possible, clear documentation, and long-term customer support."]]),
  career: page("About Us", "Career", "Work with Orchard Growers across nursery, field service, operations, sales, and digital support.", ["Field roles", "Growth"], [["Open Interest", "Candidates with nursery, horticulture, landscaping, customer support, delivery, or digital operations experience can connect with us."], ["How To Apply", "Send your profile and area of interest to care@orchardgrowers.in or contact us on WhatsApp."]]),
  pressRelease: page("About Us", "Press Release", "Official updates and announcements from Orchard Growers.", ["Company news", "Media"], [["Media Desk", "This page will carry Orchard Growers updates, service launches, campaign information, and public notices."], ["Contact", "For media or partnership enquiries, contact care@orchardgrowers.in."]]),
  scienceBehindUs: page("About Us", "Science Behind Us", "Our recommendations use plant biology, soil health, climate suitability, and practical field experience.", ["Soil", "Climate", "Care"], [["Plant Science", "Plant survival depends on root health, seasonal timing, water availability, disease prevention, and correct variety selection."], ["Field Practice", "We combine horticulture guidance with local observations so customers receive useful and realistic advice."]]),
  investWithUs: page("Become Partner", "Invest with Us", "Partner with Orchard Growers in plant supply, green services, farm development, and rural growth opportunities.", ["Partnership", "Green business"], [["Opportunity", "The nursery and orchard sector needs reliable plants, logistics, advisory, and service execution at scale."], ["Next Step", "Share your investment interest and preferred region so our team can discuss fit and operating model."]]),
  workWithUs: page("Become Partner", "Work with Us", "Collaborate with Orchard Growers as a nursery, field expert, service provider, delivery partner, or local coordinator.", ["Partner network", "Local execution"], [["Who Can Join", "Nurseries, horticulture graduates, gardeners, landscapers, agri-input suppliers, and local entrepreneurs can apply."], ["Partner Promise", "We prefer transparent work, verified service quality, and customer-first communication."]]),
  affiliateNursery: page("Become Partner", "Affiliate Nursery With Us", "List your nursery supply capability with Orchard Growers and grow through a wider customer network.", ["Nursery network", "Plant supply"], [["Affiliate Model", "Verified nursery partners can support demand for fruit plants, ornamental plants, seasonal plants, pots, and inputs."], ["Quality Standards", "Plants should be healthy, labeled clearly, packed safely, and supplied with honest variety information."]]),
  shippingPolicy: page("Support", "Shipping Policy", "Shipping depends on product type, plant size, destination PIN code, weather, and carrier availability.", ["Plant-safe packing", "PIN based"], [["Dispatch", "Orders are packed carefully and dispatched when the plant or product can travel safely."], ["Delivery", "Delivery timelines may vary by location, plant condition, and logistics constraints."]]),
  terms: page("Support", "Terms & Conditions", "Use of Orchard Growers services and products is subject to fair usage, accurate order details, and lawful conduct.", ["Orders", "Services"], [["Customer Responsibility", "Customers should provide correct address, phone, plant requirements, and site information for services."], ["Service Terms", "Service bookings, visits, plant survival, replacements, and refunds depend on the specific service terms shared at booking."]]),
  privacy: page("Support", "Privacy Policy", "We collect only required information for account, order, delivery, service, payment, and support purposes.", ["Data care", "Secure use"], [["Information Use", "Customer details are used to process orders, provide support, and improve service communication."], ["Protection", "Sensitive credentials are not stored in frontend code and payment or login flows should use secure providers."]]),
  faqs: page("Support", "FAQs", "Common questions about plants, orders, services, delivery, and support.", ["Quick answers", "Help"], [["Ordering", "Browse products, choose available items, and complete checkout. Unavailable products remain disabled until stock exists."], ["Services", "Nursery, gardening, landscaping, expert advice, FFCCBB, and soil test services can be requested through the service pages."], ["Support", "For urgent help, contact Orchard Growers on WhatsApp or email care@orchardgrowers.in."]]),
  returnPolicy: page("Support", "Return Policy", "Return and replacement support depends on product type, delivery condition, and evidence shared soon after delivery.", ["Plant condition", "Support"], [["Plants", "Because plants are living products, return handling is reviewed case by case with photos and delivery timing."], ["Non-Plant Items", "Tools, pots, and packed products can be reviewed under standard condition and packaging checks."]]),
  help: page("Support", "Help", "Get help with orders, account, plant care, service booking, bulk enquiry, or app installation.", ["WhatsApp", "Email"], [["Contact", "WhatsApp or call +91 7018108900 for customer support."], ["Email", "Write to care@orchardgrowers.in with order details, phone number, and photos if relevant."]]),
  learn: page("Education and Tips", "Learn", "Simple plant and orchard education for customers, gardeners, and farmers.", ["Beginners", "Field-ready"], [["Start Here", "Learn about plant selection, watering, sunlight, potting mix, pruning, and seasonal care."], ["For Farmers", "Use orchard planning notes before buying large quantities of plants."]]),
  plantCareTips: page("Education and Tips", "Plant Care Tips", "Care notes for healthy plants after delivery and plantation.", ["Water", "Sunlight", "Soil"], [["Daily Care", "Check moisture before watering, avoid heat shock after delivery, and keep plants in suitable light."], ["Seasonal Care", "Mulch in summer, improve drainage in monsoon, and protect sensitive plants in winter."]]),
  orchardPlanning: page("Education and Tips", "Orchard Planning", "Plan crop, spacing, irrigation, soil preparation, and maintenance before planting.", ["Layout", "ROI"], [["Planning Basics", "Choose fruit types by climate, soil, water, market demand, and expected yield year."], ["Before Buying", "Confirm plant count, variety, spacing, water source, fencing, and labour availability."]]),
  earthBlogs: page("Save Our Earth", "Save Our Earth Blogs", "Awareness and action notes for plantation, soil care, water saving, and natural farming.", ["Plantation", "Soil health"], [["Green Action", "Small actions like planting native trees, composting, and reducing chemical dependency help restore local ecosystems."], ["Community", "Orchard Growers supports practical campaigns that connect people with plants and responsible land use."]]),
  donate: page("Save Our Earth", "Donate", "Support plantation and environment-focused work through Orchard Growers campaigns.", ["Trees", "Community"], [["How Donation Helps", "Funds can support plants, protection material, logistics, awareness, and local plantation activity."], ["Contact First", "For campaign details and official contribution routes, contact the Orchard Growers team before making any payment."]]),
};

function page(eyebrow: string, title: string, subtitle: string, chips: string[], sections: [string, string, string[]?][]): StaticPage {
  return { eyebrow, title, subtitle, chips, sections: sections.map(([sectionTitle, body, items]) => ({ title: sectionTitle, body, items })) };
}

type PolicySection = {
  title?: string;
  body?: string[];
  items?: string[];
};

type PolicyContent = {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: PolicySection[];
  closing?: string[];
};

const companyOverviewItems = [
  "High-quality, site-specific fruit plants",
  "Organic and natural orchard management",
  "Pruning, grafting, and planting services",
  "Orchard landscaping and site analysis",
  "Educational tools and remote consultation",
  "Future-ready cold storage and tech-driven transportation infrastructure",
];

const privacyPolicyContent: PolicyContent = {
  title: "Privacy Policy - Orchard Growers",
  effectiveDate: "June 17, 2025",
  intro: [
    "At Orchard Growers Private Limited ('Orchard Growers,' 'we,' 'our,' or 'us'), we deeply value your trust. As a digital-first, service-based platform rooted in India's heartland, we are committed to protecting the personal and sensitive information of our users, customers, partners, and visitors.",
    "This Privacy Policy outlines how we collect, use, share, and protect your personal data when you interact with our website, PWA (progressive web app), mobile interfaces, and offline services. We also explain your rights in relation to your data and how you can exercise them.",
  ],
  sections: [
    {
      title: "Who We Are",
      body: [
        "Orchard Growers Private Limited",
        "Head Office: Musrani, Gohar, Mandi, Himachal Pradesh - 175029",
        "Website: www.orchardgrowers.in",
        "Email: care@orchardgrowers.in",
        "We provide budget-friendly and expert-backed plant-related services including:",
      ],
      items: companyOverviewItems,
    },
    { title: "Scope of This Privacy Policy", body: ["This policy applies to:"], items: ["Visitors to our website and app", "Customers who purchase plants or book services", "Individuals who register or subscribe to our services", "Field service users and clients interacting offline"] },
    { title: "What Information We Collect", body: ["We collect the following types of data:"] },
    { title: "1. Personal Identifiable Information (PII)", items: ["Full name", "Phone number", "Email address", "Shipping address", "Billing address (if different)", "Identity verification (in case of large orders or partnerships)"] },
    { title: "2. Payment Information", items: ["UPI ID, Razorpay or Stripe transaction IDs", "Payment status (we do not store card or banking credentials directly)"] },
    { title: "3. Location & Site Information", items: ["Site GPS coordinates for pruning/grafting/site analysis", "Site photos and documentation"] },
    { title: "4. Technical & Usage Data", items: ["IP address", "Device information", "Browser type and version", "Clickstream data (pages visited, time spent, referral source)"] },
    { title: "5. Service Interaction Data", items: ["Messages, chats, and feedback", "Service request history", "Order tracking and logistics records"] },
    { title: "6. Cookies and Tracking Technologies", body: ["We use cookies to:"], items: ["Understand usage behaviour", "Save login preferences", "Personalize experience and recommendations"] },
    { title: "Why We Collect Your Data", body: ["We collect and process your data for the following purposes:"], items: ["To process orders and deliver products/services", "To communicate order status and service updates", "To schedule, confirm, or verify site-based services", "To enhance our offerings through analytics and feedback", "To send promotions, newsletters, or seasonal tips (only with your consent)", "To maintain platform security and integrity", "To comply with legal and tax regulations"] },
    { title: "How We Share Your Data", body: ["We value your privacy. We do not sell your personal data. We may, however, share your information with trusted third parties such as:"], items: ["Logistics & shipping providers (e.g., Shiprocket)", "Payment processors (e.g., Razorpay, Stripe)", "Field service agents for on-site delivery or consultations", "IT & security partners to maintain platform integrity", "Legal or regulatory bodies if required by law", "We ensure that all third parties are contractually obligated to protect your data and use it only for the purposes intended."] },
    { title: "Data Security Measures", body: ["We take multiple precautions to keep your data safe:"], items: ["HTTPS secure connections across all platforms", "Encrypted storage of sensitive identifiers", "OTP verification and login protection", "Secure server hosting and backups", "Periodic audits and access controls", "However, while we use industry-standard measures, no method of data transmission over the internet is 100% secure."] },
    { title: "Data Retention Policy", body: ["We retain your data only for as long as necessary to:"], items: ["Fulfill the purpose it was collected for", "Meet legal, accounting, or tax requirements", "Improve service quality and personalization", "Inactive accounts and dormant records are periodically anonymized or deleted."] },
    { title: "Your Rights", body: ["As an Orchard Growers user, you have the following rights:"], items: ["Right to Access - Request a copy of your stored data", "Right to Correction - Update or amend inaccurate data", "Right to Deletion - Request deletion of data no longer needed", "Right to Withdraw Consent - Opt out of marketing or data use", "Right to Object - Refuse processing for specific uses (e.g., profiling)", "To exercise these rights, email us at care@orchardgrowers.in with the subject line 'Privacy Request.'"] },
    { title: "International Users", body: ["Though we primarily serve Indian customers, international visitors should be aware that your data will be processed and stored in India under Indian laws."] },
    { title: "Children's Privacy", body: ["Our platform is not intended for children under 13. We do not knowingly collect data from minors. If you believe your child has provided us data without consent, please contact us immediately."] },
    { title: "Communication Preferences", body: ["You can choose how you'd like to hear from us:"], items: ["Transactional messages (e.g., order updates) are mandatory", "Promotional emails/SMS are sent only after consent and can be opted out at any time"] },
    { title: "Third-Party Links", body: ["Our website/app may contain links to external sites (e.g., payment gateways, blogs, government horticulture resources). We are not responsible for the privacy practices of these sites."] },
    { title: "Changes to This Policy", body: ["We may update this policy from time to time. The revised version will be posted on this page with a new effective date. Continued use of our services after updates implies acceptance."] },
    { title: "Contact Us", body: ["For privacy-related queries, please contact:", "Orchard Growers Private Limited", "Musrani, Gohar, Mandi, Himachal Pradesh - 175029", "Email: care@orchardgrowers.in", "Web: www.orchardgrowers.in"] },
  ],
  closing: ["Thank you for trusting Orchard Growers. Your growth and your privacy are both deeply important to us.", "Orchard Growers - Rooted in Trust. Growing with Responsibility."],
};

const termsPolicyContent: PolicyContent = {
  title: "Terms & Conditions - Orchard Growers",
  effectiveDate: "June 17, 2025",
  intro: [
    "Welcome to Orchard Growers Private Limited ('Orchard Growers,' 'we,' 'our,' or 'us'). These Terms and Conditions ('Terms') govern your use of our website, progressive web app (PWA), products, and all services related to orchard consultation, fruit plant delivery, and other agricultural solutions.",
    "By accessing or using our platform or services, you agree to be legally bound by these Terms. If you do not agree, you must not use our platform or services.",
  ],
  sections: [
    { title: "Company Overview", body: ["Orchard Growers Private Limited", "Head Office: Musrani, Gohar, Mandi, Himachal Pradesh - 175029", "Website: www.orchardgrowers.in", "Email: care@orchardgrowers.in", "We offer affordable, research-backed solutions for farmers, orchardists, and landowners including:"], items: companyOverviewItems },
    { title: "1. Eligibility", body: ["To use our services, you must:"], items: ["Be 18 years or older", "Provide accurate registration and delivery details", "Use the platform legally and ethically", "Minors must use the services under the supervision of a legal guardian."] },
    { title: "2. User Accounts", body: ["Creating an account may be required to place orders, track services, or schedule consultations.", "You are responsible for protecting your login credentials. Activity under your account is your responsibility.", "We reserve the right to terminate accounts involved in fraud, misuse, or policy violations."] },
    { title: "3. Orders and Payments", body: ["Order Placement", "Orders may be placed via website, PWA, or customer care. All orders are subject to availability and feasibility.", "Payments", "We accept:"], items: ["UPI, credit/debit cards, Razorpay", "Stripe (international), net banking", "Cash on delivery (select areas)", "Prices are inclusive of applicable taxes unless otherwise mentioned."] },
    { title: "4. Delivery and Fulfillment", body: ["Delivery timelines vary by region, product, and weather. Shipping partners may change without notice.", "Customers must be present at the scheduled time for deliveries, especially those involving live plants or on-site consultation. For details, refer to our Shipping Policy."] },
    { title: "5. Returns and Refunds", body: ["Damaged or incorrect products must be reported within 48 hours of delivery.", "Perishable items (e.g., plants) may not be returnable. Cancellations of services should be made at least 48 hours in advance.", "Full policy available on our Refund Policy page."] },
    { title: "6. Site Analysis and Recommendations", body: ["We provide:"], items: ["Research-driven fruit plant suggestions based on location and terrain", "Optional field visits or remote consultation", "These are recommendations, not guarantees. Orchard success depends on:", "Local climate, soil, and user involvement", "Long-term care and timely follow-ups", "We are not liable for yield outcomes or plant survivability beyond the delivery phase."] },
    { title: "7. Intellectual Property", body: ["All content on orchardgrowers.in (text, visuals, logos, service formats, designs) belongs to Orchard Growers.", "You may not:"], items: ["Reuse our branding or digital material without consent", "Copy, sell, or redistribute our web or mobile content", "Reverse-engineer or tamper with our backend technologies"] },
    { title: "8. Data Privacy", body: ["We are committed to your data security. For details on:"], items: ["What information we collect", "How we use it", "Your rights", "Please read our full Privacy Policy."] },
    { title: "9. User Obligations", body: ["You agree to:"], items: ["Provide truthful and up-to-date information", "Not interfere with website operations or misuse tools", "Not submit offensive, false, or defamatory content", "Respect the rights of other users, our employees, and field staff", "We reserve the right to refuse service or legal action for violations."] },
    { title: "10. Future Infrastructure", body: ["We are actively planning to build:"], items: ["High-efficiency cold storage warehouses in multiple zones", "Custom cold chain transportation systems for sensitive plants", "A scalable delivery system for remote farmers and cooperatives", "These expansions will enhance the reliability and quality of our delivery and nursery ecosystems."] },
    { title: "11. Customer Support", body: ["For all order, service, or technical queries:"], items: ["Email: care@orchardgrowers.in", "Use our Contact Us or Support page", "Call numbers as available on the website", "Expect a response within 24-48 business hours."] },
    { title: "12. Legal and Jurisdiction", body: ["All disputes are subject to:"], items: ["Indian laws and regulations", "Jurisdiction of courts in Mandi, Himachal Pradesh", "Arbitration or mediation may be sought first in case of non-critical disputes."] },
    { title: "13. Policy Updates", body: ["We may revise these Terms due to law, business updates, or platform changes.", "Updated versions will be posted here with a new effective date. Continued use implies your acceptance of revised terms."] },
    { title: "14. Feedback and Communication", body: ["By providing reviews or feedback:"], items: ["You permit us to publish them (anonymously or otherwise) on our platform", "You confirm that your review is truthful and does not infringe any third-party rights"] },
    { title: "15. Contact Information", body: ["Orchard Growers Private Limited", "H.O. Musrani, Gohar, Mandi, Himachal Pradesh - 175029", "Email: care@orchardgrowers.in", "Website: www.orchardgrowers.in"] },
  ],
  closing: ["Thank you for trusting Orchard Growers. Let's cultivate success-organically, economically, and together."],
};

function PolicyPage({ content }: { content: PolicyContent }) {
  return (
    <article className="mx-auto max-w-5xl px-3 pb-12 md:px-0">
      <div className="rounded-lg border border-green-100 bg-white p-5 shadow-sm md:p-8">
        <p className="text-sm font-black text-green-700">Effective Date: {content.effectiveDate}</p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 md:text-4xl">{content.title}</h1>
        <div className="mt-5 space-y-4 text-sm font-medium leading-7 text-slate-700 md:text-base">
          {content.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="mt-8 space-y-7">
          {content.sections.map((section, index) => (
            <section key={`${section.title || "section"}-${index}`} className="border-t border-slate-100 pt-5">
              {section.title && <h2 className="text-xl font-black text-green-900">{section.title}</h2>}
              {section.body && <div className="mt-3 space-y-2 text-sm font-medium leading-7 text-slate-700 md:text-base">{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>}
              {section.items && <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium leading-7 text-slate-700 md:text-base">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
        </div>
        {content.closing && <div className="mt-8 rounded-lg bg-green-50 p-5 text-sm font-bold leading-7 text-green-900 md:text-base">{content.closing.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>}
      </div>
    </article>
  );
}

function StaticInfoPage({ page }: { page: StaticPage }) {
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <ServiceHero eyebrow={page.eyebrow} title={page.title} subtitle={page.subtitle} chips={page.chips} />
      <div className="grid gap-4 md:grid-cols-2">
        {page.sections.map((section) => (
          <ServiceCard key={section.title} title={section.title}>
            <p>{section.body}</p>
            {section.items && <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">{section.items.map((item) => <li key={item} className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />{item}</li>)}</ul>}
          </ServiceCard>
        ))}
      </div>
      <ContactCard />
    </section>
  );
}

function BulkOrderPage() {
  const [sent, setSent] = useState(false);
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <ServiceHero eyebrow="Bulk Order Enquiry" title="Ask Bulk Order Quotation" subtitle="Request pricing and availability for plants, tools, pots, manure, growth inputs, and orchard service packages." chips={["Plants", "Inputs", "Services"]} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ServiceCard title="For Nurseries, Farmers and Institutions">
          <p>Share your product list, quantity, destination, and delivery timeline. Our team will respond with availability, packing, logistics, and quotation details.</p>
          <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">{["Fruit plants and seasonal plants", "Tools, planters, manure and growth inputs", "Large orchard and landscaping requirements"].map((item) => <li key={item} className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />{item}</li>)}</ul>
        </ServiceCard>
        <form onSubmit={(event) => { event.preventDefault(); setSent(true); }} className="rounded-lg border border-green-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Request Quotation</h2>
          <div className="mt-4 grid gap-3">
            <FFCCBBInput label="Full Name" name="name" required />
            <FFCCBBInput label="Phone Number" name="phone" type="tel" required />
            <FFCCBBInput label="Email Address" name="email" type="email" />
            <FFCCBBInput label="Delivery Location" name="location" required />
            <label className="text-sm font-bold text-slate-700">Requirement<textarea name="requirement" rows={5} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-700" /></label>
          </div>
          <button className="mt-4 w-full rounded-md bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800">Submit Enquiry</button>
          {sent && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">Enquiry received. Our team will contact you shortly.</p>}
        </form>
      </div>
    </section>
  );
}

function DownloadPage({ appName, appType }: { appName: string; appType: "orchard" | "efruitmandi" }) {
  const isOrchard = appType === "orchard";
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-3 pb-12 md:px-0">
      <ServiceHero eyebrow="Download App" title={appName} subtitle={isOrchard ? "Install the Orchard Growers app for products, plants, services, profile, cart, and customer support." : "Install the efruitmandi.live app for fruit mandi access, buyer-seller discovery, and marketplace activity."} chips={["Mobile friendly", "Fast access", "Installable"]} />
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <ServiceCard title="Install Steps">
          <ul className="space-y-2 text-sm font-semibold text-slate-700">
            <li className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />Open the site in Chrome or your mobile browser.</li>
            <li className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />Use the install prompt or browser menu to add it to your home screen.</li>
            <li className="flex gap-2"><FaCheck className="mt-0.5 shrink-0 text-green-700" />Login to keep your profile, cart, and activity connected.</li>
          </ul>
          {isOrchard ? (
            <button type="button" onClick={openOrchardInstallPrompt} className="mt-5 rounded-md bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800">Install Orchard Growers App</button>
          ) : (
            <a href="https://efruitmandi.live" className="mt-5 inline-block rounded-md bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800">Open efruitmandi.live</a>
          )}
        </ServiceCard>
        <ContactCard />
      </div>
    </section>
  );
}

function TopNav() {
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => getCartItems());
  const [accountPath, setAccountPath] = useState(() => getAccountPath());

  useEffect(() => {
    const syncCart = () => setCartItems(getCartItems());
    const syncAuth = () => setAccountPath(getAccountPath());
    window.addEventListener("orchard-cart-updated", syncCart);
    window.addEventListener("orchard-auth-updated", syncAuth);
    window.addEventListener("storage", syncCart);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("orchard-cart-updated", syncCart);
      window.removeEventListener("orchard-auth-updated", syncAuth);
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="bg-green-700 px-3 py-1.5 text-center text-xs font-semibold text-white">
          Free Shipping on Orders Over Rs. 499 | New Arrivals Just In!
        </div>
        <div className="flex h-[74px] w-full items-center gap-3 px-3 md:h-20">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded px-1.5 py-1">
          <img src={logoUrl} alt="Orchard Growers" className="h-[62px] w-auto object-contain md:h-[68px]" />
        </Link>
        <nav className="hidden h-10 min-w-0 flex-1 rounded-md bg-green-700 px-1 md:block" aria-label="Primary navigation">
          <div className="flex h-full items-stretch text-sm font-semibold text-white">
            <div className="group relative flex h-full items-center">
              <Link
                to="/"
                className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-2 text-white hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2"
              >
                All Products
              </Link>
              <div className="invisible absolute left-0 top-full z-50 max-h-[270px] w-64 overflow-y-auto rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {productDropdownItems.map((item) => (
                  <Link
                    key={item.key}
                    to={`/?section=${encodeURIComponent(item.key)}`}
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative flex h-full items-center">
              <Link to="/ourservices/services" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2">
                Our Services
              </Link>
              <div className="invisible absolute left-0 top-full z-50 max-h-[270px] w-48 overflow-y-auto rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {serviceDropdownItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative flex h-full items-center">
              <Link to="/education/learn" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2">
                Education and Tips
              </Link>
              <div className="invisible absolute left-0 top-full z-50 w-48 rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {educationDropdownItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative flex h-full items-center">
              <Link to="/save-our-earth/blogs" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2">
                Save Our Earth
              </Link>
              <div className="invisible absolute left-0 top-full z-50 w-48 rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {earthDropdownItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link to="/bulk-order-enquiry" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2">
              Ask Bulk Order Quotation
            </Link>
          </div>
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center rounded-full border border-green-200 bg-green-50 px-3 md:w-[300px] md:flex-none md:shrink-0">
          <input
            placeholder="Search for plants, tools, and more..."
            className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-500"
          />
          <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-green-800 hover:bg-green-100" aria-label="Voice search">
            <FaMicrophone />
          </button>
          <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-white hover:bg-green-800" aria-label="Search">
            <FaSearch />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xl text-green-700 md:hidden">
          <Link to={accountPath} aria-label="Account" title="Account" className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 hover:text-green-900">
            <FaUser />
          </Link>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Cart"
            title="Cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-green-50 hover:text-green-900"
          >
            <FaShoppingCart />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
        <div className="hidden shrink-0 items-center gap-5 text-2xl text-green-700 md:flex">
          <button
            type="button"
            onClick={openOrchardInstallPrompt}
            className="rounded-full border border-green-700 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
          >
            Download App
          </button>
          <Link to={accountPath} aria-label="Account" title="Account" className="hover:text-green-900">
            <FaUser />
          </Link>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Cart"
            title="Cart"
            className="relative hover:text-green-900"
          >
            <FaShoppingCart />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
      </header>
      <ShoppingCartPopup open={cartOpen} items={cartItems} onClose={() => setCartOpen(false)} />
    </>
  );
}

function ShoppingCartPopup({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const updateItemQuantity = (productId: string, quantity: number) => {
    const next = items.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item
    );
    saveCartItems(next);
  };

  const removeItem = (productId: string) => {
    saveCartItems(items.filter((item) => item.productId !== productId));
  };

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className={`fixed inset-0 z-[70] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close shopping cart"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/25 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[450px] flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between px-6 py-6">
          <h2 className="text-lg font-medium text-slate-900">Shopping cart</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-3xl font-light leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        {!items.length ? (
          <div className="flex flex-1 flex-col items-center justify-start px-8 pt-20 text-center">
            <FaShoppingCart className="text-5xl text-slate-400" />
            <p className="mt-4 text-sm font-medium text-slate-900">Your cart is empty</p>
            <p className="mt-2 text-sm text-slate-500">Start shopping to add items to your cart.</p>
            <button
              type="button"
              onClick={() => goTo("/products")}
              className="mt-7 rounded-md bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-green-700"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-4">
              {items.map((item) => (
                <div key={item.productId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-green-50 text-green-700">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full rounded-md object-cover" /> : <FaShoppingCart />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">Rs. {item.unitPrice}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItemQuantity(item.productId, Number(event.target.value || 1))}
                          className="h-9 w-20 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-green-600"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-sm font-medium text-slate-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                <span>Subtotal</span>
                <span>Rs. {subtotal}</span>
              </div>
              <button
                type="button"
                onClick={() => goTo("/checkout")}
                className="mt-4 w-full rounded-md bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700"
              >
                Checkout
              </button>
              <button
                type="button"
                onClick={() => goTo("/cart")}
                className="mt-3 w-full rounded-md border border-green-600 px-5 py-3 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                View Cart
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function SortByMenu({ active, onChange }: { active: string; onChange: (section: string) => void }) {
  const activeLabel = desktopSections.find((section) => section.key === active)?.label || "All Products";

  return (
    <details className="group relative text-xs text-slate-600">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm px-1 py-0.5 font-semibold hover:bg-white">
        Sort by:
        <span className="max-w-[190px] truncate text-slate-900">{activeLabel}</span>
        <FaChevronDown className="text-[10px] text-yellow-600 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-1 max-h-72 w-64 overflow-y-auto rounded-sm border border-slate-300 bg-white py-1 text-sm shadow-lg">
        {desktopSections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => onChange(section.key)}
            className={`flex w-full items-start gap-2 px-3 py-2 text-left font-semibold hover:bg-green-50 ${
              active === section.key ? "bg-green-50 text-green-800" : "text-slate-900"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                active === section.key ? "border-green-700 bg-green-700 text-white" : "border-slate-400 bg-white"
              }`}
              aria-hidden="true"
            >
              {active === section.key ? "✓" : ""}
            </span>
            <span className="leading-snug">{section.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function MultiSortByMenu({ active, onChange }: { active: string[]; onChange: (section: string) => void }) {
  const activeLabel = getSelectedSortTitle(active);

  return (
    <details className="group relative text-xs text-slate-600">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm px-1 py-0.5 font-semibold hover:bg-white">
        Sort by:
        <span className="max-w-[190px] truncate text-slate-900">{activeLabel}</span>
        <FaChevronDown className="text-[10px] text-yellow-600 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-1 max-h-72 w-64 overflow-y-auto rounded-sm border border-slate-300 bg-white py-1 text-sm shadow-lg">
        {desktopSections.map((section) => {
          const checked = active.includes(section.key);
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onChange(section.key)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left font-semibold hover:bg-green-50 ${
                checked ? "bg-green-50 text-green-800" : "text-slate-900"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                  checked ? "border-green-700 bg-green-700 text-white" : "border-slate-400 bg-white"
                }`}
                aria-hidden="true"
              >
                {checked && <FaCheck className="text-[10px]" />}
              </span>
              <span className="leading-snug">{section.label}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

function StickyWhatsapp() {
  return (
    <a
      href="https://wa.me/917018108900"
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#00c853] text-3xl text-white shadow-xl transition hover:scale-105 hover:bg-[#00b34a]"
    >
      <FaWhatsapp />
    </a>
  );
}

function BannerSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setActive((value) => (value + 1) % bannerImages.length), 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-lg bg-black shadow-sm">
      <div className="flex aspect-[3.45/1] items-center justify-center">
        <img src={bannerImages[active]} alt="Orchard Growers banner" className="h-full w-full object-fill" />
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
        {bannerImages.slice(0, 6).map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => setActive(index)}
            className={`h-2.5 w-2.5 rounded-full ${active === index ? "bg-white" : "bg-white/55"}`}
            aria-label={`Show banner ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function TopFilters({ active, onChange }: { active: string; onChange: (tab: string) => void }) {
  return (
    <div className="px-3 pt-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {mobileTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
              active === tab.key ? "bg-green-700 text-white" : "bg-white text-green-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroCard({ onList }: { onList: () => void }) {
  return (
    <section className="mx-3 mt-3 rounded-[28px] bg-white shadow-sm ring-1 ring-green-100">
      <div className="relative overflow-hidden rounded-[28px]">
        <img src={orchardCover} alt="Fresh orchard plants" className="h-44 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-200">Orchard Growers</p>
          <h1 className="mt-2 text-xl font-semibold leading-tight">Search for plants, tools, and more...</h1>
          <p className="mt-2 text-sm text-green-100">Products, plants, services, education tips, and Save Our Earth updates.</p>
          <button onClick={onList} className="mt-4 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold uppercase text-green-950">
            🌱 Bulk Order Enquiry
          </button>
        </div>
      </div>
    </section>
  );
}

function MobileSectionContent({
  activeTab,
  items,
  onOpen,
  onRate,
  onOpenImage,
  onStockIssue,
}: {
  activeTab: string;
  items: Product[];
  onOpen: () => void;
  onRate: (product: Product) => void;
  onOpenImage: (preview: ProductImagePreview) => void;
  onStockIssue: (message: string) => void;
}) {
  const title = mobileTabs.find((tab) => tab.key === activeTab)?.label || "Products and Plants";
  if (activeTab !== "products") {
    return <InfoSection title={title} text={`${title} content will appear here.`} />;
  }

  return (
    <section className="mt-4 px-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black">Products and Plants</h2>
        <button onClick={onOpen} className="rounded-full bg-green-700 px-4 py-1 text-[10px] font-medium text-white">View All</button>
      </div>
      {!items.length ? (
        <MobileEmptyState text="No products available at the moment." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {items.map((product) => (
            <MarketCard
              key={product._id}
              item={product}
              onView={onOpen}
              onRate={onRate}
              onOpenImage={onOpenImage}
              onStockIssue={onStockIssue}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FruitPlantShortcuts() {
  return (
    <section className="mx-3 mt-4">
      <h2 className="mb-2 text-sm font-semibold text-black">Popular Fruit Plants</h2>
      <div className="grid grid-cols-3 gap-3">
        {fruitPlants.map((fruit) => (
          <button key={fruit.name} className="rounded-2xl border border-green-100 bg-green-50 p-3 text-center">
            <span className="text-2xl">{fruit.icon}</span>
            <p className="mt-2 text-[11px] font-semibold text-slate-900">{fruit.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlantCategoryGrid({ mobile = false }: { mobile?: boolean }) {
  return (
    <section className={mobile ? "mx-3 mt-4" : ""}>
      <h2 className="mb-2 text-sm font-semibold text-black">Plant Category</h2>
      <div className="grid grid-cols-2 gap-3">
        {plantCategories.map((category) => (
          <article key={category.title} className="rounded-md border border-green-100 bg-green-50 p-3">
            <h3 className="text-sm font-semibold text-slate-950">{category.title}</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{category.text}</p>
            <button className="mt-3 rounded-full bg-green-700 px-3 py-1 text-xs font-medium text-white">Explore</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function DesktopSection({
  selections,
  visibleListings,
  highestDeals,
  feedItems,
  onOpen,
  onRate,
  onOpenImage,
  onStockIssue,
}: {
  selections: string[];
  visibleListings: Product[];
  highestDeals: HighestDeal[];
  feedItems: FeedItem[];
  onOpen: () => void;
  onRate: (product: Product) => void;
  onOpenImage: (preview: ProductImagePreview) => void;
  onStockIssue: (message: string) => void;
}) {
  if (!selections.length || selections.includes("products")) {
    return <WebSectionPost title="All Products" text="Orchard Growers product showcases."><DesktopLotPost items={visibleListings} onRate={onRate} onOpenImage={onOpenImage} onStockIssue={onStockIssue} /></WebSectionPost>;
  }

  const title = getSelectedSortTitle(selections);
  if (selections.some((section) => section.startsWith("category:") || section.startsWith("price:") || section.startsWith("season:"))) {
    return <WebSectionPost title={title} text={`Showing Orchard Growers products for ${title.toLowerCase()}.`}><DesktopLotPost items={visibleListings} onRate={onRate} onOpenImage={onOpenImage} onStockIssue={onStockIssue} /></WebSectionPost>;
  }

  if (selections.includes("highestDeals")) {
    return <WebSectionPost title="Highest Deals of The Day" text="Track best deal price activity."><HighestDealsGrid items={highestDeals} /></WebSectionPost>;
  }

  if (!feedItems.length) return <EmptyFeed onAdd={onOpen} />;
  return <>{feedItems.slice(0, 4).map((item) => <FeedPost key={item.id} item={item} onOpen={onOpen} />)}</>;
}

function WebSectionPost({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-green-800 text-xs font-bold text-white">OG</div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-600">19h - Public</p>
          </div>
          <button className="rounded-full p-2 text-slate-600 hover:bg-slate-100">...</button>
        </div>
        <p className="mt-3 text-sm leading-5 text-slate-900">{text}</p>
      </div>
      <div className="border-t border-slate-100 p-3">{children}</div>
    </article>
  );
}

function LegacyDesktopLotPost({ items, onOpen }: { items: Product[]; onOpen: () => void }) {
  if (!items.length) return <DesktopEmptyState text="No products available at the moment." />;
  const product = items[0];
  const imageUrl = getProductImage(product);
  return (
    <button onClick={onOpen} className="flex w-full overflow-hidden rounded-md border border-slate-200 bg-white text-left hover:border-green-400">
      <div className="w-44 shrink-0 bg-green-50">
        {imageUrl ? <img src={imageUrl} alt={product.title} className="block h-auto w-full" /> : <div className="flex h-full items-center justify-center text-2xl text-green-700">🌱</div>}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-black">{product.title || "Plant"}</h3>
        <p className="truncate text-sm font-semibold text-slate-600">Orchard Growers</p>
        <p className="mt-2 text-sm font-semibold text-black">₹{product.basePrice || 0}</p>
      </div>
    </button>
  );
}

function DesktopLotPost({
  items,
  onRate,
  onOpenImage,
  onStockIssue,
}: {
  items: Product[];
  onRate: (product: Product) => void;
  onOpenImage: (preview: ProductImagePreview) => void;
  onStockIssue: (message: string) => void;
}) {
  if (!items.length) return <DesktopEmptyState text="No products available at the moment." />;
  return (
    <div className="space-y-3">
      {items.map((product) => (
        <article key={product._id} className="overflow-hidden rounded-md border border-slate-200 bg-white hover:border-green-400">
          <ProductDescriptionPreview product={product} />
          <ProductImageCarousel
            product={product}
            containerClassName=""
            onOpenImage={onOpenImage}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-end">
            <div className="min-w-0 text-sm text-black">
              <h3 className="line-clamp-1 font-semibold">{product.title || "Product Name"}</h3>
              <ProductPriceLine product={product} />
              <ProductStockLine product={product} />
              <p className="mt-2 line-clamp-1 font-medium">{product.description || "Product Description"}</p>
              <ProductRatingSummary />
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => onRate(product)}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
              >
                Rate Product
              </button>
              <button
                type="button"
                disabled={!isProductInStock(product)}
                onClick={() => {
                  const stockIssue = addProductToCart(product);
                  if (stockIssue) onStockIssue(stockIssue);
                }}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
              >
                {isProductInStock(product) ? "Add to Cart" : "Currently unavailable"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductImageCarousel({
  product,
  containerClassName,
  compact = false,
  onOpenImage,
}: {
  product: Product;
  containerClassName: string;
  compact?: boolean;
  onOpenImage?: (preview: ProductImagePreview) => void;
}) {
  const images = getProductImages(product);
  const [activeImage, setActiveImage] = useState(0);

  if (!images.length) {
    return (
      <div className={`${compact ? "mb-2 rounded-md" : ""} flex min-h-32 ${containerClassName} items-center justify-center bg-green-50 text-sm font-semibold text-green-700`}>
        Plant
      </div>
    );
  }

  const activeAlt = `${product.title || "Product"} ${activeImage + 1}`;
  const showPrevious = () => setActiveImage((current) => (current === 0 ? images.length - 1 : current - 1));
  const showNext = () => setActiveImage((current) => (current + 1) % images.length);

  return (
    <div className={`${compact ? "mb-2 rounded-md" : ""} relative ${containerClassName} overflow-hidden bg-green-50`}>
      <button
        type="button"
        onClick={() => onOpenImage?.({ images, activeIndex: activeImage, title: product.title || "Product" })}
        className="block w-full"
        aria-label={`Open ${activeAlt} fullscreen`}
      >
        <img src={images[activeImage]} alt={activeAlt} className="block h-auto w-full" />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
            aria-label="Show previous product image"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
            aria-label="Show next product image"
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

function LegacyMarketCard({ item, onView }: { item: Product; onView: () => void }) {
  const imageUrl = getProductImage(item);
  return (
    <article className="min-w-[165px] rounded-md border border-slate-200 bg-white p-2">
      <div className="mb-2 overflow-hidden rounded-md bg-green-100">
        {imageUrl ? <img src={imageUrl} alt={item.title} className="block h-auto w-full" /> : <div className="flex min-h-32 items-center justify-center text-2xl text-green-700">🌱</div>}
      </div>
      <h3 className="line-clamp-1 text-xs font-semibold text-black">{item.title || "Plant"}</h3>
      <p className="truncate text-[10px] font-medium text-slate-600">Orchard Growers</p>
      <button onClick={onView} className="mt-2 rounded-full bg-slate-200 px-3 py-1 text-[9px] font-medium text-slate-700">Explore</button>
    </article>
  );
}

function MarketCard({
  item,
  onView,
  onRate,
  onOpenImage,
  onStockIssue,
}: {
  item: Product;
  onView: () => void;
  onRate: (product: Product) => void;
  onOpenImage: (preview: ProductImagePreview) => void;
  onStockIssue: (message: string) => void;
}) {
  return (
    <article className="min-w-[210px] rounded-md border border-slate-200 bg-white p-2">
      <ProductDescriptionPreview product={item} compact />
      <ProductImageCarousel
        product={item}
        containerClassName=""
        compact
        onOpenImage={onOpenImage}
      />
      <div className="text-xs text-black">
        <h3 className="line-clamp-1 font-semibold">{item.title || "Product Name"}</h3>
        <ProductPriceLine product={item} compact />
        <ProductStockLine product={item} compact />
        <p className="mt-1 line-clamp-1 font-medium">{item.description || "Product Description"}</p>
        <ProductRatingSummary compact />
      </div>
      <div className="mt-2 grid gap-1.5">
        <button onClick={() => onRate(item)} className="rounded-md bg-green-700 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-green-800">
          Rate Product
        </button>
        <button
          disabled={!isProductInStock(item)}
          onClick={() => {
            const stockIssue = addProductToCart(item);
            if (stockIssue) onStockIssue(stockIssue);
          }}
          className="rounded-md bg-green-700 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
        >
          {isProductInStock(item) ? "Add to Cart" : "Currently unavailable"}
        </button>
      </div>
    </article>
  );
}

function HighestDealsSection({ items }: { items: HighestDeal[] }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-semibold text-black">Popular Fruit Plants</h2>
      <HighestDealsGrid items={items} />
    </section>
  );
}

function HighestDealsGrid({ items }: { items: HighestDeal[] }) {
  if (!items.length) return <MobileEmptyState text="No products available at the moment." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <article key={item.category} className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-green-800">{item.category}</p>
          <h3 className="mt-1 line-clamp-1 text-xs font-semibold text-black">{item.title}</h3>
          <p className="mt-2 text-sm font-semibold text-black">₹{item.amount}</p>
        </article>
      ))}
    </div>
  );
}

function InfoSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-semibold text-black">{title}</h2>
      <MobileEmptyState text={text} />
    </section>
  );
}

function MobileEmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-xs font-medium text-green-800">{text}</div>;
}

function DesktopEmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-sm font-semibold text-green-800">{text}</div>;
}

function ProductDescriptionPreview({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const description = product.description || `${product.title || product.fruitName || "This product"} from Orchard Growers.`;
  const descriptionLines = getStructuredDescriptionLines(description);

  return (
    <div className={compact ? "mb-2 text-[10px] leading-4 text-slate-700" : "border-b border-slate-100 p-3 text-sm leading-5 text-slate-700"}>
      {expanded ? (
        <div className="space-y-1.5">
          {descriptionLines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      ) : (
        <p className={compact ? "line-clamp-2" : "line-clamp-2"}>{descriptionLines.join(" ")}</p>
      )}
      {description.length > 72 && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-xs font-semibold text-green-700 hover:text-green-800"
        >
          {expanded ? "Show Less" : "Show More"}
        </button>
      )}
    </div>
  );
}

function getStructuredDescriptionLines(description: string) {
  return description
    .replace(/\*\*/g, "")
    .replace(/^\s*#+\s*/, "")
    .replace(/\s+---\s+/g, "\n")
    .replace(/\s+-\s+/g, "\n")
    .replace(/\s+(?=(?:What is|Key Features|Suitable for|Known for|At Orchard Growers|Premium Fruit Stores|Early Harvesting Variety)\b)/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function ProductStockLine({ product, compact = false }: { product: Product; compact?: boolean }) {
  const stock = getProductStock(product);
  const inStock = isProductInStock(product);

  return (
    <p className={`${compact ? "mt-1 text-[10px]" : "mt-1 text-xs"} font-semibold ${inStock ? "text-green-700" : "text-rose-600"}`}>
      {inStock ? `Stock: ${stock} unit${stock === 1 ? "" : "s"}` : "Stock: 0 - Currently unavailable"}
    </p>
  );
}

function ProductPriceLine({ product, compact = false }: { product: Product; compact?: boolean }) {
  const price = Number(product.basePrice || 0);
  const discount = Math.max(0, Number(product.discountPercent || 0));
  const discountedPrice = discount > 0 ? Math.max(0, price - (price * discount) / 100) : price;

  return (
    <div className={`${compact ? "mt-1 text-[10px]" : "mt-1 text-xs"} flex flex-wrap items-center gap-1.5 font-bold`}>
      {price > 0 && <span className="text-slate-900">Rs. {Math.round(discountedPrice)}</span>}
      {discount > 0 && (
        <>
          <span className="text-slate-400 line-through">Rs. {Math.round(price)}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{discount}% off</span>
        </>
      )}
    </div>
  );
}

function ProductRatingSummary({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-1 text-[10px]" : "mt-2 text-xs"} flex flex-wrap items-center gap-1.5`}>
      <span className="flex items-center gap-0.5 text-slate-300" aria-label="No rating yet">
        {Array.from({ length: 5 }, (_, index) => (
          <FaStar key={index} aria-hidden="true" />
        ))}
      </span>
      <span className="font-semibold text-slate-600">No rating yet</span>
    </div>
  );
}

function StockNoticePopup({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 px-4">
      <section className="w-full max-w-xs rounded-lg bg-white p-5 text-center shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Stock Alert</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-md bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          OK
        </button>
      </section>
    </div>
  );
}

function RatingPopup({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!product) return;
    setRating(5);
    setComment("");
  }, [product]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
      <section className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Rate Product</h2>
            <p className="mt-1 line-clamp-1 text-sm text-slate-600">{product.title || "Orchard Growers product"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="text-2xl"
                aria-label={`Rate ${value} out of 5`}
              >
                <FaStar className={value <= rating ? "text-amber-400" : "text-slate-300"} aria-hidden="true" />
              </button>
            );
          })}
          <span className="text-sm font-semibold text-slate-700">{rating} out of 5</span>
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Comment
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share your experience with this product"
            className="mt-2 min-h-24 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-700"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={onClose} className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
            Submit Rating
          </button>
        </div>
      </section>
    </div>
  );
}

function ImagePreviewModal({
  preview,
  onClose,
}: {
  preview: ProductImagePreview | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!preview) return;
    setZoom(1);
    setActiveIndex(preview.activeIndex);
  }, [preview]);

  if (!preview) return null;

  const activeSrc = preview.images[activeIndex] || preview.images[0];
  const activeAlt = `${preview.title} ${activeIndex + 1}`;
  const showPrevious = () => {
    setZoom(1);
    setActiveIndex((current) => (current === 0 ? preview.images.length - 1 : current - 1));
  };
  const showNext = () => {
    setZoom(1);
    setActiveIndex((current) => (current + 1) % preview.images.length);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/95">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow hover:bg-green-50"
          aria-label="Zoom out"
        >
          <FaSearchMinus aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow hover:bg-green-50"
          aria-label="Zoom in"
        >
          <FaSearchPlus aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-900 shadow hover:bg-green-50"
          aria-label="Close fullscreen image"
        >
          ×
        </button>
      </div>
      {preview.images.length > 1 && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow hover:bg-green-50"
            aria-label="Show previous image"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow hover:bg-green-50"
            aria-label="Show next image"
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        </>
      )}
      <div className="flex h-full w-full items-center justify-center overflow-auto p-6">
        <img
          src={activeSrc}
          alt={activeAlt}
          className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
      {preview.images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800">
          {activeIndex + 1} / {preview.images.length}
        </div>
      )}
    </div>
  );
}

function ProfileCard({ user, isSignedIn, onOpen }: { user: UserProfile; isSignedIn: boolean; onOpen: () => void }) {
  if (!isSignedIn) {
    return (
      <button onClick={onOpen} className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-green-300">
        <div className="h-20 bg-cover bg-center" style={{ backgroundImage: `url(${orchardCover})` }} />
        <div className="px-4 pb-4">
          <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-2xl font-bold text-white">
            <FaUser aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-xl font-semibold leading-tight text-slate-900">Sign in to view account</h1>
          <p className="mt-1 text-xs text-slate-500">Your profile details will appear after login.</p>
          <p className="mt-2 text-xs font-semibold text-green-700">Login or create an account</p>
        </div>
      </button>
    );
  }

  const displayName = user.orchardName || user.businessName || user.name || "Orchard Growers";
  return (
    <button onClick={onOpen} className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-green-300">
      <div className="h-20 bg-cover bg-center" style={{ backgroundImage: `url(${user.bannerUrl || orchardCover})` }} />
      <div className="px-4 pb-4">
        <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-2xl font-bold text-white">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="mt-3 text-xl font-semibold leading-tight text-slate-900">{displayName}</h1>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-green-700">Orchard Growers</p>
        <p className="mt-1 text-xs text-slate-500">{user.location || "Products and Plants"}</p>
        <p className="mt-2 text-xs font-semibold text-slate-700">WhatsApp: +917018108900</p>
      </div>
    </button>
  );
}

function StatsCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs">
      <div className="flex justify-between py-1.5"><span className="font-medium">Bulk Order Enquiry</span><span className="font-semibold text-green-700">Open</span></div>
      <div className="flex justify-between py-1.5"><span className="font-medium">Free Shipping</span><span className="font-semibold text-green-700">₹499+</span></div>
    </section>
  );
}

function CompanyCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <img src={logoUrl} alt="" className="mb-8 h-8 w-20 object-contain" />
      <h2 className="text-base font-semibold text-slate-900">Orchard Growers</h2>
      <p className="mt-2 text-xs text-slate-600">Plants, tools, services, education tips, and Save Our Earth updates.</p>
    </section>
  );
}

function SidebarContactCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 text-green-900">
      <img src={logoUrl} alt="Orchard Growers" className="mb-8 h-9 w-auto object-contain" />
      <div className="space-y-4 text-sm">
        <p>WhatsApp: +917018108900</p>
        <p>Call: +917018108900</p>
        <p>Email: care@orchardgrowers.in</p>
      </div>
      <div className="mt-5 flex items-center gap-5 text-xl">
        <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:text-green-700">
          <FaFacebookF />
        </a>
        <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-green-700">
          <FaInstagram />
        </a>
        <a href="https://www.youtube.com/results?search_query=Orchard+Growers" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:text-green-700">
          <FaYoutube />
        </a>
        <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-green-700">
          <FaLinkedinIn />
        </a>
      </div>
    </section>
  );
}

function SidebarLinkCard({ title, links }: { title: string; links: NavLinkItem[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 text-green-900">
      <h2 className="text-lg font-semibold text-green-800">{title}</h2>
      <div className="mt-4 space-y-4 text-sm">
        {links.map((link) => (
          <Link key={link.label} to={link.to} className="block hover:text-green-700">
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function FooterLinkSection() {
  return (
    <footer className="border-t border-green-900 bg-white px-7 py-10 text-green-900">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <section>
            <img src={logoUrl} alt="Orchard Growers" className="h-16 w-auto object-contain" />
            <div className="mt-6 space-y-3 text-sm font-medium">
              <p>WhatsApp: +917018108900</p>
              <p>Call: +917018108900</p>
              <p>Email: care@orchardgrowers.in</p>
            </div>
            <div className="mt-6 flex items-center gap-5 text-2xl">
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:text-orange-500"><FaFacebookF /></a>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-orange-500"><FaInstagram /></a>
              <a href="https://www.youtube.com/results?search_query=Orchard+Growers" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:text-orange-500"><FaYoutube /></a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-orange-500"><FaLinkedinIn /></a>
            </div>
          </section>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FooterColumn title="About Us" links={aboutLinks} />
            <FooterColumn title="Become Partner" links={partnerLinks} />
            <FooterColumn title="Support" links={supportLinks} />
          </div>
        </div>
        <div className="mt-10 border-t border-green-900/70 pt-7 text-center text-sm font-medium">
          &copy; 2026 Orchard Growers. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function FooterCopyrightStrip() {
  return (
    <footer className="border-t border-green-900 bg-white px-3 py-4 text-center text-sm font-medium text-green-900">
      &copy; 2026 Orchard Growers. All rights reserved.
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: NavLinkItem[] }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-green-800">{title}</h2>
      <div className="mt-5 space-y-4 text-sm font-medium">
        {links.map((link) => (
          <Link key={link.label} to={link.to} className="block hover:text-orange-500 hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function PostComposer({ user, onPost }: { user: UserProfile; onPost: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 font-bold text-white">{(user.name || "O").slice(0, 1).toUpperCase()}</div>
        <button onClick={onPost} className="min-h-11 flex-1 rounded-full bg-green-700 px-5 text-center text-sm font-semibold text-white hover:bg-green-800">🌱 Bulk Order Enquiry</button>
      </div>
    </section>
  );
}

function FeedPost({ item, onOpen }: { item: FeedItem; onOpen: () => void }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="p-3 pb-0">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-green-800 text-xs font-bold text-white">OG</div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-900">{item.brand}</h2>
            <p className="text-xs text-slate-600">{item.timeLabel} - Public</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-slate-900">{item.text}</p>
      </div>
      <button onClick={onOpen} className="mt-3 block w-full bg-slate-100 text-left">
        <img src={item.imageUrl} alt={item.title} className="max-h-[420px] w-full object-cover" />
      </button>
    </article>
  );
}

function NewsCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold text-black">Orchard Updates</h2>
      <p className="mb-3 mt-2 text-base font-semibold text-slate-600">Top options</p>
      <div className="space-y-3">
        {newsItems.map((title) => (
          <div key={title}>
            <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">Orchard Growers</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdCard({ onListLot }: { onListLot: () => void }) {
  return (
    <section className="rounded-sm border border-slate-300 bg-white p-4 text-center">
      <p className="rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">Products and Plants | Our Services | Education and Tips</p>
      <button onClick={onListLot} className="mt-4 rounded-full border border-green-700 px-5 py-1 text-sm font-semibold text-green-700 hover:bg-green-50">Explore</button>
    </section>
  );
}

function EmptyFeed({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h2 className="text-base font-semibold text-slate-900">No products available at the moment.</h2>
      <button onClick={onAdd} className="mt-4 rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white">Explore</button>
    </section>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile>(() => getStoredUser());
  const userName = user.name || user.orchardName || user.businessName || "Orchard Growers Customer";
  const [addresses, setAddresses] = useState<SavedAddresses>(() => getSavedAddresses(user));
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const addressVerified = isAddressComplete(addresses.shipping);

  const updateAddress = (type: keyof SavedAddresses, field: keyof AddressForm, value: string) => {
    setAddresses((current) => {
      const next = {
        ...current,
        [type]: { ...current[type], [field]: value },
      };
      if (type === "permanent" && sameAsPermanent) {
        next.shipping = { ...next.permanent };
      }
      return next;
    });
  };

  const detectAddress = async (type: keyof SavedAddresses) => {
    const pinCode = addresses[type].pinCode.trim();
    setAddressMessage("");
    if (!/^\d{6}$/.test(pinCode)) {
      setAddressMessage("Enter a valid 6 digit PIN code.");
      return;
    }

    try {
      const detected = await lookupIndianPinCode(pinCode);
      setAddresses((current) => {
        const nextAddress = {
          ...current[type],
          city: detected.city,
          district: detected.district,
          state: detected.state,
          country: "India",
        };
        const next = { ...current, [type]: nextAddress };
        if (type === "permanent" && sameAsPermanent) next.shipping = nextAddress;
        return next;
      });
      setAddressMessage(`Address detected for ${pinCode}.`);
    } catch (err) {
      setAddressMessage(err instanceof Error ? err.message : "Could not detect address from PIN code.");
    }
  };

  const saveAddresses = () => {
    const next = sameAsPermanent ? { ...addresses, shipping: { ...addresses.permanent } } : addresses;
    setAddresses(next);
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(next));
    setAddressMessage("Address saved. Checkout will use your shipping address.");
  };

  const uploadProfilePic = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileMessage("");
    if (!file.type.startsWith("image/")) {
      setProfileMessage("Please choose an image file.");
      return;
    }

    try {
      const avatarUrl = await fileToProfileImageDataUrl(file);
      const nextUser = { ...user, avatarUrl };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      window.dispatchEvent(new Event("orchard-auth-updated"));
      setProfileMessage("Profile picture updated.");
    } catch {
      setProfileMessage("Could not upload this profile picture. Please try another image.");
    } finally {
      event.target.value = "";
    }
  };

  const logout = () => {
    clearOrchardSession();
    setUser({});
    navigate("/", { replace: true });
  };
  
  return (
    <section className="w-full rounded-lg border border-green-200 bg-gradient-to-b from-green-50 to-green-100 p-6">
      <div className="grid gap-8 md:grid-cols-2 md:items-center">
        {/* Left Column - Profile Form */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-green-900">My Profile</h1>
            <p className="mt-2 text-base text-green-700">Manage your account information and preferences</p>
          </div>
          
          <div className="space-y-4 rounded-lg bg-white p-6 shadow-lg">
            <ProfileField label="Full Name" value={userName} />
            <ProfileField label="Location" value={user.location || "India"} />
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-xs font-medium uppercase text-green-700">Status</p>
              <div className="mt-2 flex items-center gap-2">
                {addressVerified ? (
                  <>
                    <FaCheck className="text-green-600" />
                    <p className="text-base font-semibold text-green-700">Address Verified</p>
                  </>
                ) : (
                  <p className="text-base font-semibold text-yellow-700">Address Not Verified</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link to="/products" className="inline-flex min-h-11 items-center justify-center rounded-full bg-green-700 px-4 py-2 text-center text-sm font-semibold text-white transition-all hover:bg-green-800 sm:px-6 sm:py-3">
              Browse Products
            </Link>
            <Link to="/cart" className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-green-700 px-4 py-2 text-center text-sm font-semibold text-green-700 transition-all hover:bg-green-50 sm:px-6 sm:py-3">
              View Cart
            </Link>
            <button type="button" onClick={openOrchardInstallPrompt} className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-green-700 px-4 py-2 text-center text-sm font-semibold text-green-700 transition-all hover:bg-green-50 sm:px-6 sm:py-3">
              Download App
            </button>
            <button type="button" onClick={logout} className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-red-600 px-4 py-2 text-center text-sm font-semibold text-red-700 transition-all hover:bg-red-50 sm:px-6 sm:py-3">
              Logout
            </button>
          </div>
        </div>

        {/* Right Column - Image/Banner */}
        <div className="flex items-center justify-center">
          <div className="relative h-80 w-full rounded-lg bg-gradient-to-br from-green-500 to-green-700 p-8 text-white shadow-2xl">
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={userName}
                  className="h-24 w-24 rounded-full border-4 border-white/40 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
                  <FaUser className="text-6xl opacity-30" />
                </div>
              )}
              <h2 className="text-2xl font-bold">Welcome to Your Profile</h2>
              <p className="text-base opacity-90">
                {userName}
              </p>
              <p className="mt-4 text-sm opacity-80">
                {user.isVerified ? "Your account is verified" : "Complete your profile to get verified"}
              </p>
              <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-green-800 shadow-sm transition hover:bg-green-50">
                <FaCamera />
                Upload Profile Pic
                <input type="file" accept="image/*" className="hidden" onChange={uploadProfilePic} />
              </label>
              {profileMessage && <p className="text-xs font-medium text-white/90">{profileMessage}</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 rounded-lg bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-green-900">Buyer and Shipping Details</h2>
            <p className="mt-1 text-sm text-green-700">Save buyer, permanent, and shipping address details for faster checkout.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-green-800">
            <input
              type="checkbox"
              checked={sameAsPermanent}
              onChange={(event) => {
                const checked = event.target.checked;
                setSameAsPermanent(checked);
                if (checked) {
                  setAddresses((current) => ({ ...current, shipping: { ...current.permanent } }));
                }
              }}
              className="h-4 w-4 accent-green-700"
            />
            Shipping same as permanent
          </label>
        </div>
        {addressMessage && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{addressMessage}</p>}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <AddressEditor
            title="Permanent Address"
            value={addresses.permanent}
            onChange={(field, value) => updateAddress("permanent", field, value)}
            onDetect={() => detectAddress("permanent")}
          />
          <AddressEditor
            title="Shipping Address"
            value={addresses.shipping}
            disabled={sameAsPermanent}
            onChange={(field, value) => updateAddress("shipping", field, value)}
            onDetect={() => detectAddress("shipping")}
          />
        </div>
        <button onClick={saveAddresses} className="mt-6 rounded-full bg-green-700 px-6 py-3 text-sm font-semibold text-white hover:bg-green-800">
          Save Addresses
        </button>
      </div>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-green-700">{label}</label>
      <p className="rounded-md bg-green-50 px-4 py-3 text-base font-medium text-slate-900">{value}</p>
    </div>
  );
}

function AddressEditor({
  title,
  value,
  disabled = false,
  onChange,
  onDetect,
}: {
  title: string;
  value: AddressForm;
  disabled?: boolean;
  onChange: (field: keyof AddressForm, value: string) => void;
  onDetect: () => void;
}) {
  const fields: { key: keyof AddressForm; label: string; required?: boolean }[] = [
    { key: "line1", label: "House / Building / Street", required: true },
    { key: "line2", label: "Area / Village / Locality" },
    { key: "landmark", label: "Landmark" },
    { key: "pinCode", label: "PIN code", required: true },
    { key: "city", label: "City / Post office", required: true },
    { key: "district", label: "District" },
    { key: "state", label: "State", required: true },
    { key: "country", label: "Country", required: true },
  ];

  return (
    <div className={`rounded-lg border border-green-100 p-4 ${disabled ? "bg-slate-50 opacity-80" : "bg-white"}`}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className={field.key === "line1" ? "text-sm font-medium text-slate-700 sm:col-span-2" : "text-sm font-medium text-slate-700"}>
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
            <input
              disabled={disabled}
              value={value[field.key]}
              onChange={(event) => onChange(field.key, field.key === "pinCode" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-green-600 disabled:bg-slate-100"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onDetect}
        className="mt-4 rounded-full border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
      >
        Auto Detect from PIN Code
      </button>
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    name: "",
    identifier: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pendingSocialProvider, setPendingSocialProvider] = useState<"google" | "facebook" | null>(null);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setTimeout(() => setOtpCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(location.search);
    const oauthError = queryParams.get("oauthError");
    const oauthSignup = queryParams.get("oauthSignup");

    if (oauthError) {
      setMessage(oauthError);
      if (oauthSignup === "google" || oauthSignup === "facebook") {
        setMode("signup");
        setAcceptedTerms(false);
      }
      window.history.replaceState({}, document.title, location.pathname);
      return;
    }

    if (hashParams.get("oauth") !== "success") return;

    const accessToken = hashParams.get("accessToken");
    const refreshToken = hashParams.get("refreshToken");
    const user = readOAuthUser(hashParams.get("user"));

    if (!accessToken || !refreshToken || !user) {
      setMessage("Social login response was incomplete. Please try again.");
      window.history.replaceState({}, document.title, location.pathname);
      return;
    }

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new Event("orchard-auth-updated"));
    window.history.replaceState({}, document.title, location.pathname);
    navigate("/profile", { replace: true });
  }, [location.pathname, location.search, navigate]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "identifier") {
      setOtpSent(false);
      setOtpCooldown(0);
    }
  };

  const switchAuthMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setMessage("");
    setOtpSent(false);
    setOtpCooldown(0);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      name: "",
      identifier: "",
      password: "",
      confirmPassword: "",
      otp: "",
    });
  };

  const sendLoginOtp = async () => {
    setMessage("");
    if (otpCooldown > 0) return;
    if (mode === "signup" && !form.name.trim()) {
      setMessage("Enter your full name before requesting OTP.");
      return;
    }

    if (!form.identifier) {
      setMessage("Enter your email address first.");
      return;
    }

    try {
      setLoading(true);
      const mobile = normalizeIndianMobile(form.identifier);
      const res = await API.post<{ message?: string }>("/auth/send-otp", {
        identifier: mobile || form.identifier,
        platform: "orchardgrowers",
        mode,
      });
      setOtpSent(true);
      setOtpCooldown(60);
      setMessage(res.data.message || "OTP sent.");
    } catch (err: any) {
      setMessage(err?.response?.data?.msg || err?.message || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (mode === "signup" && form.password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (mode === "signup" && !form.name.trim()) {
      setMessage("Full name is required.");
      return;
    }

    if (mode === "signup" && !acceptedTerms) {
      setMessage("Accept Terms & Conditions before continuing.");
      return;
    }

    try {
      setLoading(true);
      const mobile = normalizeIndianMobile(form.identifier);
      const authIdentifier = mobile || form.identifier;
      if (mobile) {
        if (!otpSent) {
          setMessage("Request phone OTP first.");
          return;
        }

        await API.post("/auth/verify-otp", {
          identifier: mobile,
          otp: form.otp,
          platform: "orchardgrowers",
        });
      } else {
        await API.post("/auth/verify-otp", { identifier: form.identifier, otp: form.otp, platform: "orchardgrowers" });
      }
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { identifier: authIdentifier, password: form.password, platform: "orchardgrowers" }
          : { name: form.name, identifier: authIdentifier, password: form.password, platform: "orchardgrowers" };
      const res = await API.post(endpoint, payload);

      if (res.data.accessToken) localStorage.setItem("accessToken", res.data.accessToken);
      if (res.data.refreshToken) localStorage.setItem("refreshToken", res.data.refreshToken);
      if (res.data.user) localStorage.setItem("user", JSON.stringify(res.data.user));
      window.dispatchEvent(new Event("orchard-auth-updated"));

      navigate("/profile");
    } catch (err: unknown) {
      setMessage(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const launchOAuth = (provider: "google" | "facebook", termsAcceptedForSignup = false) => {
    const url = getOrchardOAuthUrl(provider, mode, mode === "signup" && termsAcceptedForSignup);
    if (!url) {
      setMessage(`${provider === "google" ? "Google" : "Facebook"} login is not configured.`);
      return;
    }

    window.location.href = url;
  };

  const startOAuth = (provider: "google" | "facebook") => {
    if (mode === "signup") {
      setPendingSocialProvider(provider);
      return;
    }

    launchOAuth(provider, acceptedTerms);
  };

  return (
    <section className="-mt-3 flex min-h-[calc(100vh-5.25rem)] w-full items-stretch justify-center bg-[#eef6f0] px-3 py-2 md:-mt-5 md:min-h-[calc(100vh-5.5rem)] md:px-6 md:py-3">
      <div className="grid min-h-[calc(100vh-6.5rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-green-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_440px] lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="hidden bg-green-800 px-10 py-8 text-white md:flex md:flex-col md:justify-center lg:px-12">
          <Link to="/" className="inline-flex">
            <img src={logoUrl} alt="Orchard Growers" className="h-16 w-auto rounded bg-white/95 px-3 py-2 object-contain" />
          </Link>
          <div className="mt-12 max-w-xl lg:mt-16">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-green-100">Orchard Growers</p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight lg:text-5xl">Plants, tools, services, and orchard care in one place.</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-green-50">
              Sign in to manage your profile, cart, checkout, invoices, and courier order details.
            </p>
          </div>
          <p className="mt-auto text-sm text-green-100">Secure account access for Orchard Growers customers.</p>
        </div>

        <div className="flex min-h-0 items-center justify-center overflow-y-auto bg-white px-5 py-4 sm:px-8">
          <div className="my-auto w-full max-w-[390px] py-1">
            <div className="mb-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchAuthMode("login")}
                className={`h-9 rounded-md text-sm font-semibold transition ${
                  mode === "login" ? "bg-white text-green-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchAuthMode("signup")}
                className={`h-9 rounded-md text-sm font-semibold transition ${
                  mode === "signup" ? "bg-white text-green-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Signup
              </button>
            </div>

            <h1 className="text-center text-2xl font-semibold leading-tight text-black md:text-[28px]">
              {mode === "login" ? "Sign in to your account" : "Create your account"}
            </h1>

            {message && (
              <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{message}</p>
            )}

            <form onSubmit={submitAuth} className="mt-3 space-y-2" autoComplete="off">
              {mode === "signup" && (
                <input
                  type="text"
                  name="orchard-signup-name"
                  autoComplete="off"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  name="orchard-login-identifier"
                  autoComplete="new-password"
                  placeholder="Enter Email/Phone No."
                  value={form.identifier}
                  onChange={(event) => updateForm("identifier", event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={sendLoginOtp}
                  disabled={loading || otpCooldown > 0}
                  className="rounded-md border border-green-700 px-4 text-sm font-medium text-green-800 hover:bg-green-50"
                >
                  {otpCooldown > 0 ? `${otpCooldown}s` : "OTP"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="orchard-login-passcode"
                  autoComplete="new-password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-lg text-slate-500 hover:text-green-800"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {mode === "signup" && (
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="orchard-confirm-passcode"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    value={form.confirmPassword}
                    onChange={(event) => updateForm("confirmPassword", event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-lg text-slate-500 hover:text-green-800"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              )}
              <input
                type="text"
                name="orchard-login-otp"
                autoComplete="one-time-code"
                placeholder={otpSent ? "Enter OTP" : "Request OTP first"}
                value={form.otp}
                onChange={(event) => updateForm("otp", event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              />
              {mode === "login" && (
                <button
                  type="button"
                  className="text-sm font-medium text-green-800 hover:text-green-900"
                  onClick={() => setMessage("Password reset is not configured yet. Please use OTP login or contact support.")}
                >
                  Forgot password?
                </button>
              )}
              {mode === "signup" && (
                <label className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-700">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I accept the{" "}
                    <Link to="/support/termsandconditions" className="font-semibold text-green-800 underline">
                      Terms & Conditions
                    </Link>
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={loading}
                className="h-10 w-full rounded-md bg-green-800 px-5 text-sm font-medium text-white transition hover:bg-green-900 disabled:opacity-60"
              >
                {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
              </button>
            </form>

            <div className="my-3 flex items-center gap-4 text-xs text-slate-500">
              <div className="h-px flex-1 bg-slate-300" />
              <span>Or continue with</span>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            <div className="mx-auto grid max-w-[246px] grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => startOAuth("google")}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                <FaGoogle className="text-lg text-red-500" />
                Google
              </button>
              <button
                type="button"
                onClick={() => startOAuth("facebook")}
                className="h-9 w-full rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Facebook
              </button>
            </div>
          </div>
        </div>
      </div>
      {pendingSocialProvider && (
        <TermsSignupModal
          termsPath="/support/termsandconditions"
          onCancel={() => setPendingSocialProvider(null)}
          onAccept={() => {
            const provider = pendingSocialProvider;
            setAcceptedTerms(true);
            setPendingSocialProvider(null);
            launchOAuth(provider, true);
          }}
        />
      )}
    </section>
  );
}

function TermsSignupModal({ termsPath, onCancel, onAccept }: { termsPath: string; onCancel: () => void; onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">Accept Terms & Conditions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Please accept the Terms & Conditions to create your account with social signup.
        </p>
        <Link to={termsPath} className="mt-3 inline-flex text-sm font-semibold text-green-800 underline">
          Read Terms & Conditions
        </Link>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="button" onClick={onAccept} className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white">
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthPageLegacy() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <section className="mx-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg md:mx-auto md:max-w-3xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{mode === "login" ? "Sign in to Orchard Growers" : "Create your Orchard Growers account"}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "login"
              ? "Sign in to continue shopping and place orders on our platform."
              : "Sign up now to start buying plants, tools, and orchard supplies."}
          </p>
        </div>

        <form className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
          </div>
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
          {mode === "signup" && (
            <input
              type="password"
              placeholder="Confirm password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
          )}
          <button type="submit" className="w-full rounded-full bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800">
            {mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-center text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {mode === "login" ? "Don’t have an account?" : "Already have an account?"}
          </p>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="rounded-full border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>

        <div className="rounded-3xl bg-green-50 px-4 py-4 text-center text-sm text-green-700">
          Buying for the first time? Use sign up to create your account and start shopping instantly.
        </div>
      </div>
    </section>
  );
}

function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>(() => getCartItems());
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const updateItems = (next: CartItem[]) => {
    setItems(next);
    saveCartItems(next);
  };

  return (
    <section className="mx-3 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cart</h1>
          <p className="mt-1 text-sm text-slate-600">Review products before checkout.</p>
        </div>
        <Link to="/products" className="rounded-full border border-green-700 px-4 py-2 text-sm font-semibold text-green-800">Add Products</Link>
      </div>

      {!items.length ? (
        <DesktopEmptyState text="Your cart is empty. Add products to place an order." />
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={item.productId} className="flex flex-col gap-3 rounded-md border border-slate-200 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900">{item.title}</h2>
                <p className="text-sm text-slate-600">Rs. {item.unitPrice} each</p>
              </div>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) =>
                  updateItems(items.map((row) => row.productId === item.productId ? { ...row, quantity: Math.max(1, Number(event.target.value || 1)) } : row))
                }
                className="w-20 rounded-md border border-slate-300 px-3 py-2"
              />
              <p className="w-28 font-semibold">Rs. {item.quantity * item.unitPrice}</p>
              <button
                onClick={() => updateItems(items.filter((row) => row.productId !== item.productId))}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-lg font-semibold">Subtotal: Rs. {subtotal}</p>
            <button onClick={() => navigate("/checkout")} className="rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white">
              Checkout
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CheckoutPage() {
  const navigate = useNavigate();
  const [items] = useState<CartItem[]>(() => getCartItems());
  const [message, setMessage] = useState("");
  const [challanReady, setChallanReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [challanOrder, setChallanOrder] = useState<OrderInvoice | null>(null);
  const [lastDetectedPinCode, setLastDetectedPinCode] = useState("");
  const savedUser = getStoredUser();
  const savedShipping = getSavedAddresses(savedUser).shipping;
  const [form, setForm] = useState({
    name: savedUser.name || savedUser.buyerContactPerson || savedUser.businessName || "",
    phone: savedUser.phone || savedUser.contact || "",
    email: savedUser.email || "",
    line1: savedShipping.line1,
    line2: savedShipping.line2 || savedShipping.landmark,
    city: savedShipping.city,
    state: savedShipping.state,
    pinCode: savedShipping.pinCode,
  });
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingCharge = subtotal >= 499 ? 0 : 60;
  const taxAmount = Math.round(subtotal * 0.05);
  const totalAmount = subtotal + shippingCharge + taxAmount;

  useEffect(() => {
    if (!/^\d{6}$/.test(form.pinCode) || form.pinCode === lastDetectedPinCode) return;

    const id = window.setTimeout(async () => {
      try {
        const detected = await lookupIndianPinCode(form.pinCode);
        setForm((current) => ({
          ...current,
          city: detected.city,
          state: detected.state,
        }));
        setLastDetectedPinCode(form.pinCode);
        setMessage(`Address detected for ${form.pinCode}: ${detected.city}, ${detected.state}.`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not detect address from PIN code.");
      }
    }, 450);

    return () => window.clearTimeout(id);
  }, [form.pinCode, lastDetectedPinCode]);

  const createCheckoutOrder = (paymentMethod: "UPI" | "COD") =>
    API.post<OrderInvoice>("/orders/checkout", {
      items,
      customer: { name: form.name, phone: form.phone, email: form.email },
      shippingAddress: {
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        pinCode: form.pinCode,
        country: "India",
      },
      paymentMethod,
      courierTestKey: INDIA_POST_TEST_KEY,
    });

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("Opening payment gateway...");
    setChallanReady(false);
    setChallanOrder(null);
    setPaying(true);

    try {
      const res = await createCheckoutOrder("UPI");
      if (res.data.paymentStatus === "PAID") {
        saveCartItems([]);
        navigate(`/invoice/${res.data._id}`);
        return;
      }

      setChallanOrder(res.data);
      setChallanReady(true);
      setMessage("Thanks for your order. Payment is unpaid, so a challan has been generated for cash on delivery.");
    } catch (err: any) {
      try {
        const codRes = await createCheckoutOrder("COD");
        setChallanOrder(codRes.data);
        setChallanReady(true);
        setMessage("Thanks for your order. Payment was not collected online, so a cash on delivery challan has been generated.");
      } catch (codErr: any) {
        setMessage(codErr?.response?.data?.msg || err?.response?.data?.msg || "Could not place order");
      }
    } finally {
      setPaying(false);
    }
  };

  const confirmCodChallan = () => {
    if (challanOrder?._id) {
      saveCartItems([]);
      navigate(`/invoice/${challanOrder._id}`);
    }
  };

  if (!items.length) return <EmptyCheckout />;

  return (
    <section className="mx-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={placeOrder} className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Buyer Detail</h1>
        {message && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ["name", "Full name"],
            ["phone", "Contact no."],
            ["pinCode", "PIN code"],
            ["email", "Email"],
            ["line1", "Address line 1"],
            ["line2", "Address line 2"],
            ["city", "City"],
            ["state", "State"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm font-medium text-slate-700">
              {label}
              <input
                required={!["email", "line2"].includes(key)}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-green-600"
              />
            </label>
          ))}
        </div>
        <button
          disabled={paying}
          className="mt-6 rounded-full bg-green-700 px-6 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-400"
        >
          {paying ? "Opening Payment Gateway..." : "Place Order"}
        </button>
      </form>
      <div className="space-y-4">
        <OrderSummary subtotal={subtotal} shippingCharge={shippingCharge} taxAmount={taxAmount} totalAmount={totalAmount} />
        {challanReady && (
          <OrderChallan
            items={items}
            customerName={form.name}
            customerPhone={form.phone}
            subtotal={subtotal}
            shippingCharge={shippingCharge}
            taxAmount={taxAmount}
            totalAmount={totalAmount}
            order={challanOrder}
            onConfirm={confirmCodChallan}
          />
        )}
      </div>
    </section>
  );
}

function EmptyCheckout() {
  return (
    <section className="mx-3 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">Cart is empty</h1>
      <Link to="/products" className="mt-4 inline-flex rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white">Shop Products</Link>
    </section>
  );
}

function OrderSummary({ subtotal, shippingCharge, taxAmount, totalAmount }: { subtotal: number; shippingCharge: number; taxAmount: number; totalAmount: number }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Order Summary</h2>
      <SummaryLine label="Subtotal" value={subtotal} />
      <SummaryLine label="Shipping" value={shippingCharge} />
      <SummaryLine label="GST estimate" value={taxAmount} />
      <div className="mt-4 border-t border-slate-200 pt-4">
        <SummaryLine label="Total" value={totalAmount} strong />
      </div>
    </aside>
  );
}

function OrderChallan({
  items,
  customerName,
  customerPhone,
  subtotal,
  shippingCharge,
  taxAmount,
  totalAmount,
  order,
  onConfirm,
}: {
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  subtotal: number;
  shippingCharge: number;
  taxAmount: number;
  totalAmount: number;
  order: OrderInvoice | null;
  onConfirm: () => void;
}) {
  const challanNumber = order?.invoiceNumber || `OG-CH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  return (
    <aside className="rounded-lg border border-green-200 bg-green-50 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Payment Challan</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">{challanNumber}</h2>
      <div className="mt-4 space-y-1 text-sm text-slate-700">
        <p>Customer: {customerName || "Orchard Growers Customer"}</p>
        <p>Phone: {customerPhone || "Not provided"}</p>
        <p>Items: {items.reduce((sum, item) => sum + item.quantity, 0)}</p>
      </div>
      <div className="mt-4 border-t border-green-200 pt-3">
        <SummaryLine label="Subtotal" value={subtotal} />
        <SummaryLine label="Shipping" value={shippingCharge} />
        <SummaryLine label="GST estimate" value={taxAmount} />
        <SummaryLine label="Amount payable" value={totalAmount} strong />
      </div>
      <p className="mt-4 rounded-md bg-white px-3 py-2 text-sm font-medium text-green-800">
        Thank you for your order. Your cash on delivery challan is generated, and payment will be collected at delivery.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-4 w-full rounded-full bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800"
      >
        View Challan
      </button>
    </aside>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`mt-3 flex justify-between ${strong ? "text-lg font-semibold" : "text-sm"}`}><span>{label}</span><span>Rs. {value}</span></div>;
}

function InvoicePage() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderInvoice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    API.get<OrderInvoice>(`/orders/${id}/invoice`)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(err?.response?.data?.msg || "Invoice not found"));
  }, [id]);

  if (error) return <DesktopEmptyState text={error} />;
  if (!order) return <DesktopEmptyState text="Loading invoice..." />;

  return (
    <section className="mx-3 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoice</h1>
          <p className="text-sm text-slate-600">{order.invoiceNumber}</p>
          <p className="text-sm text-slate-600">{order.invoiceDate ? new Date(order.invoiceDate).toLocaleString() : ""}</p>
        </div>
        <button onClick={() => window.print()} className="rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white">Print Invoice</button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-md bg-green-50 p-4">
          <h2 className="font-semibold">Customer</h2>
          <p>{order.customer?.name}</p>
          <p>{order.customer?.phone}</p>
          <p>{order.customer?.email}</p>
        </div>
        <div className="rounded-md bg-green-50 p-4">
          <h2 className="font-semibold">Courier</h2>
          <p>{order.courierPartner} - {order.courierBookingStatus}</p>
          <p>Tracking: {order.trackingNumber}</p>
          <p>Payment: {order.paymentStatus}</p>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="py-2">Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
          <tbody>
            {(order.items || []).map((item) => (
              <tr key={item.productId || item.title} className="border-b">
                <td className="py-2">{item.title}</td>
                <td>{item.quantity}</td>
                <td>Rs. {item.unitPrice}</td>
                <td>Rs. {item.unitPrice * item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OrderSummary subtotal={order.subtotal || 0} shippingCharge={order.shippingCharge || 0} taxAmount={order.taxAmount || 0} totalAmount={order.totalAmount || 0} />
    </section>
  );
}

function Dashboard() {
  return (
    <section className="mx-4 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-2xl font-semibold">Orchard Growers</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Products and Plants" value="Open" />
        <StatCard label="Our Services" value="Live" />
        <StatCard label="Save Our Earth" value="Active" />
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getStoredUser(): UserProfile {
  if (!hasSignedInUser()) return {};

  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function hasSignedInUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return Boolean(localStorage.getItem("accessToken") && user && (user._id || user.email || user.phone || user.name));
  } catch {
    return Boolean(localStorage.getItem("accessToken"));
  }
}

function clearOrchardSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("user");
  window.dispatchEvent(new Event("orchard-auth-updated"));
}

function getAccountPath() {
  return hasSignedInUser() ? "/profile" : "/login";
}

function fileToProfileImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image."));
      image.onload = () => {
        try {
          const size = 320;
          const side = Math.min(image.width, image.height);
          const sourceX = (image.width - side) / 2;
          const sourceY = (image.height - side) / 2;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Could not process image."));
            return;
          }
          context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        } catch {
          reject(new Error("Could not process image."));
        }
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function emptyAddress(): AddressForm {
  return {
    line1: "",
    line2: "",
    landmark: "",
    city: "",
    district: "",
    state: "",
    pinCode: "",
    country: "India",
  };
}

function getSavedAddresses(user: UserProfile): SavedAddresses {
  const fallbackPermanent = {
    ...emptyAddress(),
    line1: user.businessAddressLine1 || user.addressLine1 || "",
    line2: user.businessAddressLine2 || user.addressLine2 || "",
    landmark: user.businessAddressLine3 || user.addressLine3 || "",
    pinCode: user.businessPinCode || user.pinCode || "",
    city: user.location || "",
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(ADDRESS_KEY) || "null");
    if (parsed?.permanent && parsed?.shipping) {
      return {
        permanent: { ...emptyAddress(), ...parsed.permanent },
        shipping: { ...emptyAddress(), ...parsed.shipping },
      };
    }
  } catch {
    // Ignore malformed saved address data and fall back to profile fields.
  }

  return {
    permanent: fallbackPermanent,
    shipping: { ...fallbackPermanent },
  };
}

function isAddressComplete(address: AddressForm) {
  return Boolean(address.line1 && address.city && address.state && /^\d{6}$/.test(address.pinCode));
}

function addProductToCart(product: Product) {
  const current = getCartItems();
  const stockIssue = getStockIssue(product, current);

  if (stockIssue) {
    return stockIssue;
  }

  const existing = current.find((item) => item.productId === product._id);
  const next = existing
    ? current.map((item) => (item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item))
    : [
        ...current,
        {
          productId: product._id,
          title: product.title || product.fruitName || "Product",
          unitPrice: Number(product.basePrice || 0),
          quantity: 1,
          imageUrl: getProductImage(product),
        },
      ];

  saveCartItems(next);
  return null;
}

function getProductStock(product: Product) {
  return Math.max(0, Number(product.quantity || 0));
}

function isProductInStock(product: Product) {
  const status = product.status?.toUpperCase();
  const statusAvailable = !status || status === "AVAILABLE" || status === "ACTIVE";
  return statusAvailable && getProductStock(product) > 0;
}

function getStockIssue(product: Product, cartItems: CartItem[]) {
  const title = product.title || product.fruitName || "This product";
  const stock = getProductStock(product);

  if (!isProductInStock(product)) {
    return `${title} is out of stock.`;
  }

  const existingQuantity = cartItems.find((item) => item.productId === product._id)?.quantity || 0;
  if (existingQuantity >= stock) {
    return `Only ${stock} unit${stock === 1 ? "" : "s"} available for ${title}.`;
  }

  return "";
}

async function lookupIndianPinCode(pinCode: string) {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pinCode}`);
  if (!res.ok) throw new Error("PIN code lookup failed.");

  const data = await res.json();
  const first = data?.[0];
  const postOffice = first?.PostOffice?.[0];

  if (first?.Status !== "Success" || !postOffice) {
    throw new Error("No address found for this PIN code.");
  }

  return {
    city: postOffice.Name || postOffice.Block || "",
    district: postOffice.District || "",
    state: postOffice.State || "",
  };
}

function getCartItems(): CartItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveCartItems(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("orchard-cart-updated"));
}

function getHighestDealsByCategory(auctions: Auction[]): HighestDeal[] {
  const result: Record<string, HighestDeal> = {};
  auctions.forEach((auction) => {
    const product = auction.product || ({} as Product);
    const title = product.title || product.fruitName || "";
    const category = fruitPlants.find((fruit) => title.toLowerCase().includes(fruit.name.toLowerCase()))?.name || "Popular Fruit Plants";
    const amount = Number(auction.currentBid || auction.startingPrice || 0);
    if (!amount) return;
    if (!result[category] || amount > result[category].amount) {
      result[category] = { category, amount, title: title || "Plant", location: product.location || "Orchard Growers" };
    }
  });
  return Object.values(result).sort((a, b) => b.amount - a.amount);
}

function buildFeed(products: Product[], auctions: Auction[]): FeedItem[] {
  const productPosts = products.map((product) => ({
    id: product._id,
    brand: "Orchard Growers",
    title: product.title || product.fruitName || "Plant",
    text: `${product.title || product.fruitName || "Plant"} is available from Orchard Growers.`,
    timeLabel: "19h",
    imageUrl: getProductImage(product) || fallbackLotImage,
  }));
  const auctionPosts = auctions
    .filter((auction) => auction.product)
    .map((auction) => {
      const product = auction.product as Product;
      return {
        id: `auction-${auction._id}`,
        brand: "Orchard Growers",
        title: product.title || product.fruitName || "Plant",
        text: `${product.title || "Plant"} update. Price: ₹${auction.currentBid || auction.startingPrice || 0}.`,
        timeLabel: auction.status === "ACTIVE" ? "Live" : "19h",
        imageUrl: getProductImage(product) || fallbackLotImage,
      };
    });
  return [...auctionPosts, ...productPosts];
}

function getListingsForDesktopSections(products: Product[], sections: string[]) {
  const listings = [...products].sort((a, b) => getProductTimestamp(b) - getProductTimestamp(a));
  if (!sections.length || sections.includes("products")) return listings;

  const textTerms = sections.flatMap((section) => desktopSectionFilters[section] || []);
  const priceSections = sections.filter((section) => section.startsWith("price:"));

  return listings.filter((product) => {
    const searchable = getProductSearchText(product);
    const matchesText = !textTerms.length || textTerms.some((term) => searchable.includes(term));
    const matchesPrice = !priceSections.length || priceSections.some((section) => isProductInPriceRange(product, section));
    return matchesText && matchesPrice;
  });
}

function getProductTimestamp(product: Product) {
  const date = product.updatedAt || product.createdAt || "";
  const time = Date.parse(date);
  return Number.isFinite(time) ? time : 0;
}

function getProductSearchText(product: Product) {
  return [
    product.title,
    product.productCategory,
    product.seasonalCategory,
    product.fruitName,
    product.variety,
    product.description,
    product.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isProductInPriceRange(product: Product, range: string) {
  const price = Number(product.basePrice || 0);
  if (range === "price:under-500") return price < 500;
  if (range === "price:500-1000") return price >= 500 && price <= 1000;
  if (range === "price:1000-2500") return price >= 1000 && price <= 2500;
  if (range === "price:2500-5000") return price >= 2500 && price <= 5000;
  if (range === "price:above-5000") return price > 5000;
  return true;
}

function getSelectedSortTitle(selections: string[]) {
  if (!selections.length || selections.includes("products")) return "All Products";
  const labels = selections
    .map((selection) => desktopSections.find((section) => section.key === selection)?.label)
    .filter(Boolean) as string[];
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function getProductImage(product: Product) {
  return getProductImages(product)[0] || "";
}

function getProductImages(product: Product) {
  if (!Array.isArray(product.images)) return [];
  return product.images.map(normalizeProductImage).filter(Boolean);
}

function normalizeProductImage(image: string) {
  const normalized = image ? image.replace(/\\/g, "/") : "";
  if (!normalized) return "";
  if (/^https?:\/\//.test(normalized)) return normalized;
  return `${FILE_BASE_URL}/${normalized}`;
}

export default App;
