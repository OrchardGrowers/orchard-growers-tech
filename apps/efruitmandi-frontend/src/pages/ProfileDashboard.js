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
  FaTruck,
  FaYoutube,
} from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import {
  hasBuyerProfile,
  hasDriverProfile,
  hasGrowerProfile,
} from "../utils/auth";
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
const logoUrl = assetUrl("/logo.png");
const orchardCover = assetUrl("/profile-banners/efruitmandi-profile-cover.png");
const buyerLogoUrl = assetUrl("/profile-images/green-valley-fruit-traders-logo.svg");
const youtubeUrl = "https://www.youtube.com/results?search_query=Efruit+Mandi";

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
  const locationState = useLocation().state;
  const hasAccessToken = Boolean(localStorage.getItem("accessToken"));
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState("");
  const [adMenuOpen, setAdMenuOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [profileDraft, setProfileDraft] = useState(createProfileDraft());
  const [addressDraft, setAddressDraft] = useState(createAddressDraft());
  const [businessAddressDraft, setBusinessAddressDraft] = useState(createBusinessAddressDraft());
  const [mediaDraft, setMediaDraft] = useState(createMediaDraft());
  const [contactDraft, setContactDraft] = useState({
    phone: "",
    otp: "",
    otpReqId: "",
    otpSent: false,
    verifiedPhone: "",
    loading: false,
  });
  const [contactOtpCooldown, setContactOtpCooldown] = useState(0);
  const [emailDraft, setEmailDraft] = useState({
    email: "",
    otp: "",
    verifiedEmail: "",
    loading: false,
  });
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const [socialDraft, setSocialDraft] = useState(createSocialDraft());
  const [detectingAddress, setDetectingAddress] = useState(false);

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
        const [profileRes, productRes, auctionRes, orderRes, mandiRateRes] = await Promise.all([
          API.get("/user/profile").catch(() => ({ data: storedUser })),
          API.get("/products").catch(() => ({ data: [] })),
          API.get("/auctions").catch(() => ({ data: [] })),
          API.get("/orders").catch(() => ({ data: [] })),
          API.get("/mandi-rates").catch(() => ({
            data: { source: "fallback", records: mandiRates },
          })),
        ]);

        setProfile(profileRes.data || storedUser);
        setProducts(getEfruitMandiProducts(productRes.data));
        setAuctions(auctionRes.data || []);
        setOrders(orderRes.data || []);
        setMandiRateData(mandiRateRes.data?.records || mandiRates);
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
  const profileAddress = formatProfileAddress(user);
  const businessAddress = formatBusinessAddress(user);
  const displayName =
    isGrower
      ? user.orchardName || user.name || "Pawan Orchards"
      : isDriver
        ? user.logisticsName || user.name || "Logistics Partner"
        : user.businessName || user.name || "Visitor";
  const location = businessAddress || user.location || profileAddress || "Shilhi Bagi, Thunag, Mandi, H.P.";
  const profileDesignation = String(user.designation || "").trim();
  const headline = isGrower
    ? `${profileDesignation || "Fruit grower"} @ ${displayName} | Fruit grower`
    : isBuyer
      ? `Buyer @ ${displayName} | Fruit trading partner`
      : isDriver
        ? `Logistics partner @ ${displayName}`
        : "Visitor account";
  const dashboardTitle = isGrower
    ? "Growers Profile dashboard"
    : isBuyer
      ? "Buyer Profile Dashboard"
      : isDriver
        ? "Logistic Partner Profile Dashboard"
        : "User Profile Dashboard";
  const registrationActions = [
    ...(!isDriver
      ? [
          {
            title: isBuyer ? "Update Buyer Profile" : "Register as Buyer",
            description: isBuyer
              ? "Update buyer details used for fruit deals and payments."
              : "Create a buyer profile and participate in live fruit deals.",
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
    ...(!isBuyer
      ? [
          {
            title: isDriver ? "Update Logistic Partner Profile" : "Register as Logistic Partner",
            description: isDriver
              ? "Update logistic partner profile and vehicle details."
              : "Create a logistic partner profile and manage fruit lot deliveries.",
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
  const needsSocialUpdate = !socialLinks.google && !socialLinks.facebook;
  const accountCompletionMessages = [
    needsEmailUpdate ? "Add verified email" : "",
    needsContactUpdate ? "Add verified contact number" : "",
    needsSocialUpdate ? "Add social media links" : "",
  ].filter(Boolean);
  const kycStatus = user.kyc?.status || "NOT_SUBMITTED";
  const isKycCompleted = ["COMPLETED", "APPROVED"].includes(kycStatus);
  const needsKycUpdate = !isKycCompleted;
  const verifiedContactNo = profileContactNo || "Add contact no.";
  const verifiedEmail = profileEmail || "Add email";
  const visitorAddress = profileAddress || user.location || "not available";
  const isTrustedAccount = Boolean(user.isVerified);
  const organizationLabel = displayName;
  const trustedLabel = isTrustedAccount
    ? "Orchard Growers Verified"
    : "Verification requires Orchard Growers Team approval and fee.";
  const trustedActionLabel = isBuyer ? "Visit Buyers Space" : "Visit Growers Orchard";
  const organizationLogo = isBuyer
    ? buyerLogoUrl
    : logoUrl;
  const companyLogoUrl = resolveProfileMediaUrl(user.companyLogoUrl) || organizationLogo;
  const bannerUrl = resolveProfileMediaUrl(user.bannerUrl) || orchardCover;
  const avatarUrl = resolveProfileMediaUrl(user.avatarUrl);
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
      return createMediaDraft(user);
    });
    setShowEditProfile(false);
  };

  const openEditProfile = () => {
    setProfileDraft(createProfileDraft(user));
    setAddressDraft(createAddressDraft(user));
    setBusinessAddressDraft(createBusinessAddressDraft(user));
    setContactDraft({
      phone: profileContactNo,
      otp: "",
      otpReqId: "",
      otpSent: false,
      verifiedPhone: "",
      loading: false,
    });
    setContactOtpCooldown(0);
    setEmailDraft({
      email: profileEmail,
      otp: "",
      verifiedEmail: "",
      loading: false,
    });
    setEmailOtpCooldown(0);
    setSocialDraft(createSocialDraft(user));
    setMediaDraft(createMediaDraft(user));
    setShowEditProfile(true);
  };

  const sendContactOtp = async () => {
    const phone = contactDraft.phone.trim();

    if (contactOtpCooldown > 0) return;

    if (!phone) {
      setNotice("Enter contact number first.");
      return;
    }

    try {
      setContactDraft((current) => ({ ...current, loading: true, verifiedPhone: "" }));
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      const normalizedPhone = normalizeIndianMobile(phone);
      if (!normalizedPhone) {
        setNotice("Enter a valid phone number.");
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
      await verifyMsg91WidgetOtp({ widgetId, tokenAuth, otp, reqId: contactDraft.otpReqId, phone: normalizeIndianMobile(phone) || phone, mode: "signup" });
      setContactDraft((current) => ({
        ...current,
        verifiedPhone: phone,
        loading: false,
      }));
      setNotice("Contact number verified.");
    } catch (err) {
      setContactDraft((current) => ({ ...current, loading: false }));
      setNotice(err.response?.data?.msg || err.message || "OTP verification failed.");
    }
  };

  const sendEmailOtp = async () => {
    const email = emailDraft.email.trim();

    if (emailOtpCooldown > 0) return;

    if (!email) {
      setNotice("Enter email first.");
      return;
    }

    try {
      setEmailDraft((current) => ({ ...current, loading: true, verifiedEmail: "" }));
      const res = await API.post("/auth/send-otp", { identifier: email, platform: "efruitmandi" });
      setEmailOtpCooldown(60);
      setNotice(res.data?.message || "OTP sent.");
    } catch (err) {
      setNotice(err.response?.data?.msg || "Unable to send OTP.");
    } finally {
      setEmailDraft((current) => ({ ...current, loading: false }));
    }
  };

  const verifyEmailOtp = async () => {
    const email = emailDraft.email.trim();
    const otp = emailDraft.otp.trim();

    if (!email || !otp) {
      setNotice("Enter email and OTP.");
      return;
    }

    try {
      setEmailDraft((current) => ({ ...current, loading: true }));
      await API.post("/auth/verify-otp", { identifier: email, otp, platform: "efruitmandi" });
      setEmailDraft((current) => ({
        ...current,
        verifiedEmail: email,
        loading: false,
      }));
      setNotice("Email verified.");
    } catch (err) {
      setEmailDraft((current) => ({ ...current, loading: false }));
      setNotice(err.response?.data?.msg || "OTP verification failed.");
    }
  };

  const saveProfileDetails = async () => {
    const location = formatBusinessAddress(businessAddressDraft) || formatProfileAddress(addressDraft);
    const nextPhone = contactDraft.phone.trim();
    const nextEmail = emailDraft.email.trim();
    const contactChanged = nextPhone && nextPhone !== profileContactNo;
    const emailChanged = nextEmail && nextEmail !== profileEmail;

    if (contactChanged && contactDraft.verifiedPhone !== nextPhone) {
      setNotice("Verify contact number OTP before saving.");
      return;
    }
    if (emailChanged && emailDraft.verifiedEmail !== nextEmail) {
      setNotice("Verify email OTP before saving.");
      return;
    }

    try {
      const res = await API.patch("/user/profile", {
        ...profileDraft,
        ...addressDraft,
        ...businessAddressDraft,
        location,
        ...(contactChanged ? { phone: nextPhone } : {}),
        ...(emailChanged ? { email: nextEmail } : {}),
        socialLinks: socialDraft,
      });
      const profileUser = {
        ...user,
        ...(res.data || {}),
      };
      let savedUser = profileUser;
      const mediaFiles = {
        avatarUrl: mediaDraft.avatarUrlFile,
        bannerUrl: mediaDraft.bannerUrlFile,
        companyLogoUrl: mediaDraft.companyLogoUrlFile,
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
              onClick={openEditProfile}
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
                      {location} <span className="text-gray-400">-</span>{" "}
                      <button className="font-semibold text-blue-700" type="button">
                        Contact info
                      </button>
                    </p>
                    <p className="mt-3 text-sm font-semibold text-blue-700">
                      Since with us: {joinedLabel}
                      {isTrustedAccount && " - OG Verified"}
                    </p>
                    {isGrower && (
                      <button
                        type="button"
                        onClick={() => navigate("/list-new-lot")}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-green-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-green-800"
                      >
                        <FaSeedling />
                        List Fruit Lot
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
                      alt=""
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
                    Get Verified
                  </button>
                )}
              </div>
              )}
            </div>
          </div>
        </section>

        {registrationActions.length > 0 && (
          <RoleRegistrationCards
            options={registrationActions}
            onSelect={(path) => navigate(path)}
          />
        )}

        {needsKycUpdate ? (
          <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-900">
              KYC is mandatory for all users.
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
              Submit Udyan card, bank/passbook, and Aadhaar details to complete your profile.
            </p>
            <button
              type="button"
              onClick={() => navigate("/kyc")}
              className="mt-3 rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
            >
              Complete KYC
            </button>
          </section>
        ) : (
          <section className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-extrabold text-green-900">
              {kycStatus === "APPROVED" ? "KYC Verified" : "KYC Submitted"}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-green-800">
              {kycStatus === "APPROVED"
                ? "Your profile is ready for marketplace activity."
                : "Your documents are waiting for authority verification within 24 hours."}
            </p>
          </section>
        )}

        {isBuyer && (
          <BuyerLockedAmountCard amountLabel={lockedAmountLabel} />
        )}

      {notice && (
        <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            Close
          </button>
        </div>
      )}

        <ProfileMarketPanel
          loading={marketLoading}
          products={currentListings}
          closedAuctions={closedAuctions}
          salesRecords={salesRecords}
          rates={mandiRateData}
          rateSource={mandiRateSource}
          activeAuctions={activeAuctions}
          onSeeListings={() => navigate("/profile-dashboard")}
          onSeeClosed={() => navigate("/orders")}
          onSeeRates={() => navigate("/auctions")}
        />

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
        {isBuyer && (
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
            <h2 className="text-lg font-bold text-gray-950">Edit Profile</h2>
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-extrabold text-gray-800">Change banner</p>
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
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-extrabold text-gray-800">Profile photo</p>
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
                <p className="text-xs font-extrabold text-gray-800">Company logo</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <img
                      src={mediaDraft.companyLogoUrlPreview || companyLogoUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
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
              <p className="text-xs font-extrabold text-gray-800">Personal details</p>
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
                  {isBuyer ? "Company details" : isGrower ? "Orchard details" : "Business details"}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-emerald-900">
                  Keep entity name and premises separate from the personal user address.
                </p>
                <div className="mt-3 grid gap-3">
                  {isBuyer && (
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
                  {isGrower && (
                    <AddressInput
                      label="Orchard name"
                      value={profileDraft.orchardName}
                      placeholder="Orchard name"
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, orchardName: value }))
                      }
                    />
                  )}
                  {isDriver && (
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
                    label="Premises address line 1"
                    value={businessAddressDraft.businessAddressLine1}
                    placeholder="Shop, office, company, orchard, building"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessAddressLine1: value }))
                    }
                  />
                  <AddressInput
                    label="Premises address line 2"
                    value={businessAddressDraft.businessAddressLine2}
                    placeholder="Market, road, village, tehsil"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessAddressLine2: value }))
                    }
                  />
                  <AddressInput
                    label="Premises address line 3"
                    value={businessAddressDraft.businessAddressLine3}
                    placeholder="District, state, country"
                    onChange={(value) =>
                      setBusinessAddressDraft((current) => ({ ...current, businessAddressLine3: value }))
                    }
                  />
                  <AddressInput
                    label="Premises postal code"
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
                <p className="text-xs font-extrabold text-green-800">Verified contact number</p>
                {contactDraft.verifiedPhone && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-green-700">
                    Verified
                  </span>
                )}
              </div>
              {needsContactUpdate && (
                <p className="mb-3 text-xs font-semibold leading-5 text-gray-700">
                  You logged in with email. Please add and verify your contact number before registering as Grower, Buyer, or Driver.
                </p>
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
                    }));
                    setContactOtpCooldown(0);
                  }}
                  placeholder="Enter contact number"
                  className="w-full rounded-md border border-green-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700"
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                  <input
                    value={contactDraft.otp}
                    inputMode="numeric"
                    onChange={(event) =>
                      setContactDraft((current) => ({ ...current, otp: event.target.value }))
                    }
                    placeholder="OTP"
                    className="min-w-0 rounded-md border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-700"
                  />
                  <button
                    type="button"
                    onClick={sendContactOtp}
                    disabled={contactDraft.loading || contactOtpCooldown > 0}
                    className="rounded-md bg-white px-3 py-2 text-xs font-extrabold text-green-800 disabled:opacity-60"
                  >
                    {contactOtpCooldown > 0 ? `${contactOtpCooldown}s` : "Request OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={verifyContactOtp}
                    disabled={contactDraft.loading}
                    className="rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-extrabold text-blue-800">Verified email</p>
                {emailDraft.verifiedEmail && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-blue-700">
                    Verified
                  </span>
                )}
              </div>
              {needsEmailUpdate && (
                <p className="mb-3 text-xs font-semibold leading-5 text-gray-700">
                  You logged in with phone number. Please add and verify your email for account recovery and communication.
                </p>
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
                    }));
                    setEmailOtpCooldown(0);
                  }}
                  placeholder="Enter email address"
                  className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-700"
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                  <input
                    value={emailDraft.otp}
                    inputMode="numeric"
                    onChange={(event) =>
                      setEmailDraft((current) => ({ ...current, otp: event.target.value }))
                    }
                    placeholder="OTP"
                    className="min-w-0 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-700"
                  />
                  <button
                    type="button"
                    onClick={sendEmailOtp}
                    disabled={emailDraft.loading || emailOtpCooldown > 0}
                    className="rounded-md bg-white px-3 py-2 text-xs font-extrabold text-blue-800 disabled:opacity-60"
                  >
                    {emailOtpCooldown > 0 ? `${emailOtpCooldown}s` : "Request OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={verifyEmailOtp}
                    disabled={emailDraft.loading}
                    className="rounded-md bg-blue-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                  >
                    Verify
                  </button>
                </div>
              </div>
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
                className="flex-1 rounded-md bg-gray-100 py-2 text-sm font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfileDetails}
                className="flex-1 rounded-md bg-green-700 py-2 text-sm font-bold text-white"
              >
                Save
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
          onClick={() => onSelect(option.path)}
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

function ProfileMarketPanel({
  loading,
  products,
  closedAuctions,
  salesRecords,
  rates,
  rateSource,
  activeAuctions,
  onSeeListings,
  onSeeClosed,
  onSeeRates,
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      {loading && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
          Loading market activity...
        </p>
      )}

      <MarketLotSection
        title="Current Listings"
        items={products}
        emptyText="No current listing yet. Add a fruit lot to manage it here."
        onSeeAll={onSeeListings}
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

function MarketLotSection({ title, items, emptyText, onSeeAll }) {
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
            <MarketLotCard key={item._id || index} item={item} />
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

function MarketLotCard({ item }) {
  const product = item.product || item;
  const title = product.title || "Fruit Lot";
  const image = Array.isArray(product.images) ? product.images[0] : "";
  const normalizedImage = image ? image.replace(/\\/g, "/") : "";
  const imageUrl = normalizedImage
    ? `${FILE_BASE_URL}/${normalizedImage}`
    : "";
  const amount = item.currentBid || product.basePrice || item.auctionPrice || 0;

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
        {product.quantity || 0} Box Lot
      </p>
      <p className="text-[10px] font-bold text-green-800">Rs. {amount}</p>
    </article>
  );
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

function createBusinessAddressDraft(user = {}) {
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
