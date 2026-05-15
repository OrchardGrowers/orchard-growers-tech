import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
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
import API from "./services/api";
import { withDemoProducts } from "./demoProducts";
import type { Product } from "./types";

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
  { key: "season:autumn", label: "Season: Autumn" },
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
  "season:autumn": ["autumn", "fall"],
  "season:winter": ["winter"],
};

const mobileTabs = [
  { key: "products", label: "Products and Plants" },
  { key: "services", label: "Our Services" },
  { key: "tips", label: "Education and Tips" },
  { key: "earth", label: "Save Our Earth" },
];

const productDropdownItems = desktopSections.map((section) => section.label);

const serviceDropdownItems = [
  "FFCCBB (Fruit Farm Cultivation Contract Based Business)",
  "Nursery Plants Prices",
  "Nursery Services",
  "Gardening Services",
  "Services",
  "Landscaping",
  "Orchard Services",
  "Soil Test",
  "Expert Advice (Free) and Plot Visit",
  "Download Orchard Growers App",
  "Download efruitmandi.live App",
];

const educationDropdownItems = ["Learn"];
const earthDropdownItems = ["Blogs", "Donate"];

const bannerImages = Array.from({ length: 8 }, (_, index) => `/ad-banners/banner-${index + 1}.png`);
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
const aboutLinks = ["Blogs", "Our Story", "Our Philosophy", "Career", "Press Release", "Science Behind Us"];
const partnerLinks = ["Invest with Us", "Work with Us", "Bulk Order Enquiry"];
const supportLinks = ["Your Account", "Shipping Policy", "Terms & Conditions", "Privacy Policy", "FAQs", "Return Policy", "Help"];

function App() {
  return (
    <div className="min-h-screen bg-[#eef6f0] text-slate-950">
      <TopNav />
      <main className="mx-auto max-w-[1134px] pb-16 pt-3 md:pt-5">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/invoice/:id" element={<InvoicePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
      <StickyWhatsapp />
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  const [desktopSelections, setDesktopSelections] = useState<string[]>(["products"]);
  const [ratingProduct, setRatingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<ProductImagePreview | null>(null);
  const [stockMessage, setStockMessage] = useState("");
  const leftSidebarRef = useBottomPinnedColumn();
  const rightSidebarRef = useBottomPinnedColumn();
  const user = getStoredUser();

  useEffect(() => {
    const load = async () => {
      try {
        const [productRes, auctionRes] = await Promise.all([
          API.get<Product[]>("/products").catch(() => ({ data: [] as Product[] })),
          API.get<Auction[]>("/auctions").catch(() => ({ data: [] as Auction[] })),
        ]);
        setProducts(withDemoProducts(productRes.data || []));
        setAuctions(auctionRes.data || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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

      <div className="hidden gap-5 md:grid md:grid-cols-[218px_minmax(0,554px)_314px]">
        <aside ref={leftSidebarRef} className="self-start space-y-2.5 will-change-transform">
          <ProfileCard user={user} onOpen={() => navigate("/dashboard")} />
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

        <aside ref={rightSidebarRef} className="hidden self-start space-y-2.5 will-change-transform lg:block">
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
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded px-1.5 py-1">
          <img src="/logo.png" alt="Orchard Growers" className="h-14 w-auto object-contain" />
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
                    key={item}
                    to="/"
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative flex h-full items-center">
              <Link to="/products" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2">
                Our Services
              </Link>
              <div className="invisible absolute left-0 top-full z-50 max-h-[270px] w-48 overflow-y-auto rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {serviceDropdownItems.map((item) => (
                  <Link
                    key={item}
                    to="/products"
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative flex h-full items-center">
              <Link to="/products" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2">
                Education and Tips
              </Link>
              <div className="invisible absolute left-0 top-full z-50 w-48 rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {educationDropdownItems.map((item) => (
                  <Link
                    key={item}
                    to="/products"
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative flex h-full items-center">
              <Link to="/products" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2 group-hover:border-orange-400 group-hover:text-orange-400 group-hover:underline group-hover:decoration-orange-400 group-hover:decoration-2 group-hover:underline-offset-2">
                Save Our Earth
              </Link>
              <div className="invisible absolute left-0 top-full z-50 w-48 rounded-b-md bg-white py-1 text-[16px] font-semibold text-slate-950 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {earthDropdownItems.map((item) => (
                  <Link
                    key={item}
                    to="/products"
                    className="block px-4 py-2 leading-snug hover:bg-green-50 hover:text-green-800 focus:bg-green-50 focus:text-green-800 focus:outline-none"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
            <Link to="/products" className="flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-3 hover:border-orange-400 hover:text-orange-400 hover:underline hover:decoration-orange-400 hover:decoration-2 hover:underline-offset-2">
              Ask Bulk Order Quotation
            </Link>
          </div>
        </nav>
        <div className="ml-auto flex w-full min-w-0 items-center rounded-full border border-green-200 bg-green-50 px-3 md:w-[300px] md:shrink-0">
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
        <div className="hidden shrink-0 items-center gap-5 text-2xl text-green-700 md:flex">
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

function getElementDocumentTop(element: HTMLElement) {
  let top = 0;
  let current: HTMLElement | null = element;

  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return top;
}

function useBottomPinnedColumn() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;

    const updatePosition = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;

      const viewportHeight = window.innerHeight || 0;
      const columnHeight = node.offsetHeight;
      const bottomGap = 16;
      const documentTop = getElementDocumentTop(node);
      const normalTop = documentTop - window.scrollY;
      const bottomPinnedTop = viewportHeight - columnHeight - bottomGap;
      const translateY = Math.max(0, bottomPinnedTop - normalTop);

      node.style.transform = `translate3d(0, ${Math.round(translateY)}px, 0)`;
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const observer = new ResizeObserver(scheduleUpdate);
    if (ref.current) observer.observe(ref.current);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      observer.disconnect();
    };
  }, []);

  return ref;
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
    <section className="overflow-hidden rounded-lg bg-white shadow-sm">
      <img src={bannerImages[active]} alt="Orchard Growers banner" className="h-40 w-full object-cover md:h-36" />
      <div className="flex -translate-y-6 justify-center gap-2">
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
      <div className="h-36 w-44 shrink-0 bg-green-50">
        {imageUrl ? <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-green-700">🌱</div>}
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
            containerClassName="h-36"
            onOpenImage={onOpenImage}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-end">
            <div className="min-w-0 text-sm text-black">
              <h3 className="line-clamp-1 font-semibold">{product.title || "Product Name"}</h3>
              <ProductStockLine product={product} />
              <p className="mt-2 line-clamp-1 font-medium">{product.description || "Product Description"}</p>
              <ProductRatingSummary productId={product._id} />
              <p className="mt-2 max-w-[220px] text-xs font-medium leading-4 text-slate-600">
                "{getDemoReview(product._id)}"
              </p>
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
                onClick={() => {
                  const stockIssue = addProductToCart(product);
                  if (stockIssue) onStockIssue(stockIssue);
                }}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
              >
                Add to Cart
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
      <div className={`${compact ? "mb-2 rounded-md" : ""} flex ${containerClassName} items-center justify-center bg-green-50 text-sm font-semibold text-green-700`}>
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
        className="block h-full w-full"
        aria-label={`Open ${activeAlt} fullscreen`}
      >
        <img src={images[activeImage]} alt={activeAlt} className="h-full w-full object-cover" />
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
      <div className="mb-2 aspect-[4/3] overflow-hidden rounded-md bg-green-100">
        {imageUrl ? <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-green-700">🌱</div>}
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
        containerClassName="h-32"
        compact
        onOpenImage={onOpenImage}
      />
      <div className="text-xs text-black">
        <h3 className="line-clamp-1 font-semibold">{item.title || "Product Name"}</h3>
        <ProductStockLine product={item} compact />
        <p className="mt-1 line-clamp-1 font-medium">{item.description || "Product Description"}</p>
        <ProductRatingSummary productId={item._id} compact />
        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-600">"{getDemoReview(item._id)}"</p>
      </div>
      <div className="mt-2 grid gap-1.5">
        <button onClick={() => onRate(item)} className="rounded-md bg-green-700 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-green-800">
          Rate Product
        </button>
        <button
          onClick={() => {
            const stockIssue = addProductToCart(item);
            if (stockIssue) onStockIssue(stockIssue);
          }}
          className="rounded-md bg-green-700 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-green-800"
        >
          Add to Cart
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

  return (
    <div className={compact ? "mb-2 text-[10px] leading-4 text-slate-700" : "border-b border-slate-100 p-3 text-sm leading-5 text-slate-700"}>
      <p className={expanded ? "" : compact ? "line-clamp-2" : "line-clamp-2"}>{description}</p>
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

function ProductStockLine({ product, compact = false }: { product: Product; compact?: boolean }) {
  const stock = getProductStock(product);
  const inStock = isProductInStock(product);

  return (
    <p className={`${compact ? "mt-1 text-[10px]" : "mt-1 text-xs"} font-semibold ${inStock ? "text-green-700" : "text-rose-600"}`}>
      {inStock ? `Stock: ${stock} unit${stock === 1 ? "" : "s"}` : "Out of stock"}
    </p>
  );
}

function ProductRatingSummary({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const rating = getDemoRating(productId);

  return (
    <div className={`${compact ? "mt-1 text-[10px]" : "mt-2 text-xs"} flex flex-wrap items-center gap-1.5`}>
      <span className="flex items-center gap-0.5 text-amber-400" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <FaStar key={index} className={index < Math.round(rating) ? "text-amber-400" : "text-slate-300"} aria-hidden="true" />
        ))}
      </span>
      <span className="font-semibold text-slate-700">{rating.toFixed(1)} out of 5</span>
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
    setRating(Math.round(getDemoRating(product._id)));
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
            X
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
          X
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

function ProfileCard({ user, onOpen }: { user: UserProfile; onOpen: () => void }) {
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
      <img src="/logo.png" alt="" className="mb-8 h-8 w-20 object-contain" />
      <h2 className="text-base font-semibold text-slate-900">Orchard Growers</h2>
      <p className="mt-2 text-xs text-slate-600">Plants, tools, services, education tips, and Save Our Earth updates.</p>
    </section>
  );
}

function SidebarContactCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 text-green-900">
      <img src="/logo.png" alt="Orchard Growers" className="mb-8 h-9 w-auto object-contain" />
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

function SidebarLinkCard({ title, links }: { title: string; links: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 text-green-900">
      <h2 className="text-lg font-semibold text-green-800">{title}</h2>
      <div className="mt-4 space-y-4 text-sm">
        {links.map((link) => (
          <Link key={link} to="/products" className="block hover:text-green-700">
            {link}
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

          <div className="flex flex-wrap gap-3">
            <Link to="/products" className="rounded-full bg-green-700 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-green-800">
              Browse Products
            </Link>
            <Link to="/cart" className="rounded-full border-2 border-green-700 px-6 py-3 text-sm font-semibold text-green-700 transition-all hover:bg-green-50">
              View Cart
            </Link>
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

  useEffect(() => {
    if (hasSignedInUser()) navigate("/profile", { replace: true });
  }, [navigate]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const sendLoginOtp = async () => {
    setMessage("");
    if (!form.identifier) {
      setMessage("Enter your email address first.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post<{ devOtp?: string; message?: string }>("/auth/send-otp", {
        identifier: form.identifier,
      });
      setOtpSent(true);
      setMessage(res.data.devOtp ? `OTP sent. Test OTP: ${res.data.devOtp}` : res.data.message || "OTP sent.");
    } catch (err: any) {
      setMessage(err?.response?.data?.msg || "Could not send OTP.");
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

    try {
      setLoading(true);
      await API.post("/auth/verify-otp", { identifier: form.identifier, otp: form.otp });
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { identifier: form.identifier, password: form.password }
          : { name: form.name, identifier: form.identifier, password: form.password };
      const res = await API.post(endpoint, payload);

      if (res.data.accessToken) localStorage.setItem("accessToken", res.data.accessToken);
      if (res.data.refreshToken) localStorage.setItem("refreshToken", res.data.refreshToken);
      if (res.data.user) localStorage.setItem("user", JSON.stringify(res.data.user));
      window.dispatchEvent(new Event("orchard-auth-updated"));

      navigate("/profile");
    } catch (err: any) {
      setMessage(err?.response?.data?.msg || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-3 overflow-hidden rounded-lg bg-green-800 shadow-xl md:mx-auto md:max-w-5xl">
      <div className="grid min-h-[620px] md:grid-cols-[1fr_520px]">
        <div className="hidden bg-green-800 p-10 text-white md:flex md:flex-col md:justify-between">
          <Link to="/" className="inline-flex">
            <img src="/logo.png" alt="Orchard Growers" className="h-16 w-auto rounded bg-white/95 px-3 py-2 object-contain" />
          </Link>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-green-100">Orchard Growers</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">Plants, tools, services, and orchard care in one place.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-green-50">
              Sign in to manage your profile, cart, checkout, invoices, and courier order details.
            </p>
          </div>
          <p className="text-sm text-green-100">Secure account access for Orchard Growers customers.</p>
        </div>

        <div className="bg-white px-7 py-10 sm:px-11">
          <h1 className="text-center text-3xl font-semibold text-black">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </h1>

          {message && (
            <p className="mt-6 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{message}</p>
          )}

          <form onSubmit={submitAuth} className="mt-8 space-y-4">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              />
            )}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter Email/Phone No."
                value={form.identifier}
                onChange={(event) => updateForm("identifier", event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              />
              <button
                type="button"
                onClick={sendLoginOtp}
                disabled={loading}
                className="rounded-md border border-green-700 px-4 text-sm font-medium text-green-800 hover:bg-green-50"
              >
                OTP
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
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
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={(event) => updateForm("confirmPassword", event.target.value)}
                  className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
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
              placeholder={otpSent ? "Enter OTP" : "Request OTP first"}
              value={form.otp}
              onChange={(event) => updateForm("otp", event.target.value)}
              className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
            <button
              type="button"
              className="text-sm font-medium text-green-800 hover:text-green-900"
              onClick={() => setMessage("Password reset is not configured yet. Please use OTP login or contact support.")}
            >
              Forgot password?
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-md bg-green-800 px-5 text-sm font-medium text-white transition hover:bg-green-900 disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
            </button>
          </form>

          <div className="my-12 flex items-center gap-4 text-sm text-slate-500">
            <div className="h-px flex-1 bg-slate-300" />
            <span>Or continue with</span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>

          <div className="mx-auto max-w-[246px] space-y-3">
            <button
              type="button"
              onClick={() => setMessage("Google sign-in is ready for connector setup. Use email and OTP for now.")}
              className="flex h-12 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <span className="text-left">
                Sign in with Google
              </span>
              <FaGoogle className="text-lg text-red-500" />
            </button>
            <button
              type="button"
              onClick={() => setMessage("Facebook sign-in is ready for connector setup. Use email and OTP for now.")}
              className="h-12 w-full rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign in with Facebook
            </button>
          </div>

          <p className="mt-9 text-center text-sm text-slate-900">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
              }}
              className="font-medium text-green-800 hover:text-green-900"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </section>
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

function getDemoRating(productId: string) {
  const ratings = [4.8, 4.7, 4.9, 4.6, 4.8];
  return ratings[getStableDemoIndex(productId, ratings.length)];
}

function getDemoReview(productId: string) {
  const reviews = [
    "Healthy plants and neat packaging from Orchard Growers.",
    "Good quality product, delivered fresh and ready to use.",
    "Strong growth after planting. Very happy with the quality.",
    "Clean packing, useful product, and reliable Orchard Growers support.",
    "Looks premium and performed well in our garden setup.",
  ];
  return reviews[getStableDemoIndex(productId, reviews.length)];
}

function getStableDemoIndex(value: string, length: number) {
  return Array.from(value || "orchard").reduce((sum, char) => sum + char.charCodeAt(0), 0) % length;
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
  return `${import.meta.env.VITE_FILE_URL || "http://localhost:5000"}/${normalized}`;
}

export default App;
