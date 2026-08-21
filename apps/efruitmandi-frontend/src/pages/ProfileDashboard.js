import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaBoxes,
  FaCamera,
  FaCertificate,
  FaChartBar,
  FaDownload,
  FaEllipsisH,
  FaHandshake,
  FaLock,
  FaPen,
  FaRupeeSign,
  FaSearch,
  FaSeedling,
  FaShieldAlt,
  FaTrash,
  FaTruck,
  FaYoutube,
} from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import { getQualityLabel } from "../config/appleGrading";
import { getPackingTypeLabel } from "../config/packingSpecifications";
import LimitedPublicProfileCard from "../components/LimitedPublicProfileCard";
import VerificationFeedback from "../components/VerificationFeedback";
import {
  hasBuyerProfile,
  hasDriverProfile,
  hasGrowerProfile,
} from "../utils/auth";
import { getSafePublicProfile } from "../utils/marketplaceVisibility";
import {
  PAYMENT_PARTNER_ENABLED,
  PAYMENT_UNAVAILABLE_MESSAGE,
} from "../config/payment";
import { getEfruitMandiProducts } from "../utils/marketProducts";
import { saveUserToStorage, sanitizeUserForStorage } from "../utils/userStorage";
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  retryMsg91WidgetOtp,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";

const assetUrl = (path) => `${process.env.PUBLIC_URL || ""}${path}`;
const orchardCover = assetUrl("/profile-banners/efruitmandi-profile-cover.png");
const youtubeUrl = "https://www.youtube.com/@eFruitMandi";

const normalizeKycStatus = (status = "") => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "SUBMITTED") return "PENDING";
  return normalized || "NOT_SUBMITTED";
};

const getRoleKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const roleKyc = user.kycByRole?.[role];
  if (roleKyc && Object.keys(roleKyc).length) return roleKyc;

  const legacyKyc = user.kyc || {};
  const legacyRole = String(legacyKyc.roleType || "").trim().toLowerCase();
  if (legacyRole === role || (!legacyRole && role && Object.keys(legacyKyc).some((key) => legacyKyc[key]))) {
    return legacyKyc;
  }

  return {};
};

const getKycDashboardStatusCopy = (status = "") => {
  const normalized = normalizeKycStatus(status);
  const copy = {
    PENDING: {
      title: "KYC submitted and pending review",
      description: "Your documents are waiting for authority verification.",
    },
    UNDER_REVIEW: {
      title: "KYC under review",
      description: "Your documents are being reviewed by the admin team.",
    },
    APPROVED: {
      title: "KYC Verified",
      description: "Your profile is ready for marketplace activity.",
    },
    REJECTED: {
      title: "KYC rejected",
      description: "Please check admin remarks and submit corrected documents.",
    },
    CORRECTION_REQUIRED: {
      title: "Correction required",
      description: "Please update the requested KYC details and resubmit.",
    },
  };

  return copy[normalized] || null;
};

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

const mandiRates = [
  {
    id: "shimla-apple",
    mandi: "Shimla Fruit Mandi",
    state: "Himachal Pradesh",
    fruit: "Apple",
    grade: "A+",
    daily: { min: 1800, max: 2600, avg: 2200 },
    weekly: { min: 1700, max: 2550, avg: 2140 },
    monthly: { min: 1550, max: 2480, avg: 2020 },
    trend: "+6%",
  },
  {
    id: "azadpur-apple",
    mandi: "Azadpur Mandi",
    state: "Delhi",
    fruit: "Apple",
    grade: "A",
    daily: { min: 1500, max: 2300, avg: 1900 },
    weekly: { min: 1450, max: 2200, avg: 1840 },
    monthly: { min: 1350, max: 2100, avg: 1730 },
    trend: "+3%",
  },
  {
    id: "nashik-grapes",
    mandi: "Nashik APMC",
    state: "Maharashtra",
    fruit: "Grapes",
    grade: "Export",
    daily: { min: 900, max: 1450, avg: 1180 },
    weekly: { min: 850, max: 1380, avg: 1110 },
    monthly: { min: 780, max: 1320, avg: 1030 },
    trend: "+4%",
  },
];

const fruitKeywords = [
  "Apple",
  "Pear",
  "Persimmon",
  "Banana",
  "Mango",
  "Orange",
  "Grapes",
  "Kiwi",
  "Pomegranate",
  "Cherry",
  "Peach",
  "Plum",
  "Apricot",
  "Walnut",
];

function buildFruitSalesRecords(items) {
  return items
    .map((item) => {
      const product = item.product || item;
      const title = product.title || "Fruit Lot";
      const boxes = Number(product.quantity || item.quantity || 0);
      const price = Number(item.finalPrice || item.auctionPrice || item.currentBid || 0);
      const amount = price * Math.max(boxes, 1);
      const fruit =
        fruitKeywords.find((keyword) =>
          title.toLowerCase().includes(keyword.toLowerCase())
        ) || title.split(" ")[0] || "Fruit";

      return {
        id: item._id,
        fruit,
        title,
        location: product.location || item.location || "Fruit Mandi",
        boxes,
        amount,
        date: item.updatedAt || item.createdAt || product.updatedAt || product.createdAt,
      };
    })
    .filter((record) => record.amount > 0 || record.boxes > 0);
}

function filterSalesByPeriod(records, period) {
  const days = { daily: 1, weekly: 7, monthly: 30 }[period];
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  return records.filter((record) => {
    if (!record.date) return true;
    return new Date(record.date).getTime() >= since;
  });
}

function summarizeFruitSales(records) {
  const fruitMap = {};

  records.forEach((record) => {
    if (!fruitMap[record.fruit]) {
      fruitMap[record.fruit] = {
        name: record.fruit,
        revenue: 0,
        boxes: 0,
      };
    }

    fruitMap[record.fruit].revenue += record.amount;
    fruitMap[record.fruit].boxes += record.boxes;
  });

  const fruits = Object.values(fruitMap).sort((a, b) => b.revenue - a.revenue);
  const revenue = fruits.reduce((total, fruit) => total + fruit.revenue, 0);
  const boxes = fruits.reduce((total, fruit) => total + fruit.boxes, 0);

  return {
    revenue,
    boxes,
    average: boxes ? Math.round(revenue / boxes) : 0,
    topFruit: fruits[0]?.name || "None",
    fruits,
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ProfileDashboard() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const locationState = routeLocation.state;
  const hasAccessToken = Boolean(localStorage.getItem("accessToken"));
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState("");
  const [adMenuOpen, setAdMenuOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [deleteLotDialog, setDeleteLotDialog] = useState({
    open: false,
    product: null,
    loading: false,
  });
  const [profileDraft, setProfileDraft] = useState(createProfileDraft());
  const [addressDraft, setAddressDraft] = useState(createAddressDraft());
  const [businessAddressDraft, setBusinessAddressDraft] = useState(createEntityAddressDraft());
  const [mediaDraft, setMediaDraft] = useState(createMediaDraft());
  const [contactDraft, setContactDraft] = useState({
    phone: "",
    otp: "",
    otpReqId: "",
    otpSent: false,
    verifiedPhone: "",
    verificationToken: "",
    loading: false,
  });
  const [contactOtpCooldown, setContactOtpCooldown] = useState(0);
  const [showContactVerification, setShowContactVerification] = useState(false);
  const [emailDraft, setEmailDraft] = useState({
    email: "",
    otp: "",
    verifiedEmail: "",
    verificationToken: "",
    loading: false,
  });
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [socialDraft, setSocialDraft] = useState(createSocialDraft());
  const [detectingAddress, setDetectingAddress] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!contactOtpCooldown && !emailOtpCooldown) return undefined;
    const timer = window.setTimeout(() => {
      setContactOtpCooldown((seconds) => Math.max(0, seconds - 1));
      setEmailOtpCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [contactOtpCooldown, emailOtpCooldown]);
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [buyerQuotes, setBuyerQuotes] = useState([]);
  const [growerQuotes, setGrowerQuotes] = useState([]);
  const [quoteActionId, setQuoteActionId] = useState("");
  const [mandiRateData, setMandiRateData] = useState(mandiRates);
  const [mandiRateSource, setMandiRateSource] = useState("fallback");
  const [marketLoading, setMarketLoading] = useState(true);
  const [profileLanguage, setProfileLanguage] = useState(
    () => localStorage.getItem("profileLanguage") || "English"
  );
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);
  const [adClaimed, setAdClaimed] = useState(
    () => localStorage.getItem("profilePromoClaimed") === "true"
  );
  const [activeProfileMode, setActiveProfileMode] = useState(
    () => new URLSearchParams(window.location.search).get("mode") || ""
  );
  const [roleVerificationStatus, setRoleVerificationStatus] = useState(null);
  const [roleOgVerificationStatus, setRoleOgVerificationStatus] = useState(null);

  useEffect(() => {
    const handleProfileModeChange = (event) => {
      const mode = event.detail?.mode || "";
      if (mode) setActiveProfileMode(mode);
    };

    window.addEventListener("efruitmandi-profile-mode-change", handleProfileModeChange);
    return () =>
      window.removeEventListener("efruitmandi-profile-mode-change", handleProfileModeChange);
  }, []);

  useEffect(() => {
    const mode = new URLSearchParams(routeLocation.search).get("mode");
    if (mode) {
      localStorage.setItem("efruitmandiProfileMode", mode);
      setActiveProfileMode(mode);
    }
  }, [routeLocation.search]);

  const storedUser = useMemo(() => {
    try {
      const parsedUser = JSON.parse(localStorage.getItem("user")) || {};
      const safeUser = sanitizeUserForStorage(parsedUser);
      saveUserToStorage(safeUser);
      return safeUser;
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    if (locationState?.notice) {
      setNotice(locationState.notice);
    }
  }, [locationState]);

  useEffect(() => {
    if (!hasAccessToken) {
      navigate("/profile", { replace: true });
    }
  }, [hasAccessToken, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!hasAccessToken) return;

      try {
        const [profileRes, productRes, auctionRes, orderRes, mandiRateRes, buyerQuoteRes, growerQuoteRes] = await Promise.all([
          API.get("/user/profile").catch(() => ({ data: storedUser })),
          API.get("/products?platform=efruitmandi").catch(() => ({ data: [] })),
          API.get("/auctions").catch(() => ({ data: [] })),
          API.get("/orders").catch(() => ({ data: [] })),
          API.get("/mandi-rates").catch(() => ({
            data: { source: "fallback", records: mandiRates },
          })),
          API.get("/quotes/buyer").catch(() => ({ data: { quotes: [] } })),
          API.get("/quotes/grower").catch(() => ({ data: { quotes: [] } })),
        ]);

        setProfile(profileRes.data || storedUser);
        setProducts(getEfruitMandiProducts(productRes.data));
        setAuctions(auctionRes.data || []);
        setOrders(orderRes.data || []);
        setBuyerQuotes(buyerQuoteRes.data?.quotes || []);
        setGrowerQuotes(growerQuoteRes.data?.quotes || []);
        const liveMandiRates = Array.isArray(mandiRateRes.data?.records)
          ? mandiRateRes.data.records
          : [];
        setMandiRateData(liveMandiRates.length ? liveMandiRates : mandiRates);
        setMandiRateSource(mandiRateRes.data?.source || "fallback");
      } catch (err) {
        console.error(err);
        setProfile(storedUser);
      } finally {
        setMarketLoading(false);
      }
    };

    loadProfile();
  }, [hasAccessToken, storedUser]);

  const user = profile || storedUser;
  const currentUserId = (user._id || user.id || "").toString();
  const currentListings = products.filter((product) => {
    const creator = product.createdBy?._id || product.createdBy;
    return Boolean(currentUserId && creator && creator.toString() === currentUserId);
  });
  const activeAuctions = auctions.filter((auction) => auction.status === "ACTIVE");
  const closedAuctions = auctions.filter((auction) => {
    const creator = auction.product?.createdBy?._id || auction.product?.createdBy;
    const belongsToUser = Boolean(currentUserId && creator && creator.toString() === currentUserId);
    return auction.status === "ENDED" && belongsToUser;
  });
  const salesRecords = useMemo(
    () => buildFruitSalesRecords(orders.length ? orders : closedAuctions),
    [orders, closedAuctions]
  );

  const isGrower = hasGrowerProfile(user);
  const isBuyer = hasBuyerProfile(user);
  const isDriver = hasDriverProfile(user);
  const isVisitor = !isGrower && !isBuyer && !isDriver;
  const canCreateBuyerProfile = !isBuyer && !isDriver;
  const canCreateDriverProfile = !isDriver && !isBuyer;
  const availableProfileModes = [
    isBuyer && { key: "buyer", label: "Buyer", icon: <FaHandshake /> },
    isGrower && { key: "grower", label: "Grower", icon: <FaSeedling /> },
    isDriver && { key: "driver", label: "Driver", icon: <FaTruck /> },
  ].filter(Boolean);
  const currentRoleMode = String(user.activeRole || user.selectedRole || user.role || "").toLowerCase();
  const roleProfileMode = availableProfileModes.find((mode) => mode.key === currentRoleMode)?.key;
  const profileMode = availableProfileModes.some((mode) => mode.key === activeProfileMode)
    ? activeProfileMode
    : roleProfileMode || availableProfileModes[0]?.key || "visitor";
  useEffect(() => {
    if (!profileMode || profileMode === "visitor") return;
    localStorage.setItem("efruitmandiProfileMode", profileMode);
    window.dispatchEvent(
      new CustomEvent("efruitmandi-profile-mode-change", {
        detail: { mode: profileMode },
      })
    );
  }, [profileMode]);

  const switchProfileMode = (mode) => {
    setActiveProfileMode(mode);
    localStorage.setItem("efruitmandiProfileMode", mode);
    navigate(`/profile-dashboard?mode=${mode}`, { replace: true });
    setNotice(`Switched to ${mode} mode.`);
  };

  const refreshQuotes = async () => {
    const [buyerQuoteRes, growerQuoteRes] = await Promise.all([
      API.get("/quotes/buyer").catch(() => ({ data: { quotes: [] } })),
      API.get("/quotes/grower").catch(() => ({ data: { quotes: [] } })),
    ]);
    setBuyerQuotes(buyerQuoteRes.data?.quotes || []);
    setGrowerQuotes(growerQuoteRes.data?.quotes || []);
  };

  const refreshOrders = async () => {
    const orderRes = await API.get("/orders").catch(() => ({ data: [] }));
    setOrders(orderRes.data || []);
  };

  const submitLogisticsAssignment = async (orderId, payload) => {
    try {
      await API.post(`/orders/${orderId}/logistics-assignment`, payload);
      setNotice("Logistics assignment details saved.");
      await refreshOrders();
    } catch (err) {
      setNotice(err.response?.data?.msg || "Logistics assignment could not be saved.");
    }
  };

  const respondLogisticsAssignment = async (orderId, action) => {
    try {
      if (action === "accept") {
        await API.post(`/logistics/assignments/${orderId}/accept`);
      } else {
        await API.patch(`/orders/${orderId}/logistics-assignment/${action}`);
      }
      setNotice(action === "accept" ? "Logistics assignment accepted." : "Logistics assignment rejected.");
      await refreshOrders();
    } catch (err) {
      setNotice(err.response?.data?.msg || "Logistics assignment could not be updated.");
    }
  };

  const acceptBuyerQuote = async (quote) => {
    if (!PAYMENT_PARTNER_ENABLED) {
      setNotice(PAYMENT_UNAVAILABLE_MESSAGE);
      return;
    }

    if (!window.confirm("After accepting this offer, other offers for this lot will be closed. Continue?")) {
      return;
    }

    try {
      setQuoteActionId(quote._id);
      await API.patch(`/quotes/${quote._id}/accept`);
      setNotice("Offer accepted. The lot is now marked as deal confirmed.");
      await refreshQuotes();
    } catch (err) {
      setNotice(err.response?.data?.msg || err.response?.data?.message || "Offer could not be accepted.");
    } finally {
      setQuoteActionId("");
    }
  };

  const rejectBuyerQuote = async (quote) => {
    try {
      setQuoteActionId(quote._id);
      await API.patch(`/quotes/${quote._id}/reject`);
      setNotice("Offer rejected.");
      await refreshQuotes();
    } catch (err) {
      setNotice(err.response?.data?.msg || err.response?.data?.message || "Offer could not be rejected.");
    } finally {
      setQuoteActionId("");
    }
  };
  useEffect(() => {
    if (!hasAccessToken || !["buyer", "grower", "driver"].includes(profileMode)) {
      setRoleVerificationStatus(null);
      return undefined;
    }

    let cancelled = false;
    Promise.all([
      API.get("/verification-requests/me", { params: { roleType: profileMode, verificationType: "kyc" } }),
      API.get("/verification-requests/me", { params: { roleType: profileMode, verificationType: "og_verified" } }),
    ])
      .then(([kycRes, ogRes]) => {
        if (!cancelled) {
          setRoleVerificationStatus(kycRes.data || null);
          setRoleOgVerificationStatus(ogRes.data || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoleVerificationStatus(null);
          setRoleOgVerificationStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasAccessToken, profileMode]);

  const profileAddress = formatProfileAddress(user);
  const businessAddress = formatBusinessAddress(user);
  const buyerAddress = [
    user.buyerLocation,
    user.buyerPinCode,
  ].filter(Boolean).join(", ");
  const growerAddress = profileAddress;
  const driverAddress = businessAddress || user.location || profileAddress || "";
  const displayName =
    profileMode === "grower"
      ? user.orchardName || "Grower / Seller"
      : profileMode === "driver"
        ? user.logisticsName || "Logistics Partner"
        : profileMode === "buyer"
          ? user.businessName || "Fruit Buyer"
          : user.name || "Visitor";
  const profileLocation =
    profileMode === "grower"
      ? growerAddress || "Grower orchard location not added"
      : profileMode === "buyer"
        ? buyerAddress || "Buyer business location not added"
        : driverAddress || "Logistics location not added";
  const profileDesignation = String(user.designation || "").trim();
  const headline = profileMode === "grower"
    ? `${profileDesignation || "Fruit grower"} @ ${displayName} | Fruit grower`
    : profileMode === "buyer"
      ? `Buyer @ ${displayName} | Fruit trading partner`
      : profileMode === "driver"
        ? `Logistics partner @ ${displayName}`
        : "Visitor account";
  const dashboardTitle = profileMode === "grower"
    ? "Growers Profile dashboard"
    : profileMode === "buyer"
      ? "Buyer Profile Dashboard"
      : profileMode === "driver"
        ? "Logistic Partner Profile Dashboard"
        : "User Profile Dashboard";
  const registrationActions = [
    ...(canCreateBuyerProfile
      ? [
          {
            title: "Register as Buyer",
            description: "Create a buyer profile and participate in live fruit deals.",
            icon: <FaHandshake />,
            path: "/register-buyer",
          },
        ]
      : []),
    ...(!isGrower
      ? [
          {
            title: "Register as Grower",
            description: "Create a grower profile and list fruit lots for verified buyers.",
            icon: <FaSeedling />,
            path: "/register-grower",
          },
        ]
      : []),
    ...(canCreateDriverProfile
      ? [
          {
            title: "Register as Logistic Partner",
            description: "Create a logistic partner profile and manage fruit lot deliveries.",
            icon: <FaTruck />,
            path: "/register-driver",
          },
        ]
      : []),
  ];
  const joinedLabel = formatJoinDate(user.createdAt);
  const profileContactNo = user.contact || user.phone || "";
  const profileEmail = user.email || "";
  const socialLinks = user.socialLinks || {};
  const needsContactUpdate = !profileContactNo;
  const needsEmailUpdate = !profileEmail;
  const shouldShowContactVerification = needsContactUpdate || showContactVerification;
  const shouldShowEmailVerification = needsEmailUpdate || showEmailVerification;
  const needsSocialUpdate = !socialLinks.google && !socialLinks.facebook;
  const accountCompletionMessages = [
    needsEmailUpdate ? "Add verified email" : "",
    needsContactUpdate ? "Add verified contact number" : "",
    needsSocialUpdate ? "Add social media links" : "",
  ].filter(Boolean);
  const roleKyc = getRoleKyc(user, profileMode);
  const kycStatus = normalizeKycStatus(roleVerificationStatus?.status || roleKyc.status);
  const kycStatusCopy = getKycDashboardStatusCopy(kycStatus);
  const isKycCompleted = ["PENDING", "COMPLETED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUIRED"].includes(kycStatus);
  const panUpdateRequired = Boolean(roleVerificationStatus?.panUpdateRequired);
  const needsKycUpdate = !isKycCompleted || panUpdateRequired;
  const kycDashboardCopy =
    profileMode === "buyer"
      ? {
          title: "KYC Pending for Buyer's Account.",
          description: "Submit Aadhaar, bank/passbook proof, and business details to complete your buyer profile.",
          action: "Complete KYC to become eligible to buy and offer your price.",
        }
      : profileMode === "grower"
        ? {
            title: "KYC Pending for Grower's Account.",
            description: "Submit Udyan card, Aadhaar, bank/passbook proof, and orchard details to complete your grower profile.",
            action: "Complete KYC to become eligible to list fruit consignment lots.",
          }
        : profileMode === "driver"
          ? {
              title: "KYC Pending for Logistics Account.",
              description: "Submit Aadhaar, driving license, vehicle, and bank/passbook proof to complete your logistics profile.",
              action: "Complete KYC to become eligible for fruit delivery work.",
            }
          : {
              title: "KYC Pending.",
              description: "Submit the required documents to complete your profile.",
              action: "Complete KYC to continue.",
            };
  const verifiedContactNo = profileContactNo || "Add contact no.";
  const verifiedEmail = profileEmail || "Add email";
  const visitorAddress = profileAddress || user.location || "not available";
  const roleOg = user.ogVerificationByRole?.[profileMode] || {};
  const roleOgStatus = normalizeKycStatus(roleOgVerificationStatus?.status || roleOg.status);
  const hasApprovedOgRequest = Boolean(
    (roleOgVerificationStatus?.requestId || roleOg.requestId) &&
      roleOgStatus === "APPROVED"
  );
  const isTrustedAccount =
    profileMode === "buyer"
      ? hasApprovedOgRequest
      : profileMode === "grower"
        ? hasApprovedOgRequest
        : profileMode === "driver"
          ? hasApprovedOgRequest
          : false;
  const ogStatusLabel =
    roleOgStatus === "PENDING"
      ? "OG Trusted Badge pending"
      : roleOgStatus === "UNDER_REVIEW"
        ? "OG Trusted Badge under review"
        : roleOgStatus === "REJECTED"
          ? "OG Trusted Badge rejected"
          : roleOgStatus === "CORRECTION_REQUIRED"
            ? "OG Trusted Badge correction required"
            : "";
  const organizationLabel = displayName;
  const trustedLabel = isTrustedAccount
    ? "Orchard Growers Verified"
    : profileMode === "buyer"
      ? ogStatusLabel || "Apply for OG Trusted Badge"
      : ogStatusLabel || "Apply for OG Trusted Badge";
  const trustedActionLabel = profileMode === "buyer" ? "Visit Buyers Space" : "Visit Growers Orchard";
  const editDetailsTitle =
    profileMode === "buyer"
      ? "Edit Buyer's Details"
      : profileMode === "grower"
        ? "Edit Grower's Details"
        : profileMode === "driver"
          ? "Edit Logistics Details"
          : "Edit Profile";
  const companyLogoUrl =
    profileMode === "buyer"
      ? resolveProfileMediaUrl(user.buyerCompanyLogoUrl)
      : resolveProfileMediaUrl(user.companyLogoUrl);
  const bannerUrl =
    profileMode === "buyer"
      ? resolveProfileMediaUrl(user.buyerBannerUrl) || orchardCover
      : resolveProfileMediaUrl(user.bannerUrl) || orchardCover;
  const avatarUrl =
    profileMode === "buyer"
      ? resolveProfileMediaUrl(user.buyerAvatarUrl) || resolveProfileMediaUrl(user.avatarUrl)
      : profileMode === "grower"
        ? resolveProfileMediaUrl(user.avatarUrl)
        : resolveProfileMediaUrl(user.avatarUrl);
  const lockedAmount = Number(user.lockedAmount || 0);
  const lockedAmountLabel = formatCurrency(lockedAmount);

  if (!hasAccessToken) return null;

  const uploadProfileMedia = async (mediaFiles = {}) => {
    const entries = Object.entries(mediaFiles).filter(([, file]) => Boolean(file));
    if (!entries.length) return null;

    const fieldMap = {
      avatarUrl: "avatar",
      bannerUrl: "banner",
      companyLogoUrl: "companyLogo",
    };
    const formData = new FormData();
    formData.append("profileMode", profileMode);
    entries.forEach(([field, file]) => {
      formData.append(fieldMap[field] || field, file);
    });
    const res = await API.patch("/user/profile/media", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  };

  const updateMediaDraft = (field, file) => {
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setMediaDraft((current) => {
      if (current[`${field}Preview`]) URL.revokeObjectURL(current[`${field}Preview`]);
      return {
        ...current,
        [`${field}File`]: file,
        [`${field}Preview`]: previewUrl,
      };
    });
  };

  const closeEditProfile = () => {
    setMediaDraft((current) => {
      Object.keys(current)
        .filter((key) => key.endsWith("Preview") && current[key])
        .forEach((key) => URL.revokeObjectURL(current[key]));
      return createMediaDraft();
    });
    setShowContactVerification(false);
    setShowEmailVerification(false);
    setShowEditProfile(false);
  };

  const openEditProfile = () => {
    setNotice("");
    setProfileDraft(createProfileDraft(user));
    setAddressDraft(createAddressDraft(user));
    setBusinessAddressDraft(createEntityAddressDraft(user, profileMode));
    setContactDraft({
      phone: profileContactNo,
      otp: "",
      otpReqId: "",
      otpSent: false,
      verifiedPhone: "",
      verificationToken: "",
      loading: false,
    });
    setContactOtpCooldown(0);
    setShowContactVerification(needsContactUpdate);
    setEmailDraft({
      email: profileEmail,
      otp: "",
      verifiedEmail: "",
      verificationToken: "",
      loading: false,
    });
    setEmailOtpCooldown(0);
    setShowEmailVerification(needsEmailUpdate);
    setSocialDraft(createSocialDraft(user));
    setMediaDraft(createMediaDraft(user));
    setShowEditProfile(true);
  };

  const openEntityProfileEditor = () => {
    openEditProfile();
  };

  const sendContactOtp = async () => {
    const phone = contactDraft.phone.trim();

    if (contactOtpCooldown > 0) return;

    if (!phone) {
      setNotice("Enter contact number first.");
      return;
    }

    try {
      setContactDraft((current) => ({ ...current, loading: true, verifiedPhone: "", verificationToken: "" }));
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      const normalizedPhone = normalizeIndianMobile(phone);
      if (!normalizedPhone) {
        setNotice("Enter a valid phone number.");
        return;
      }
      if (
        profileContactNo &&
        normalizedPhone === normalizeIndianMobile(profileContactNo)
      ) {
        setNotice("This is already your verified contact number. Enter a new number to change it.");
        return;
      }
      const result = contactDraft.otpSent
        ? await retryMsg91WidgetOtp({ widgetId, tokenAuth, reqId: contactDraft.otpReqId })
        : await sendMsg91WidgetOtp({ widgetId, tokenAuth, phone: normalizedPhone, mode: "signup" });
      setContactDraft((current) => ({ ...current, otpReqId: result.reqId || "", otpSent: true }));
      setContactOtpCooldown(60);
      setNotice(result.reqId ? "OTP sent to phone." : "OTP sent. Enter the OTP received.");
    } catch (err) {
      setNotice(err.response?.data?.msg || err.message || "Unable to send OTP.");
    } finally {
      setContactDraft((current) => ({ ...current, loading: false }));
    }
  };

  const verifyContactOtp = async () => {
    const phone = contactDraft.phone.trim();
    const otp = contactDraft.otp.trim();

    if (!phone || !otp) {
      setNotice("Enter contact number and OTP.");
      return;
    }

    try {
      setContactDraft((current) => ({ ...current, loading: true }));
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      if (!widgetId || !tokenAuth || !contactDraft.otpSent) {
        setNotice("Request phone OTP first.");
        return;
      }
      const result = await verifyMsg91WidgetOtp({ widgetId, tokenAuth, otp, reqId: contactDraft.otpReqId, phone: normalizeIndianMobile(phone) || phone, mode: "signup" });
      const verificationToken = result.data?.otpVerificationToken || "";
      if (!verificationToken) throw new Error("Phone was verified, but the verification token was not returned. Request OTP again.");
      const verifiedPhone = normalizeIndianMobile(phone) || phone;
      setContactDraft((current) => ({
        ...current,
        verifiedPhone,
        verificationToken,
        loading: false,
      }));
      setProfile((current) => current ? { ...current, phone: verifiedPhone, contact: verifiedPhone, phoneVerified: true } : current);
      setNotice("Contact number verified.");
    } catch (err) {
      setContactDraft((current) => ({ ...current, loading: false }));
      setNotice(err.response?.data?.msg || err.message || "OTP verification failed.");
    }
  };

  const sendEmailOtp = async () => {
    const email = emailDraft.email.trim().toLowerCase();

    if (emailOtpCooldown > 0) return;

    if (!email) {
      setNotice("Enter email first.");
      return;
    }
    if (profileEmail && email === profileEmail.trim().toLowerCase()) {
      setNotice("This is already your verified email. Enter a new email to change it.");
      return;
    }

    try {
      setEmailDraft((current) => ({ ...current, loading: true, verifiedEmail: "", verificationToken: "" }));
      const res = await API.post("/auth/send-otp", {
        identifier: email,
        platform: "efruitmandi",
        mode: "profile",
      });
      setEmailOtpCooldown(60);
      setNotice(res.data?.message || "OTP sent.");
    } catch (err) {
      setNotice(err.response?.data?.msg || "Unable to send OTP.");
    } finally {
      setEmailDraft((current) => ({ ...current, loading: false }));
    }
  };

  const verifyEmailOtp = async () => {
    const email = emailDraft.email.trim().toLowerCase();
    const otp = emailDraft.otp.trim();

    if (!email || !otp) {
      setNotice("Enter email and OTP.");
      return;
    }

    try {
      setEmailDraft((current) => ({ ...current, loading: true }));
      const res = await API.post("/auth/verify-otp", { identifier: email, otp, platform: "efruitmandi" });
      const verificationToken = res.data?.otpVerificationToken || "";
      if (!verificationToken) throw new Error("Email was verified, but the verification token was not returned. Request OTP again.");
      setEmailDraft((current) => ({
        ...current,
        verifiedEmail: email,
        verificationToken,
        loading: false,
      }));
      setNotice("Email verified.");
    } catch (err) {
      setEmailDraft((current) => ({ ...current, loading: false }));
      setNotice(err.response?.data?.msg || err.message || "OTP verification failed.");
    }
  };

  const saveProfileDetails = async () => {
    if (profileSaving) return;

    const entityLocation = formatBusinessAddress(businessAddressDraft);
    const personalLocation = formatProfileAddress(addressDraft);
    const nextPhone = contactDraft.phone.trim();
    const nextEmail = emailDraft.email.trim().toLowerCase();
    const contactChanged = Boolean(
      nextPhone && normalizeIndianMobile(nextPhone) !== normalizeIndianMobile(profileContactNo)
    );
    const emailChanged = Boolean(
      nextEmail && nextEmail !== profileEmail.trim().toLowerCase()
    );

    const normalizedNextPhone = normalizeIndianMobile(nextPhone) || nextPhone;
    const normalizedVerifiedPhone = normalizeIndianMobile(contactDraft.verifiedPhone) || contactDraft.verifiedPhone;
    if (contactChanged && normalizedVerifiedPhone !== normalizedNextPhone) {
      setNotice("Verify contact number OTP before saving.");
      return;
    }
    if (emailChanged && emailDraft.verifiedEmail !== nextEmail) {
      setNotice("Verify email OTP before saving.");
      return;
    }

    try {
      setProfileSaving(true);
      setNotice("Saving profile. Please wait...");
      const profilePayload = {
        name: profileDraft.name,
        designation: profileDraft.designation,
        addressLine1: addressDraft.addressLine1,
        addressLine2: addressDraft.addressLine2,
        addressLine3: addressDraft.addressLine3,
        pinCode: addressDraft.pinCode,
        location: personalLocation,
        ...(contactChanged ? { phone: nextPhone } : {}),
        ...(emailChanged ? { email: nextEmail } : {}),
        ...(contactChanged ? { phoneOtpVerificationToken: contactDraft.verificationToken } : {}),
        ...(emailChanged ? { emailOtpVerificationToken: emailDraft.verificationToken } : {}),
        platform: "efruitmandi",
        socialLinks: socialDraft,
      };

      if (profileMode === "buyer") {
        profilePayload.businessName = profileDraft.businessName;
        profilePayload.buyerContactPerson = profileDraft.buyerContactPerson;
        profilePayload.buyerLocation = entityLocation;
        profilePayload.buyerPinCode = businessAddressDraft.businessPinCode;
      }

      if (profileMode === "grower") {
        profilePayload.orchardName = profileDraft.orchardName;
        profilePayload.addressLine1 = businessAddressDraft.businessAddressLine1;
        profilePayload.addressLine2 = businessAddressDraft.businessAddressLine2;
        profilePayload.addressLine3 = businessAddressDraft.businessAddressLine3;
        profilePayload.pinCode = businessAddressDraft.businessPinCode;
        profilePayload.location = entityLocation;
      }

      if (profileMode === "driver") {
        profilePayload.logisticsName = profileDraft.logisticsName;
        profilePayload.businessAddressLine1 = businessAddressDraft.businessAddressLine1;
        profilePayload.businessAddressLine2 = businessAddressDraft.businessAddressLine2;
        profilePayload.businessAddressLine3 = businessAddressDraft.businessAddressLine3;
        profilePayload.businessPinCode = businessAddressDraft.businessPinCode;
        profilePayload.location = entityLocation;
      }

      const res = await API.patch("/user/profile", {
        ...profilePayload,
      });
      const profileUser = {
        ...user,
        ...(res.data || {}),
      };
      let savedUser = profileUser;
      const mediaFiles = {
        avatarUrl: mediaDraft.avatarUrlFile,
        bannerUrl: isVisitor ? null : mediaDraft.bannerUrlFile,
        companyLogoUrl: isVisitor ? null : mediaDraft.companyLogoUrlFile,
      };
      const hasMediaChanges = Object.values(mediaFiles).some(Boolean);

      if (hasMediaChanges) {
        const mediaUser = await uploadProfileMedia(mediaFiles);
        savedUser = {
          ...profileUser,
          ...(mediaUser || {}),
          avatarUrl: mediaUser?.avatarUrl || profileUser.avatarUrl || user.avatarUrl || "",
          bannerUrl: mediaUser?.bannerUrl || profileUser.bannerUrl || user.bannerUrl || "",
          companyLogoUrl:
            mediaUser?.companyLogoUrl || profileUser.companyLogoUrl || user.companyLogoUrl || "",
          buyerAvatarUrl:
            mediaUser?.buyerAvatarUrl ||
            profileUser.buyerAvatarUrl ||
            user.buyerAvatarUrl ||
            "",
          buyerBannerUrl:
            mediaUser?.buyerBannerUrl ||
            profileUser.buyerBannerUrl ||
            user.buyerBannerUrl ||
            "",
          buyerCompanyLogoUrl:
            mediaUser?.buyerCompanyLogoUrl ||
            profileUser.buyerCompanyLogoUrl ||
            user.buyerCompanyLogoUrl ||
            "",
        };
      }

      setProfile(savedUser);
      saveUserToStorage(savedUser);
      setNotice("Profile updated.");
      closeEditProfile();
    } catch (err) {
      setNotice(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Profile could not be saved. Please verify contact and try again."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const autoDetectAddress = () => {
    if (!navigator.geolocation) {
      setNotice("Auto detect is not available on this device.");
      return;
    }

    setDetectingAddress(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const address = data.address || {};
          setAddressDraft((current) => ({
            ...current,
            addressLine1:
              data.name ||
              address.road ||
              address.neighbourhood ||
              current.addressLine1,
            addressLine2:
              address.suburb ||
              address.village ||
              address.town ||
              address.city ||
              current.addressLine2,
            addressLine3:
              [address.state_district, address.state, address.country]
                .filter(Boolean)
                .join(", ") || current.addressLine3,
            pinCode: address.postcode || current.pinCode,
          }));
        } catch {
          setAddressDraft((current) => ({
            ...current,
            addressLine3: `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
          }));
        } finally {
          setDetectingAddress(false);
        }
      },
      () => {
        setDetectingAddress(false);
        setNotice("Location permission was not allowed.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const requestVerification = () => {
    navigate("/get-verified");
  };

  const openListLot = () => {
    if (!isKycCompleted) {
      navigate("/kyc", { state: { from: "/list-new-lot" } });
      return;
    }

    navigate("/list-new-lot");
  };

  const updateLot = (productId) => {
    if (!isKycCompleted) {
      navigate("/kyc", { state: { from: "/profile-dashboard" } });
      return;
    }

    navigate(`/list-new-lot?edit=${productId}`, { state: { productId } });
  };

  const deleteLot = (productId) => {
    const product =
      products.find((item) => item._id === productId) ||
      { _id: productId, title: "Fruit lot" };

    setDeleteLotDialog({
      open: true,
      product,
      loading: false,
    });
  };

  const closeDeleteLotDialog = () => {
    if (deleteLotDialog.loading) return;
    setDeleteLotDialog({ open: false, product: null, loading: false });
  };

  const confirmDeleteLot = async () => {
    const productId = deleteLotDialog.product?._id;
    if (!productId) return;

    setDeleteLotDialog((current) => ({ ...current, loading: true }));

    try {
      await API.delete(`/products/${productId}`);
      setProducts((current) => current.filter((product) => product._id !== productId));
      setAuctions((current) =>
        current.filter((auction) => (auction.product?._id || auction.product)?.toString() !== productId)
      );
      setNotice("Lot deleted.");
      setDeleteLotDialog({ open: false, product: null, loading: false });
    } catch (err) {
      setNotice(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Lot could not be deleted. Please try again."
      );
      setDeleteLotDialog((current) => ({ ...current, loading: false }));
    }
  };

  const claimPromo = () => {
    localStorage.setItem("profilePromoClaimed", "true");
    setAdClaimed(true);
    setAdMenuOpen(false);
    setNotice("Premium company page offer claimed for 1 month.");
  };

  return (
    <div className="mx-auto min-h-[calc(100vh-132px)] max-w-[1134px] pb-20 md:min-h-[calc(100vh-94px)]">
      <div className="md:grid md:grid-cols-[minmax(0,792px)_314px] md:gap-5">
        <div className="min-w-0">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div
            className="relative h-40 cursor-zoom-in bg-cover bg-center md:h-52"
            style={{ backgroundImage: `url(${bannerUrl})` }}
            role="button"
            tabIndex={0}
            aria-label="View full banner"
            onClick={() => setPreviewImage({ src: bannerUrl, alt: "Profile banner" })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setPreviewImage({ src: bannerUrl, alt: "Profile banner" });
              }
            }}
          >
            {!isVisitor && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditProfile();
                }}
                className="absolute right-5 top-5 z-10 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-extrabold text-gray-900 shadow hover:bg-white"
              >
                <FaPen />
                Update Banner
              </button>
            )}
          </div>

          <div className="relative px-6 pb-6 pt-16 md:px-8 md:pt-20">
            <div className="absolute -top-20 left-6 md:-top-24 md:left-8">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (avatarUrl) {
                      setPreviewImage({ src: avatarUrl, alt: `${displayName} profile picture` });
                    }
                  }}
                  className={avatarUrl ? "cursor-zoom-in rounded-full" : "cursor-default rounded-full"}
                  aria-label="View full profile picture"
                >
                  <Avatar
                    name={displayName}
                    imageUrl={avatarUrl}
                    className="h-32 w-32 border-4 border-white text-5xl md:h-40 md:w-40"
                  />
                </button>
                <button
                  type="button"
                  onClick={openEditProfile}
                  className="absolute bottom-2 right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-green-700 text-white shadow"
                  aria-label="Edit profile photo"
                >
                  <FaCamera />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={openEntityProfileEditor}
              className="absolute right-6 top-6 text-2xl text-gray-700 hover:text-green-700"
              aria-label="Edit profile"
            >
              <FaPen />
            </button>

            <div className="md:grid md:grid-cols-[minmax(0,1fr)_230px] md:gap-8">
              <div>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-green-700">
                  {dashboardTitle}
                </p>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-950">
                  {displayName}
                  {isTrustedAccount && <FaShieldAlt className="text-base text-green-700" />}
                </h1>
                {isVisitor ? (
                  <div className="mt-4 grid gap-2 text-sm">
                    {accountCompletionMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={openEditProfile}
                        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-bold text-amber-800 hover:bg-amber-100"
                      >
                        Complete your account: {accountCompletionMessages.join(", ")}.
                      </button>
                    )}
                    <ProfileInfoRow label="Name" value={user.name || displayName} />
                    <ProfileInfoRow
                      label="Verified Email"
                      value={
                        profileEmail ? (
                          verifiedEmail
                        ) : (
                          <button
                            type="button"
                            onClick={openEditProfile}
                            className="font-extrabold text-green-700 underline"
                          >
                            {verifiedEmail}
                          </button>
                        )
                      }
                    />
                    <ProfileInfoRow
                      label="Verified Contact No."
                      value={
                        profileContactNo ? (
                          verifiedContactNo
                        ) : (
                          <button
                            type="button"
                            onClick={openEditProfile}
                            className="font-extrabold text-green-700 underline"
                          >
                            {verifiedContactNo}
                          </button>
                        )
                      }
                    />
                    <ProfileInfoRow label="Address" value={visitorAddress} />
                    <ProfileInfoRow label="Since" value={joinedLabel} />
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-base text-gray-950">{headline}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {profileLocation} <span className="text-gray-400">-</span>{" "}
                      <button className="font-semibold text-blue-700" type="button">
                        Contact info
                      </button>
                    </p>
                    <p className="mt-3 text-sm font-semibold text-blue-700">
                      Since with us: {joinedLabel}
                      {isTrustedAccount && " - OG Verified"}
                    </p>
                    {profileMode === "grower" && (
                      <button
                        type="button"
                        onClick={openListLot}
                        className={`mt-4 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold shadow-sm ${
                          isKycCompleted
                            ? "bg-green-700 text-white hover:bg-green-800"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {isKycCompleted ? <FaSeedling /> : <FaLock />}
                        {isKycCompleted ? "List Fruit Lot" : "KYC required to list"}
                      </button>
                    )}

                  </>
                )}
              </div>

              {!isVisitor && (
              <div className="mt-5 space-y-3 text-sm font-bold md:mt-0">
                {isTrustedAccount ? (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600 ring-1 ring-red-100 hover:bg-red-100"
                    aria-label="Open Orchard Growers on YouTube"
                    title="YouTube"
                  >
                    <FaYoutube className="text-xl" />
                    <span>{trustedActionLabel}</span>
                  </a>
                ) : (
                  <span
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-xs font-extrabold text-gray-300 ring-1 ring-gray-200"
                    aria-label="YouTube is available for trusted badge users"
                    title="Available for trusted badge users"
                  >
                    <FaYoutube className="text-xl" />
                    <span>{trustedActionLabel}</span>
                  </span>
                )}
                <div className="flex items-center gap-2 text-gray-900">
                  {companyLogoUrl ? (
                    <img
  src={companyLogoUrl}
  alt="Company logo"
  className="h-7 w-7 rounded-sm bg-gray-50 object-contain"
  onError={(event) => {
    event.currentTarget.style.display = "none";
    event.currentTarget.nextElementSibling?.classList.remove("hidden");
  }}
/>
                  ) : null}
                  <span className={`flex h-7 w-7 items-center justify-center rounded-sm bg-gray-100 text-xs text-gray-500 ${companyLogoUrl ? "hidden" : ""}`}>
                    OG
                  </span>
                  <span>{organizationLabel}</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    isTrustedAccount ? "text-gray-900" : "text-gray-500"
                  }`}
                >
                  <FaCertificate
                    className={isTrustedAccount ? "text-green-700" : "text-gray-300"}
                  />
                  <span>{trustedLabel}</span>
                </div>
                {!isTrustedAccount && (
                  <button
                    type="button"
                    onClick={requestVerification}
                    className="rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
                  >
                    Apply for OG Trusted Badge
                  </button>
                )}
              </div>
              )}
            </div>
          </div>
        </section>

        {!isVisitor && (
          <VerificationFeedback
            feedback={roleOgVerificationStatus?.verificationFeedback}
            showAction
          />
        )}

        {availableProfileModes.length > 1 && (
          <ProfileModeSwitcher
            modes={availableProfileModes}
            activeMode={profileMode}
            onSwitch={switchProfileMode}
          />
        )}

        {registrationActions.length > 0 && (
          <RoleRegistrationCards
            options={registrationActions}
            onSelect={(option) => {
              if (option.mode) {
                switchProfileMode(option.mode);
                return;
              }

              navigate(option.path);
            }}
          />
        )}

        {!isVisitor && (needsKycUpdate ? (
          <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-900">
              {panUpdateRequired ? "KYC update required – Please add your PAN Number and PAN Card." : kycDashboardCopy.title}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
              {kycDashboardCopy.description}
            </p>
            <p className="mt-1 text-xs font-extrabold leading-5 text-amber-900">
              {kycDashboardCopy.action}
            </p>
            <button
              type="button"
              onClick={() => navigate("/kyc", { state: { roleType: profileMode } })}
              className="mt-3 rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
            >
              Complete KYC
            </button>
          </section>
        ) : (
          <section className={`mt-4 rounded-lg border p-4 ${
            kycStatus === "APPROVED"
              ? "border-green-200 bg-green-50"
              : kycStatus === "REJECTED" || kycStatus === "CORRECTION_REQUIRED"
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
          }`}>
            <p className={`text-sm font-extrabold ${
              kycStatus === "APPROVED"
                ? "text-green-900"
                : kycStatus === "REJECTED" || kycStatus === "CORRECTION_REQUIRED"
                  ? "text-red-900"
                  : "text-amber-900"
            }`}>
              {kycStatusCopy?.title || "KYC submitted and pending review"}
            </p>
            <p className={`mt-1 text-xs font-semibold leading-5 ${
              kycStatus === "APPROVED"
                ? "text-green-800"
                : kycStatus === "REJECTED" || kycStatus === "CORRECTION_REQUIRED"
                  ? "text-red-800"
                  : "text-amber-800"
            }`}>
              {kycStatusCopy?.description || "Your documents are waiting for authority verification."}
            </p>
            {(kycStatus === "REJECTED" || kycStatus === "CORRECTION_REQUIRED") && (
              <button
                type="button"
                onClick={() => navigate("/kyc", { state: { roleType: profileMode } })}
                className="mt-3 rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
              >
                Update KYC
              </button>
            )}
          </section>
        ))}

        {!isVisitor && (
          <VerificationFeedback
            feedback={roleVerificationStatus?.verificationFeedback}
            showAction
          />
        )}

        {profileMode === "buyer" && (
          <>
            <BuyerLockedAmountCard amountLabel={lockedAmountLabel} />
            <BuyerSubmittedQuotes
              quotes={buyerQuotes}
              orders={orders}
              onViewLot={(quote) => {
                if (normalizeQuoteStatusLabel(quote.status) === "Accepted") {
                  navigate(`/quotes/${quote._id}?view=buyer&report=consignment`);
                  return;
                }
                if (quote.lotId) {
                  navigate(`/lots/${quote.lotId}`);
                  return;
                }
                navigate(`/quotes/${quote._id}?view=buyer`);
              }}
              onViewQuote={(quoteId) => navigate(`/quotes/${quoteId}?view=buyer`)}
              onPay={(orderId) => {
                if (!PAYMENT_PARTNER_ENABLED) {
                  setNotice(PAYMENT_UNAVAILABLE_MESSAGE);
                  return;
                }
                navigate(`/payment/${orderId}`);
              }}
            />
          </>
        )}

      {notice && (
        <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            Close
          </button>
        </div>
      )}

        {profileMode === "grower" && (
          <>
            <ProfileMarketPanel
              loading={marketLoading}
              products={currentListings}
              closedAuctions={closedAuctions}
              salesRecords={salesRecords}
              rates={mandiRateData}
              rateSource={mandiRateSource}
              activeAuctions={activeAuctions}
              quotes={growerQuotes}
              quoteActionId={quoteActionId}
              onSeeListings={() => navigate("/profile-dashboard?mode=grower")}
              onSeeClosed={() => navigate("/orders")}
              onSeeRates={() => navigate("/mandi-rates")}
              onUpdateLot={updateLot}
              onDeleteLot={deleteLot}
              onViewQuoteDetails={(quoteId) => navigate(`/quotes/${quoteId}?view=grower`)}
              onAcceptQuote={acceptBuyerQuote}
            />
          </>
        )}

        {profileMode === "driver" && (
          <DriverDashboardGate onRegisterGrower={() => navigate("/register-grower")} />
        )}

        <div className="mt-4 space-y-3 md:hidden">
          <ProfileLanguageCard
            value={profileLanguage}
            isEditing={showLanguageOptions}
            onEdit={() => setShowLanguageOptions((value) => !value)}
            onChange={(language) => {
              setProfileLanguage(language);
              localStorage.setItem("profileLanguage", language);
              setShowLanguageOptions(false);
            }}
          />
          <ProfileSideCard
            title="Public profile & URL"
            value={`efruitmandi.in/${slugify(displayName) || "profile"}`}
          />
        </div>

        </div>

        <aside className="mt-4 hidden space-y-3 md:mt-0 md:block">
        <ProfileLanguageCard
          value={profileLanguage}
          isEditing={showLanguageOptions}
          onEdit={() => setShowLanguageOptions((value) => !value)}
          onChange={(language) => {
            setProfileLanguage(language);
            localStorage.setItem("profileLanguage", language);
            setShowLanguageOptions(false);
          }}
        />
        <ProfileSideCard
          title="Public profile & URL"
          value={`efruitmandi.in/${slugify(displayName) || "profile"}`}
        />
        {profileMode === "buyer" && (
          <BuyerLockedAmountCard amountLabel={lockedAmountLabel} compact />
        )}
        <section className="relative rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span>Ad</span>
            <button
              type="button"
              onClick={() => setAdMenuOpen((value) => !value)}
              className="rounded-full p-1 text-gray-700 hover:bg-gray-100"
              aria-label="Ad options"
            >
              <FaEllipsisH />
            </button>
          </div>
          <p className="text-sm text-gray-700">
            {adClaimed
              ? "Your 1-month premium company page offer is active."
              : "Grow your verified buyer and grower network faster."}
          </p>
          <button
            type="button"
            onClick={claimPromo}
            disabled={adClaimed}
            className="mt-4 rounded-full border border-blue-700 px-4 py-2 text-sm font-bold text-blue-700 disabled:border-green-600 disabled:bg-green-50 disabled:text-green-700"
          >
            {adClaimed ? "Offer claimed" : "Claim 1-month free"}
          </button>
          {adMenuOpen && (
            <div className="absolute right-3 top-10 z-10 w-40 overflow-hidden rounded-md border border-gray-200 bg-white text-sm shadow-lg">
              <button
                type="button"
                onClick={claimPromo}
                className="block w-full px-3 py-2 text-left font-semibold text-green-800 hover:bg-green-50"
              >
                Claim offer
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdMenuOpen(false);
                  setNotice("Ad hidden for this session.");
                }}
                className="block w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
              >
                Hide ad
              </button>
            </div>
          )}
        </section>
        </aside>
      </div>
      {showEditProfile && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-4">
          <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-gray-950">{editDetailsTitle}</h2>
            {notice && (
              <div
                className={`mt-3 rounded-md px-3 py-2 text-xs font-bold ${
                  notice.startsWith("Saving")
                    ? "bg-blue-50 text-blue-800"
                    : "bg-amber-50 text-amber-900"
                }`}
                role="status"
                aria-live="polite"
              >
                {notice}
              </div>
            )}
            {!isVisitor && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-extrabold text-gray-800">
                {profileMode === "buyer"
                  ? "Buyer banner"
                  : profileMode === "grower"
                    ? "Grower banner"
                    : "Logistics banner"}
              </p>
              <div
                className="mt-3 h-28 rounded-md bg-gray-100 bg-cover bg-center"
                style={{ backgroundImage: `url(${mediaDraft.bannerUrlPreview || bannerUrl})` }}
              />
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-md bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800">
                Upload banner
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      updateMediaDraft("bannerUrl", event.target.files?.[0])
                    }
                />
              </label>
            </div>
            )}
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-extrabold text-gray-800">
                {profileMode === "buyer"
                  ? "Buyer profile photo"
                  : profileMode === "grower"
                    ? "Grower profile photo"
                    : profileMode === "driver"
                      ? "Logistics profile photo"
                      : "User profile photo"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  name={displayName}
                  imageUrl={mediaDraft.avatarUrlPreview || avatarUrl}
                  className="h-14 w-14 border border-gray-200 text-xl"
                />
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800">
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      updateMediaDraft("avatarUrl", event.target.files?.[0])
                    }
                  />
                </label>
              </div>
            </div>
            {!isVisitor && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-extrabold text-gray-800">
                  {profileMode === "buyer"
                    ? "Buyer company logo"
                    : profileMode === "grower"
                      ? "Grower orchard logo"
                      : "Logistics logo"}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2">
                    {(mediaDraft.companyLogoUrlPreview || companyLogoUrl) && (
                      <img
                        src={mediaDraft.companyLogoUrlPreview || companyLogoUrl}
                        alt="Uploaded organization logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800">
                    Upload logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        updateMediaDraft("companyLogoUrl", event.target.files?.[0])
                      }
                    />
                  </label>
                </div>
              </div>
            )}
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-extrabold text-gray-800">Account owner details</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">
                Edit the user name and position separately from the company or orchard premises.
              </p>
              <div className="mt-3 grid gap-3">
                <AddressInput
                  label="User name"
                  value={profileDraft.name}
                  placeholder="Owner / proprietor / manager name"
                  onChange={(value) =>
                    setProfileDraft((current) => ({ ...current, name: value }))
                  }
                />
                <AddressInput
                  label="Designation / Position"
                  value={profileDraft.designation}
                  placeholder="Owner, proprietor, manager, purchase head, etc."
                  onChange={(value) =>
                    setProfileDraft((current) => ({ ...current, designation: value }))
                  }
                />
              </div>
            </div>
            {!isVisitor && (
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-extrabold text-emerald-800">
                  {profileMode === "buyer"
                    ? "Buyer company details"
                    : profileMode === "grower"
                      ? "Grower orchard details"
                      : "Logistics business details"}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-emerald-900">
                  Keep entity name and premises separate from the personal user address.
                </p>
                <div className="mt-3 grid gap-3">
                  {profileMode === "buyer" && (
                    <>
                      <AddressInput
                        label="Company name"
                        value={profileDraft.businessName}
                        placeholder="Company / firm name"
                        onChange={(value) =>
                          setProfileDraft((current) => ({ ...current, businessName: value }))
                        }
                      />
                      <AddressInput
                        label="Contact person"
                        value={profileDraft.buyerContactPerson}
                        placeholder="Owner / proprietor / manager"
                        onChange={(value) =>
                          setProfileDraft((current) => ({ ...current, buyerContactPerson: value }))
                        }
                      />
                    </>
                  )}
                  {profileMode === "grower" && (
                    <AddressInput
                      label="Orchard name"
                      value={profileDraft.orchardName}
                      placeholder="Orchard name"
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, orchardName: value }))
                      }
                    />
                  )}
                  {profileMode === "driver" && (
                    <AddressInput
                      label="Logistics name"
                      value={profileDraft.logisticsName}
                      placeholder="Logistics / transport name"
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, logisticsName: value }))
                      }
                    />
                  )}
                  <AddressInput
                    label={
                      profileMode === "buyer"
                        ? "Buyer business address"
                        : profileMode === "grower"
                          ? "Orchard address"
                          : "Logistics premises address"
                    }
                    value={businessAddressDraft.businessAddressLine1}
                    placeholder="Shop, office, company, orchard, building"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessAddressLine1: value }))
                    }
                  />
                  <AddressInput
                    label="Address line 2"
                    value={businessAddressDraft.businessAddressLine2}
                    placeholder="Market, road, village, tehsil"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessAddressLine2: value }))
                    }
                  />
                  <AddressInput
                    label="Address line 3"
                    value={businessAddressDraft.businessAddressLine3}
                    placeholder="District, state, country"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessAddressLine3: value }))
                    }
                  />
                  <AddressInput
                    label="Postal code"
                    value={businessAddressDraft.businessPinCode}
                    placeholder="Postal / PIN code"
                    inputMode="numeric"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessPinCode: value }))
                    }
                  />
                </div>
              </div>
            )}
            <div className="mt-4 rounded-lg border border-green-100 bg-green-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-extrabold text-green-800">
                  {needsContactUpdate ? "Add and verify contact number" : "Verified contact number"}
                </p>
                {(profileContactNo || contactDraft.verifiedPhone) && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-green-700">
                    {contactDraft.verifiedPhone ? "New number verified" : "Verified"}
                  </span>
                )}
              </div>
              {!shouldShowContactVerification && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                  <span className="text-sm font-bold text-gray-900">{profileContactNo}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setContactDraft({
                        phone: "",
                        otp: "",
                        otpReqId: "",
                        otpSent: false,
                        verifiedPhone: "",
                        verificationToken: "",
                        loading: false,
                      });
                      setContactOtpCooldown(0);
                      setShowContactVerification(true);
                    }}
                    className="rounded-md border border-green-200 px-3 py-2 text-xs font-extrabold text-green-800 hover:bg-green-100"
                  >
                    Verify new number
                  </button>
                </div>
              )}
              {shouldShowContactVerification && (
                <>
              {needsContactUpdate ? (
                <p className="mb-3 text-xs font-semibold leading-5 text-gray-700">
                  You logged in with email. Please add and verify your contact number before registering as Grower, Buyer, or Driver.
                </p>
              ) : (
                <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-gray-700">
                  <span>Current verified number: {profileContactNo}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setContactDraft((current) => ({
                        ...current,
                        phone: profileContactNo,
                        otp: "",
                        otpReqId: "",
                        otpSent: false,
                        verifiedPhone: "",
                        verificationToken: "",
                      }));
                      setContactOtpCooldown(0);
                      setShowContactVerification(false);
                    }}
                    className="shrink-0 font-extrabold text-green-800 underline"
                  >
                    Keep current
                  </button>
                </div>
              )}
              <div className="grid gap-2">
                <input
                  value={contactDraft.phone}
                  inputMode="tel"
                  onChange={(event) => {
                    setContactDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                      otp: "",
                      otpReqId: "",
                      otpSent: false,
                      verifiedPhone: "",
                      verificationToken: "",
                    }));
                    setContactOtpCooldown(0);
                  }}
                  placeholder={needsContactUpdate ? "Enter contact number" : "Enter new contact number"}
                  className="min-h-11 w-full rounded-md border border-green-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-green-700"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    value={contactDraft.otp}
                    inputMode="numeric"
                    onChange={(event) =>
                      setContactDraft((current) => ({ ...current, otp: event.target.value }))
                    }
                    placeholder="OTP"
                    className="min-h-11 min-w-0 rounded-md border border-green-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-700"
                  />
                  <button
                    type="button"
                    onClick={sendContactOtp}
                    disabled={contactDraft.loading || contactOtpCooldown > 0}
                    className="min-h-11 rounded-md bg-white px-3 py-2 text-xs font-extrabold text-green-800 disabled:opacity-60"
                  >
                    {contactOtpCooldown > 0 ? `${contactOtpCooldown}s` : "Request OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={verifyContactOtp}
                    disabled={contactDraft.loading}
                    className="min-h-11 rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                  >
                    Verify
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-extrabold text-blue-800">
                  {needsEmailUpdate ? "Add and verify email" : "Verified email"}
                </p>
                {(profileEmail || emailDraft.verifiedEmail) && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-blue-700">
                    {emailDraft.verifiedEmail ? "New email verified" : "Verified"}
                  </span>
                )}
              </div>
              {!shouldShowEmailVerification && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                  <span className="break-all text-sm font-bold text-gray-900">{profileEmail}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailDraft({ email: "", otp: "", verifiedEmail: "", verificationToken: "", loading: false });
                      setEmailOtpCooldown(0);
                      setShowEmailVerification(true);
                    }}
                    className="rounded-md border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-800 hover:bg-blue-100"
                  >
                    Verify new email
                  </button>
                </div>
              )}
              {shouldShowEmailVerification && (
                <>
              {needsEmailUpdate ? (
                <p className="mb-3 text-xs font-semibold leading-5 text-gray-700">
                  You logged in with phone number. Please add and verify your email for account recovery and communication.
                </p>
              ) : (
                <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-gray-700">
                  <span className="break-all">Current verified email: {profileEmail}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailDraft((current) => ({
                        ...current,
                        email: profileEmail,
                        otp: "",
                        verifiedEmail: "",
                        verificationToken: "",
                      }));
                      setEmailOtpCooldown(0);
                      setShowEmailVerification(false);
                    }}
                    className="shrink-0 font-extrabold text-blue-800 underline"
                  >
                    Keep current
                  </button>
                </div>
              )}
              <div className="grid gap-2">
                <input
                  value={emailDraft.email}
                  inputMode="email"
                  onChange={(event) => {
                    setEmailDraft((current) => ({
                      ...current,
                      email: event.target.value,
                      otp: "",
                      verifiedEmail: "",
                      verificationToken: "",
                    }));
                    setEmailOtpCooldown(0);
                  }}
                  placeholder={needsEmailUpdate ? "Enter email address" : "Enter new email address"}
                  className="min-h-11 w-full rounded-md border border-blue-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-700"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    value={emailDraft.otp}
                    inputMode="numeric"
                    onChange={(event) =>
                      setEmailDraft((current) => ({ ...current, otp: event.target.value }))
                    }
                    placeholder="OTP"
                    className="min-h-11 min-w-0 rounded-md border border-blue-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-700"
                  />
                  <button
                    type="button"
                    onClick={sendEmailOtp}
                    disabled={emailDraft.loading || emailOtpCooldown > 0}
                    className="min-h-11 rounded-md bg-white px-3 py-2 text-xs font-extrabold text-blue-800 disabled:opacity-60"
                  >
                    {emailOtpCooldown > 0 ? `${emailOtpCooldown}s` : "Request OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={verifyEmailOtp}
                    disabled={emailDraft.loading}
                    className="min-h-11 rounded-md bg-blue-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                  >
                    Verify
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-extrabold text-gray-800">Social media accounts</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">
                Add Google and Facebook profile links so your account is easier to verify and recover.
              </p>
              <div className="mt-3 grid gap-3">
                <AddressInput
                  label="Google profile"
                  value={socialDraft.google}
                  placeholder="https://..."
                  onChange={(value) =>
                    setSocialDraft((current) => ({ ...current, google: value }))
                  }
                />
                <AddressInput
                  label="Facebook profile"
                  value={socialDraft.facebook}
                  placeholder="https://facebook.com/..."
                  onChange={(value) =>
                    setSocialDraft((current) => ({ ...current, facebook: value }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-gray-700">Personal user address</p>
              <button
                type="button"
                onClick={autoDetectAddress}
                disabled={detectingAddress}
                className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-extrabold text-green-800 hover:bg-green-100 disabled:opacity-60"
              >
                {detectingAddress ? "Detecting..." : "Auto detect address"}
              </button>
            </div>
            <div className="mt-3 grid gap-3">
              <AddressInput
                label="Address line 1"
                value={addressDraft.addressLine1}
                placeholder="House, orchard, building, village"
                onChange={(value) =>
                  setAddressDraft((current) => ({ ...current, addressLine1: value }))
                }
              />
              <AddressInput
                label="Address line 2"
                value={addressDraft.addressLine2}
                placeholder="Area, road, mandi, tehsil"
                onChange={(value) =>
                  setAddressDraft((current) => ({ ...current, addressLine2: value }))
                }
              />
              <AddressInput
                label="Address line 3"
                value={addressDraft.addressLine3}
                placeholder="District, state, country"
                onChange={(value) =>
                  setAddressDraft((current) => ({ ...current, addressLine3: value }))
                }
              />
              <AddressInput
                label="Pin code"
                value={addressDraft.pinCode}
                placeholder="175001"
                inputMode="numeric"
                onChange={(value) =>
                  setAddressDraft((current) => ({ ...current, pinCode: value }))
                }
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeEditProfile}
                disabled={profileSaving}
                className="flex-1 rounded-md bg-gray-100 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfileDetails}
                disabled={profileSaving}
                className="flex-1 rounded-md bg-green-700 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {profileSaving ? "Saving... Please wait" : "Save"}
              </button>
            </div>
          </section>
        </div>
      )}

      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {deleteLotDialog.open && (
        <DeleteLotConfirmDialog
          product={deleteLotDialog.product}
          loading={deleteLotDialog.loading}
          onCancel={closeDeleteLotDialog}
          onConfirm={confirmDeleteLot}
        />
      )}
    </div>
  );
}

function ProfileInfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[145px_minmax(0,1fr)] gap-3 rounded-md bg-gray-50 px-3 py-2">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className="font-bold text-gray-950">{value}</span>
    </div>
  );
}

function AddressInput({ label, value, placeholder, inputMode, onChange }) {
  return (
    <label className="block text-xs font-semibold text-gray-700">
      {label}
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600"
      />
    </label>
  );
}

function RoleRegistrationCards({ options, onSelect }) {
  return (
    <section className="mt-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-3 md:p-5">
      {options.map((option) => (
        <button
          key={option.title}
          type="button"
          onClick={() => onSelect(option)}
          className="rounded-lg border border-green-100 bg-green-50 p-4 text-left transition hover:border-green-500 hover:bg-green-100 focus-visible:border-green-500 focus-visible:bg-green-100 focus-visible:outline-none"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-700 text-lg text-white">
            {option.icon}
          </span>
          <h2 className="mt-4 text-sm font-extrabold text-gray-950">
            {option.title}
          </h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-gray-600">
            {option.description}
          </p>
        </button>
      ))}
    </section>
  );
}

function ProfileModeSwitcher({ modes, activeMode, onSwitch }) {
  return (
    <section className="mt-4 rounded-lg border border-green-100 bg-white p-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">
        Switch Mode
      </p>
      <p className="mt-1 text-[11px] font-bold text-gray-500">
        Change dashboard view for this account.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => onSwitch(mode.key)}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-extrabold ${
              activeMode === mode.key
                ? "bg-green-700 text-white"
                : "bg-green-50 text-green-800 hover:bg-green-100"
            }`}
          >
            {mode.icon}
            {mode.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfileMarketPanel({
  loading,
  products,
  closedAuctions,
  salesRecords,
  rates,
  rateSource,
  activeAuctions,
  quotes,
  quoteActionId,
  onSeeListings,
  onSeeClosed,
  onSeeRates,
  onUpdateLot,
  onDeleteLot,
  onViewQuoteDetails,
  onAcceptQuote,
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      {loading && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
          Loading market activity...
        </p>
      )}

      <GrowerBuyerQuotesSection
        quotes={quotes}
        actionId={quoteActionId}
        onViewDetails={onViewQuoteDetails}
        onAccept={onAcceptQuote}
      />

      <MarketLotSection
        title="Current Listings"
        items={products}
        emptyText="No current listing yet. Add a fruit lot to manage it here."
        onSeeAll={onSeeListings}
        onUpdateLot={onUpdateLot}
        onDeleteLot={onDeleteLot}
      />

      <ProfileFruitSalesSection records={salesRecords} />

      <MarketLotSection
        title="Closed Deals"
        items={closedAuctions}
        emptyText="No Closed Deals to Show Yet"
        onSeeAll={onSeeClosed}
      />

      <ProfileMandiRatesSection
        rates={rates}
        source={rateSource}
        activeCount={activeAuctions.length}
        onSeeAll={onSeeRates}
      />
    </div>
  );
}

function MarketLotSection({ title, items, emptyText, onSeeAll, onUpdateLot, onDeleteLot }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-extrabold text-black">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="rounded-full bg-gray-200 px-4 py-1 text-[9px] font-bold text-gray-700"
        >
          See All
        </button>
      </div>

      {items.length ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.slice(0, 6).map((item, index) => (
            <MarketLotCard
              key={item._id || index}
              item={item}
              onUpdateLot={onUpdateLot}
              onDeleteLot={onDeleteLot}
            />
          ))}
        </div>
      ) : (
        <MarketEmptyState text={emptyText} />
      )}
    </section>
  );
}

function ProfileFruitSalesSection({ records }) {
  const [period, setPeriod] = useState("monthly");
  const filteredRecords = filterSalesByPeriod(records, period);
  const summary = summarizeFruitSales(filteredRecords);
  const maxRevenue = Math.max(...summary.fruits.map((fruit) => fruit.revenue), 1);

  const exportSales = () => {
    if (!filteredRecords.length) return;

    const rows = [
      "Fruit,Location,Boxes,Sale Amount,Date",
      ...filteredRecords.map((record) =>
        [
          record.fruit,
          record.location,
          record.boxes,
          record.amount,
          record.date ? new Date(record.date).toLocaleDateString("en-IN") : "",
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `efruit-sales-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-extrabold text-black">
            Fruit Sale Report
          </h2>
          <p className="text-[10px] font-bold text-gray-500">
            Revenue, sold boxes, and fruit-wise performance
          </p>
        </div>
        <button
          type="button"
          onClick={exportSales}
          disabled={!filteredRecords.length}
          className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1 text-[9px] font-bold text-gray-700 disabled:opacity-50"
        >
          <FaDownload />
          CSV
        </button>
      </div>

      <div className="rounded-md border border-green-100 bg-green-50 p-2">
        <PeriodTabs period={period} onChange={setPeriod} />

        <div className="mt-2 grid grid-cols-3 gap-2">
          <SalesMetric icon={<FaRupeeSign />} label="Revenue" value={`Rs. ${summary.revenue}`} />
          <SalesMetric icon={<FaBoxes />} label="Boxes" value={summary.boxes} />
          <SalesMetric icon={<FaChartBar />} label="Avg" value={`Rs. ${summary.average}`} />
        </div>

        {!summary.fruits.length ? (
          <div className="mt-2 rounded-md bg-white px-3 py-3">
            <MarketEmptyState text="No fruit sales recorded for this period yet." />
          </div>
        ) : (
          <div className="mt-2 rounded-md bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-black">
                Fruit-wise sales graph
              </span>
              <span className="rounded bg-green-100 px-2 py-1 text-[9px] font-extrabold text-green-800">
                Top: {summary.topFruit}
              </span>
            </div>
            <div className="space-y-2">
              {summary.fruits.map((fruit) => (
                <div key={fruit.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold">
                    <span className="truncate text-black">{fruit.name}</span>
                    <span className="shrink-0 text-gray-600">
                      Rs. {fruit.revenue} | {fruit.boxes} boxes
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-green-700"
                      style={{ width: `${Math.max((fruit.revenue / maxRevenue) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ProfileMandiRatesSection({ rates, source, activeCount, onSeeAll }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("daily");
  const visibleRates = rates.filter((rate) =>
    `${rate.mandi} ${rate.state} ${rate.fruit} ${rate.grade}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const cards = visibleRates.length ? visibleRates : rates;
  const periodLabel = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[period];

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-extrabold text-black">
            Live APMC/ Fruit Mandi Rates
          </h2>
          <p className="text-[10px] font-bold text-gray-500">
            {source === "data.gov.in"
              ? "Live Data.gov.in mandi rates"
              : "Govt. mandi deal rates across India"}
          </p>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="rounded-full bg-gray-200 px-4 py-1 text-[9px] font-bold text-gray-700"
        >
          See All
        </button>
      </div>

      <div className="rounded-md border border-green-100 bg-green-50 p-2">
        <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-gray-400">
          <FaSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search mandi, state, fruit, grade"
            className="w-full bg-transparent text-xs font-semibold text-gray-950 outline-none placeholder:text-gray-400"
          />
        </label>

        <div className="mt-2">
          <PeriodTabs period={period} onChange={setPeriod} />
        </div>

        <div className="mt-2 flex items-center justify-between rounded-md bg-white px-3 py-2">
          <span className="text-[10px] font-bold text-gray-600">
            {periodLabel} rate view
          </span>
          <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-extrabold text-red-600">
            {activeCount} live deals
          </span>
        </div>
        <p className="mt-2 text-[9px] font-bold text-gray-500">
          Source: {source === "data.gov.in" ? "Data.gov.in AGMARKNET" : "Offline fallback"}
        </p>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {cards.slice(0, 6).map((rate) => {
          const values = rate[period];

          return (
            <article
              key={rate.id}
              className="min-w-[178px] shrink-0 rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[11px] font-extrabold text-black">
                    {rate.mandi}
                  </h3>
                  <p className="truncate text-[9px] font-bold text-gray-500">
                    {rate.state}
                  </p>
                </div>
                <span className="rounded bg-green-100 px-2 py-1 text-[9px] font-extrabold text-green-800">
                  {rate.trend}
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-green-800">
                  {rate.fruit}
                </span>
                <span className="text-[10px] font-bold text-gray-500">
                  Grade {rate.grade}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                <RateMetric label="Min" value={values.min} />
                <RateMetric label="Avg" value={values.avg} strong />
                <RateMetric label="Max" value={values.max} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PeriodTabs({ period, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-white p-1">
      {[
        { key: "daily", label: "Daily" },
        { key: "weekly", label: "Weekly" },
        { key: "monthly", label: "Monthly" },
      ].map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded py-1.5 text-[10px] font-extrabold ${
            period === item.key ? "bg-green-700 text-white" : "text-gray-600"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MarketLotCard({ item, onUpdateLot, onDeleteLot }) {
  const product = item.product || item;
  const [sellerQuote, setSellerQuote] = useState(null);
  const title = product.title || "Fruit Lot";
  const image = Array.isArray(product.images) ? product.images[0] : "";
  const normalizedImage = image ? image.replace(/\\/g, "/") : "";
  const imageUrl = normalizedImage
    ? /^https?:\/\//i.test(normalizedImage)
      ? normalizedImage
      : `${FILE_BASE_URL}/${normalizedImage}`
    : "";
  const amount = item.currentBid || product.basePrice || item.auctionPrice || 0;
  const hasApplePackingBreakdown =
    product.fruitName === "Apple" && Array.isArray(product.packingBreakdown) && product.packingBreakdown.length > 0;

  useEffect(() => {
    if (!product._id || !onUpdateLot) return undefined;
    let active = true;
    API.get(`/quotations/lots/${product._id}`)
      .then((res) => {
        if (!active) return;
        setSellerQuote((res.data?.quotations || [])[0] || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [product._id, onUpdateLot]);

  return (
    <article className="w-[165px] min-w-[165px] shrink-0 rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-2 h-[112px] overflow-hidden rounded-md bg-green-100">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-green-700">
            <FaSeedling />
          </div>
        )}
      </div>
      <h3 className="line-clamp-1 text-xs font-extrabold text-black">{title}</h3>
      <p className="truncate text-[10px] font-bold text-gray-600">
        {product.location || "Fruit Mandi"}
      </p>
      <p className="text-[10px] font-bold text-black">
        {product.quantity || 0} {hasApplePackingBreakdown ? "Package" : "Box"} Lot
      </p>
      {product.quality && (
        <p className="line-clamp-2 text-[9px] font-bold text-gray-600">
          Quality: {getQualityLabel(product.quality)}
        </p>
      )}
      {product.packingType && (
        <p className="truncate text-[9px] font-bold text-gray-600">
          Packing: {getPackingTypeLabel(product.packingType)}
        </p>
      )}
      <p className="text-[10px] font-bold text-green-800">Rs. {amount}</p>
      {sellerQuote && (
        <p className="mt-1 rounded bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-900">
          Total Net Receivable: Rs. {sellerQuote.totalNetReceivable || 0}
        </p>
      )}
      {(onUpdateLot || onDeleteLot) && product._id && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {onUpdateLot && (
            <button
              type="button"
              onClick={() => onUpdateLot(product._id)}
              className="inline-flex items-center justify-center gap-1 rounded bg-green-50 px-2 py-1 text-[9px] font-extrabold text-green-800 hover:bg-green-100"
            >
              <FaPen />
              Update
            </button>
          )}
          {onDeleteLot && (
            <button
              type="button"
              onClick={() => onDeleteLot(product._id)}
              className="inline-flex items-center justify-center gap-1 rounded bg-red-50 px-2 py-1 text-[9px] font-extrabold text-red-700 hover:bg-red-100"
            >
              <FaTrash />
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function GrowerBuyerQuotesSection({ quotes = [], actionId = "", onViewDetails, onAccept }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-extrabold text-black">Grade-wise Net Offer</h2>
          <p className="text-[10px] font-bold text-gray-500">Net receivable offers on your own fruit lots only</p>
        </div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-[9px] font-extrabold text-green-800">
          {quotes.length} offers
        </span>
      </div>

      {!quotes.length ? (
        <MarketEmptyState text="No buyer offers received yet." />
      ) : (
        <div className="space-y-2">
          {quotes.slice(0, 10).map((quote) => {
            const pending = normalizeQuoteStatusLabel(quote.status) === "Pending";
            const disabled = Boolean(actionId) || !pending;
            const buyerPublicProfile = getSafePublicProfile(
              quote.buyerProfile || {
                name: quote.buyerName,
                companyName: quote.buyerCompanyName || quote.buyerName,
                logoUrl: quote.buyerLogoUrl,
                mainLocation: quote.buyerMainLocation,
                isKycVerified: quote.buyerKycVerified,
                isOgVerified: quote.buyerOgVerified,
                isTrusted: quote.buyerTrusted,
                memberSince: quote.buyerMemberSince,
                totalDeals: quote.buyerTotalDeals,
                businessType: "buyer",
              },
              { businessType: "buyer" }
            );

            return (
              <article key={quote._id} className="rounded-md border border-green-100 bg-green-50 p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate text-sm font-extrabold text-gray-950">
                        {quote.lotTitle || "Fruit Lot"}
                      </h3>
                      <QuoteStatusBadge status={quote.status} />
                    </div>
                    <p className="mt-1 text-xs font-bold text-gray-600">
                      {quote.lotQuantity || 0} boxes
                    </p>
                    <div className="mt-2">
                      <LimitedPublicProfileCard
                        title="Buyer Profile"
                        profile={buyerPublicProfile}
                        emptyName="Buyer"
                        trustedLabel="Trusted Buyer"
                        resolveImageUrl={resolveProfileMediaUrl}
                      />
                    </div>
                    <div className="mt-2 space-y-1">
                      {(quote.grades || []).map((grade) => (
                        <div key={grade.grade} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded bg-white px-2 py-1 text-[11px] font-bold text-green-950">
                          <span className="min-w-0 truncate">{grade.grade}: {grade.quantity || 0} x Rs. {grade.netRate || 0}</span>
                          <span>Rs. {grade.netAmount || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-extrabold uppercase text-gray-500">
                      Total Net Receivable
                    </p>
                    <p className="text-sm font-black text-green-900">Rs. {quote.totalNetReceivable || 0}</p>
                    <p className="text-[10px] font-bold text-gray-500">
                      Net receivable amount payable to the grower after applicable deductions and settlement adjustments.
                    </p>
                    <p className="text-[10px] font-bold text-gray-500">
                      {quote.createdAt ? new Date(quote.createdAt).toLocaleString("en-IN") : "Date not available"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onViewDetails?.(quote._id)}
                    className="rounded bg-white px-2 py-2 text-[10px] font-extrabold text-green-800 ring-1 ring-green-100"
                  >
                    View Offer Details
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAccept?.(quote)}
                    className="rounded bg-green-700 px-2 py-2 text-[10px] font-extrabold text-white disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {actionId === quote._id ? "Working..." : "Accept Deal"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BuyerSubmittedQuotes({ quotes = [], orders = [], onViewLot, onViewQuote, onPay }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="mt-4 rounded-lg border border-green-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-gray-950">Submitted Offers</h2>
          <p className="text-xs font-bold text-gray-500">Track offer status from growers.</p>
        </div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-extrabold text-green-800">
          {quotes.length}
        </span>
      </div>

      {!quotes.length ? (
        <MarketEmptyState text="No submitted buyer offers yet." />
      ) : (
        <div className="space-y-2">
          {quotes.slice(0, 10).map((quote) => {
            const quoteOrder = findOrderForQuote(orders, quote);
            const paymentOrderId = quoteOrder?._id || quote.acceptedOrderId;
            const paymentStatus = String(quoteOrder?.paymentStatus || quote.acceptedOrderPaymentStatus || "PENDING").toUpperCase();
            const wonQuote = normalizeQuoteStatusLabel(quote.status) === "Accepted";
            const paymentDueAt = getQuotePaymentDueAt(quote, quoteOrder);
            const paymentMsLeft = paymentDueAt ? new Date(paymentDueAt).getTime() - now : 0;
            const paymentExpired = Boolean(paymentDueAt && paymentMsLeft <= 0);
            const canPay = wonQuote && paymentOrderId && paymentStatus === "PENDING" && !paymentExpired;

            return (
              <article key={quote._id} className={`rounded-md border p-3 ${wonQuote ? "border-green-300 bg-green-100 ring-1 ring-green-200" : "border-gray-200 bg-green-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {wonQuote && (
                      <p className="mb-1 inline-flex rounded-full bg-green-700 px-2 py-1 text-[10px] font-extrabold uppercase text-white">
                        Offer Accepted
                      </p>
                    )}
                    <h3 className="truncate text-sm font-extrabold text-gray-950">
                      {quote.lotTitle || "Fruit Lot"}
                    </h3>
                    <p className="text-xs font-bold text-gray-600">
                      Grower: {quote.growerName || "Grower"} | Buyer Bid Rate Rs. {quote.quotedTotalValue || quote.dealAmount || 0}
                    </p>
                    <p className="text-[10px] font-bold text-green-800">
                      Platform Payable: Rs. {quote.buyerPayableThroughPlatform || quote.buyerPayable || quoteOrder?.finalPrice || 0}
                    </p>
                    {wonQuote && paymentStatus === "PENDING" && (
                      <p className={`mt-1 text-[10px] font-extrabold ${paymentExpired ? "text-red-700" : "text-green-900"}`}>
                        {paymentExpired ? "Payment confirmation window expired" : `Pay within ${formatPaymentCountdown(paymentMsLeft)} to confirm consignment`}
                      </p>
                    )}
                  </div>
                  <QuoteStatusBadge status={quote.status} buyerView />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-gray-500">
                    {quote.createdAt ? new Date(quote.createdAt).toLocaleString("en-IN") : "Date not available"}
                  </span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onViewLot?.(quote)}
                      className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-green-800 ring-1 ring-green-100"
                    >
                      {wonQuote ? "View Consignment Report" : "View Lot"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewQuote?.(quote._id)}
                      className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-green-800 ring-1 ring-green-100"
                    >
                      Offer Details
                    </button>
                    {canPay && (
                      <button
                        type="button"
                        onClick={() => onPay?.(paymentOrderId)}
                        className="rounded-full bg-green-700 px-3 py-1 text-[10px] font-extrabold text-white"
                      >
                        Pay to Confirm Consignment
                      </button>
                    )}
                    {wonQuote && paymentExpired && paymentStatus === "PENDING" && (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-extrabold text-red-700 ring-1 ring-red-100">
                        Payment Window Expired
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GrowerLogisticsAssignments({ orders = [], onSubmit }) {
  const eligibleOrders = orders.filter((order) =>
    order.paymentStatus === "ESCROW" &&
    ["PAYMENT_RECEIVED_AND_HELD", "HELD_BY_BILLDESK"].includes(order.escrowStatus || "") &&
    ["AWAITING_GROWER_DETAILS", "UNREGISTERED_LOGISTICS", "AWAITING_LOGISTICS_REGISTRATION", "LOGISTICS_REJECTED", undefined, null].includes(order.logisticsAssignment?.status)
  );

  return (
    <section className="mt-4 rounded-lg border border-green-100 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-extrabold text-gray-950">Assign Logistics / Driver Details</h2>
        <p className="text-xs font-bold text-gray-500">
          Required after eFruitMandi escrow payment. Dispatch remains blocked until logistics accepts.
        </p>
      </div>
      {!eligibleOrders.length ? (
        <MarketEmptyState text="No paid consignments awaiting logistics assignment." />
      ) : (
        <div className="space-y-3">
          {eligibleOrders.map((order) => (
            <LogisticsAssignmentForm key={order._id} order={order} onSubmit={onSubmit} />
          ))}
        </div>
      )}
    </section>
  );
}

function LogisticsAssignmentForm({ order, onSubmit }) {
  const existing = order.logisticsAssignment || {};
  const [form, setForm] = useState({
    logisticsIdentifier: existing.logisticsIdentifier || existing.driverEmail || existing.driverMobile || "",
    driverName: existing.driverName || "",
    driverMobile: existing.driverMobile || "",
    vehicleNumber: existing.vehicleNumber || "",
    vehicleType: existing.vehicleType || "",
    transportFirmName: existing.transportFirmName || "",
    ownerName: existing.ownerName || "",
    pickupDate: toInputDate(existing.pickupDate),
    expectedDispatchDate: toInputDate(existing.expectedDispatchDate),
    remarks: existing.remarks || "",
  });
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partnerLookup, setPartnerLookup] = useState({ loading: false, message: "" });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const identifier = String(form.logisticsIdentifier || "").trim();
    if (identifier.length < 3) {
      setSelectedPartner(null);
      setPartnerLookup({ loading: false, message: "" });
      return undefined;
    }

    let cancelled = false;
    setPartnerLookup({ loading: true, message: "" });
    const timer = setTimeout(async () => {
      try {
        const res = await API.get(`/logistics-partners/search?identifier=${encodeURIComponent(identifier)}`);
        if (cancelled) return;
        const partner = res.data?.partner || null;
        setSelectedPartner(partner);
        if (partner) {
          setForm((current) => ({
            ...current,
            driverName: current.driverName || partner.driverName || partner.name || "",
            driverMobile: partner.driverMobile || partner.phone || current.driverMobile || "",
            vehicleNumber: partner.vehicleNumber || current.vehicleNumber || "",
            vehicleType: partner.vehicleType || current.vehicleType || "",
            transportFirmName: partner.transportFirmName || current.transportFirmName || "",
            ownerName: partner.ownerName || current.ownerName || "",
          }));
          setPartnerLookup({ loading: false, message: "Registered logistics partner selected." });
        } else {
          setPartnerLookup({ loading: false, message: "No registered logistics partner found. Enter details manually." });
        }
      } catch {
        if (!cancelled) setPartnerLookup({ loading: false, message: "Could not search logistics partner. Enter details manually." });
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.logisticsIdentifier]);

  return (
    <article className="rounded-md border border-green-100 bg-green-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-gray-950">{order.product?.title || order.product?.fruitName || "Fruit Consignment"}</p>
          <p className="text-[10px] font-bold text-gray-500">Order {order._id}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-green-800">
          {existing.status || "AWAITING_GROWER_DETAILS"}
        </span>
      </div>
      {existing.invitationLink && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          The logistics provider is not registered on eFruitMandi. Invitation sent: {existing.invitationLink}
        </p>
      )}
      <div className="mb-2">
        <SmallInput
          label="Driver / Logistics Partner Phone or Email"
          value={form.logisticsIdentifier}
          onChange={(value) => {
            update("logisticsIdentifier", value);
            update("driverMobile", value);
          }}
        />
        {partnerLookup.loading && (
          <p className="mt-1 text-[10px] font-bold text-green-700">Searching logistics partner...</p>
        )}
        {!partnerLookup.loading && partnerLookup.message && (
          <p className={`mt-1 rounded px-2 py-1 text-[10px] font-bold ${selectedPartner ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-800"}`}>
            {partnerLookup.message}
          </p>
        )}
        {selectedPartner && (
          <div className="mt-2 rounded border border-green-100 bg-white px-3 py-2 text-xs font-bold text-green-900">
            Selected: {selectedPartner.transportFirmName || selectedPartner.name || "Logistics partner"} - {selectedPartner.phone || selectedPartner.email || "Contact saved"}
          </div>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <SmallInput label="Driver Name" value={form.driverName} onChange={(value) => update("driverName", value)} />
        <SmallInput label="Driver Mobile Number" value={form.driverMobile} onChange={(value) => update("driverMobile", value)} />
        <SmallInput label="Vehicle Number" value={form.vehicleNumber} onChange={(value) => update("vehicleNumber", value)} />
        <SmallInput label="Vehicle Type" value={form.vehicleType} onChange={(value) => update("vehicleType", value)} />
        <SmallInput label="Transport Firm Name" value={form.transportFirmName} onChange={(value) => update("transportFirmName", value)} />
        <SmallInput label="Owner Name" value={form.ownerName} onChange={(value) => update("ownerName", value)} />
        <SmallInput label="Pickup Date" type="date" value={form.pickupDate} onChange={(value) => update("pickupDate", value)} />
        <SmallInput label="Expected Dispatch Date" type="date" value={form.expectedDispatchDate} onChange={(value) => update("expectedDispatchDate", value)} />
        <SmallInput label="Remarks" value={form.remarks} onChange={(value) => update("remarks", value)} />
      </div>
      <button
        type="button"
        onClick={() => onSubmit?.(order._id, form)}
        className="mt-3 rounded bg-green-700 px-4 py-2 text-xs font-extrabold text-white"
      >
        Save Logistics Assignment
      </button>
    </article>
  );
}

function DriverAssignmentRequests({ orders = [], onAccept, onReject, onOpenDelivery }) {
  const assignments = orders.filter((order) =>
    ["PENDING_LOGISTICS_ACCEPTANCE", "REGISTERED_LOGISTICS_FOUND", "LOGISTICS_ACCEPTED", "READY_FOR_DISPATCH", "LOGISTICS_REJECTED"].includes(order.logisticsAssignment?.status || "")
  );

  return (
    <section className="mt-4 rounded-lg border border-green-100 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-extrabold text-gray-950">New Consignment Assignment Available</h2>
        <p className="text-xs font-bold text-gray-500">Accept assignments before dispatch and delivery updates.</p>
      </div>
      {!assignments.length ? (
        <MarketEmptyState text="No logistics assignments available." />
      ) : (
        <div className="space-y-2">
          {assignments.map((order) => {
            const assignment = order.logisticsAssignment || {};
            const accepted = ["LOGISTICS_ACCEPTED", "READY_FOR_DISPATCH"].includes(assignment.status);
            return (
              <article key={order._id} className="rounded-md border border-green-100 bg-green-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-950">{order.product?.title || order.product?.fruitName || "Fruit Consignment"}</h3>
                    <p className="text-xs font-bold text-gray-600">{assignment.transportFirmName || "Transport firm"} | {assignment.vehicleNumber || "Vehicle pending"}</p>
                    <p className="text-[10px] font-bold text-gray-500">Pickup: {formatDate(assignment.pickupDate)} | Dispatch: {formatDate(assignment.expectedDispatchDate)}</p>
                    <p className="mt-1 text-[10px] font-extrabold text-green-800">KYC: {assignment.kycStatus || "PENDING"} | Status: {assignment.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!accepted && (
                      <>
                        <button type="button" onClick={() => onAccept?.(order._id)} className="rounded-full bg-green-700 px-3 py-1 text-[10px] font-extrabold text-white">Accept Assignment</button>
                        <button type="button" onClick={() => onReject?.(order._id)} className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-red-700 ring-1 ring-red-100">Reject Assignment</button>
                      </>
                    )}
                    {accepted && (
                      <button type="button" onClick={onOpenDelivery} className="rounded-full bg-green-700 px-3 py-1 text-[10px] font-extrabold text-white">Open Delivery Desk</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DriverDashboardGate({ onRegisterGrower }) {
  return (
    <section className="mt-4 rounded-lg border border-green-100 bg-white p-4">
      <div className="rounded-md bg-green-50 px-4 py-4 text-green-900">
        <h2 className="text-sm font-extrabold text-gray-950">This dashboard is visible only to Growers and Buyers.</h2>
        <p className="mt-2 text-xs font-bold text-green-800">Register as Grower to sell your fruit.</p>
        <button
          type="button"
          onClick={onRegisterGrower}
          className="mt-3 rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
        >
          Register as Grower to sell your fruit.
        </button>
      </div>
    </section>
  );
}

function SmallInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-[10px] font-extrabold uppercase text-gray-500">
      {label}
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 w-full rounded border border-green-100 bg-white px-2 py-2 text-xs font-bold text-gray-900 outline-none focus:border-green-500"
      />
    </label>
  );
}

function getEntityId(value) {
  return String(value?._id || value?.id || value || "");
}

function findOrderForQuote(orders = [], quote = {}) {
  const quoteId = getEntityId(quote);
  if (!quoteId) return null;

  return orders.find((order) => getEntityId(order.quote) === quoteId) || null;
}

function getQuotePaymentDueAt(quote = {}, order = {}) {
  return quote.paymentDueAt || order?.paymentDueAt || "";
}

function formatPaymentCountdown(msLeft = 0) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function QuoteStatusBadge({ status, buyerView = false }) {
  const label = normalizeQuoteStatusLabel(status);
  const displayLabel = buyerView && label === "Accepted" ? "Offer Accepted" : label;
  const classes =
    label === "Accepted"
      ? "bg-green-700 text-white"
      : label === "Rejected" || label === "Closed"
        ? "bg-gray-200 text-gray-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${classes}`}>
      {displayLabel}
    </span>
  );
}

function normalizeQuoteStatusLabel(status = "") {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "accepted") return "Accepted";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "closed" || normalized === "expired") return "Closed";
  if (normalized === "cancelled") return "Cancelled";
  return "Pending";
}

function maskPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "Phone hidden";
  return `${digits.slice(0, 2)}XXXX${digits.slice(-2)}`;
}

function SalesMetric({ icon, label, value }) {
  return (
    <div className="rounded-md bg-white px-2 py-2">
      <div className="mb-1 flex items-center gap-1 text-green-700">
        {icon}
        <span className="text-[8px] font-extrabold text-gray-500">{label}</span>
      </div>
      <p className="truncate text-[11px] font-extrabold text-black">{value}</p>
    </div>
  );
}

function RateMetric({ label, value, strong = false }) {
  return (
    <div className={`rounded bg-gray-50 px-1 py-2 ${strong ? "bg-green-50" : ""}`}>
      <p className="text-[8px] font-bold text-gray-500">{label}</p>
      <p className={`text-[10px] font-extrabold ${strong ? "text-green-800" : "text-black"}`}>
        Rs. {value}
      </p>
    </div>
  );
}

function MarketEmptyState({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <FaSeedling className="text-lg" />
      <p className="text-xs font-bold">{text}</p>
    </div>
  );
}

function ProfileLanguageCard({ value, isEditing, onEdit, onChange }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            Profile language
          </h2>
          <p className="mt-3 text-sm text-gray-600">{value}</p>
          {isEditing && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["English", "Hindi"].map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => onChange(language)}
                  className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                    value === language
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-green-500 hover:bg-green-50"
                  }`}
                >
                  {language}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="mt-1 text-xl text-gray-700 hover:text-green-700"
          aria-label="Edit profile language"
        >
          <FaPen />
        </button>
      </div>
    </section>
  );
}

function ProfileSideCard({ title, value }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-3 text-sm text-gray-600">{value}</p>
        </div>
        <button type="button" className="text-xl text-gray-700">
          <FaPen />
        </button>
      </div>
    </section>
  );
}

function BuyerLockedAmountCard({ amountLabel, compact = false }) {
  return (
    <section className={`mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 ${compact ? "md:mt-0" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
            Locked Amount
          </p>
          <h2 className="mt-1 text-2xl font-black text-gray-950">{amountLabel}</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-emerald-900">
            Amount reserved for active buyer deals and pending transactions.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xl text-white">
          <FaLock />
        </div>
      </div>
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
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gray-900 font-semibold text-white ${className}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function DeleteLotConfirmDialog({ product, loading, onCancel, onConfirm }) {
  const title = product?.title || product?.fruitName || "this fruit lot";

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-lot-title"
    >
      <section className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
            <FaTrash />
          </span>
          <div>
            <h2 id="delete-lot-title" className="text-base font-black text-gray-950">
              Delete fruit lot?
            </h2>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              {title} will be removed from your grower profile if it is still unconfirmed or incomplete.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            <FaTrash />
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ImagePreviewModal({ image, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-gray-900 shadow"
        aria-label="Close full image"
      >
        ×
      </button>
      <img
        src={image.src}
        alt={image.alt}
        className="max-h-[90vh] max-w-[94vw] rounded-md object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
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

function createAddressDraft(user = {}) {
  if (
    user.addressLine1 ||
    user.addressLine2 ||
    user.addressLine3 ||
    user.pinCode
  ) {
    return {
      addressLine1: user.addressLine1 || "",
      addressLine2: user.addressLine2 || "",
      addressLine3: user.addressLine3 || "",
      pinCode: user.pinCode || "",
    };
  }

  return {
    addressLine1: user.location || "",
    addressLine2: "",
    addressLine3: "",
    pinCode: "",
  };
}

function createEntityAddressDraft(user = {}, mode = "") {
  if (mode === "buyer") {
    return {
      businessAddressLine1: user.buyerLocation || "",
      businessAddressLine2: "",
      businessAddressLine3: "",
      businessPinCode: user.buyerPinCode || "",
    };
  }

  if (mode === "grower") {
    return {
      businessAddressLine1: user.addressLine1 || user.location || "",
      businessAddressLine2: user.addressLine2 || "",
      businessAddressLine3: user.addressLine3 || "",
      businessPinCode: user.pinCode || "",
    };
  }

  if (
    user.businessAddressLine1 ||
    user.businessAddressLine2 ||
    user.businessAddressLine3 ||
    user.businessPinCode
  ) {
    return {
      businessAddressLine1: user.businessAddressLine1 || "",
      businessAddressLine2: user.businessAddressLine2 || "",
      businessAddressLine3: user.businessAddressLine3 || "",
      businessPinCode: user.businessPinCode || "",
    };
  }

  return {
    businessAddressLine1: user.location || "",
    businessAddressLine2: "",
    businessAddressLine3: "",
    businessPinCode: "",
  };
}

function createProfileDraft(user = {}) {
  return {
    name: user.name || "",
    designation: user.designation || "",
    orchardName: user.orchardName || "",
    businessName: user.businessName || "",
    buyerContactPerson: user.buyerContactPerson || "",
    logisticsName: user.logisticsName || "",
  };
}

function createSocialDraft(user = {}) {
  return {
    google: user.socialLinks?.google || "",
    facebook: user.socialLinks?.facebook || "",
  };
}

function createMediaDraft() {
  return {
    avatarUrlFile: null,
    avatarUrlPreview: "",
    bannerUrlFile: null,
    bannerUrlPreview: "",
    companyLogoUrlFile: null,
    companyLogoUrlPreview: "",
  };
}

function formatBusinessAddress(user = {}) {
  const parts = [
    user.businessAddressLine1,
    user.businessAddressLine2,
    user.businessAddressLine3,
    user.businessPinCode,
  ].filter((part) => typeof part === "string" && part.trim());

  return parts.join(", ");
}

function formatProfileAddress(user = {}) {
  const parts = [
    user.addressLine1,
    user.addressLine2,
    user.addressLine3,
    user.pinCode,
  ].filter((part) => typeof part === "string" && part.trim());

  return parts.join(", ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
