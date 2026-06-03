import { useState } from "react";
import {
  FaBriefcase,
  FaCertificate,
  FaChartLine,
  FaChevronRight,
  FaCommentDots,
  FaDownload,
  FaDollarSign,
  FaFileInvoice,
  FaHandshake,
  FaHeadset,
  FaInfoCircle,
  FaLock,
  FaPlus,
  FaStar,
  FaSeedling,
  FaSignOutAlt,
  FaTrophy,
  FaTruck,
  FaUserCircle,
} from "react-icons/fa";
import { openEFruitInstallPrompt } from "./InstallAppPrompt";
import {
  hasBuyerProfile,
  hasDriverProfile,
  hasGrowerProfile,
} from "../utils/auth";
import { FILE_BASE_URL } from "../services/api";

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

export default function ProfileAccountMenu({ user = {}, onAction, onLogout, mobile = false }) {
  const [activeGrowerMenuItem, setActiveGrowerMenuItem] = useState(
    () => localStorage.getItem("activeGrowerMenuItem") || ""
  );
  const displayName =
    user.orchardName ||
    user.businessName ||
    user.logisticsName ||
    user.name ||
    "Orchard Growers";
  const handle = `@${String(displayName)
    .replace(/[^a-z0-9]+/gi, "")
    .slice(0, 24) || "OrchardGrowers"}`;
  const avatarUrl = resolveProfileMediaUrl(user.avatarUrl);
  const isGrower = hasGrowerProfile(user);
  const isBuyer = hasBuyerProfile(user);
  const isDriver = hasDriverProfile(user);
  const lockedAmountLabel = formatCurrency(user.lockedAmount || 0);

  const growerMenuSections = [
    [
      {
        label: "List New Lot",
        icon: <FaPlus />,
        path: "/list-new-lot",
      },
      {
        label: "Current Listings",
        icon: <FaTruck />,
        path: "/profile-dashboard",
      },
      {
        label: "Fruit Sale Report",
        icon: <FaChartLine />,
        path: "/profile-dashboard",
      },
      {
        label: "Downloads Invoices/chalan",
        icon: <FaFileInvoice />,
        path: "/orders",
      },
    ],
    [
      {
        label: "Edit Profile",
        icon: <FaUserCircle />,
        path: "/profile-dashboard",
      },
      {
        label: "KYC",
        icon: <FaBriefcase />,
        path: "/kyc",
      },
      {
        label: "Get Verified",
        icon: <FaCertificate />,
        path: "/get-verified",
      },
    ],
  ];

  const profileActionItems = [
    {
      label: "Edit Profile",
      icon: <FaUserCircle />,
      path: "/profile-dashboard",
    },
    ...(isBuyer || !isDriver
      ? [
          {
            label: isBuyer ? "Switch to Buyer Dashboard" : "Register as Buyer",
            icon: <FaHandshake />,
            path: isBuyer ? "/profile-dashboard" : "/register-buyer",
            mode: isBuyer ? "buyer" : "",
            hasChevron: true,
          },
        ]
      : []),
    {
      label: isGrower ? "Switch to Grower Dashboard" : "Register as Grower",
      icon: <FaSeedling />,
      path: isGrower ? "/profile-dashboard" : "/register-grower",
      mode: isGrower ? "grower" : "",
      hasChevron: true,
    },
    ...(!isBuyer || isDriver
      ? [
          {
            label: isDriver ? "Switch to Logistic Partner Dashboard" : "Register as Logistic Partner",
            icon: <FaTruck />,
            path: isDriver ? "/profile-dashboard" : "/register-driver",
            mode: isDriver ? "driver" : "",
            hasChevron: true,
          },
        ]
      : []),
  ].filter((item) => item.path !== "/register-driver" || !isBuyer);

  const renderMenuButton = (item, iconColor = "text-white") => (
    <button
      key={item.label}
      type="button"
      onClick={() => {
        if (item.mode) {
          localStorage.setItem("efruitmandiProfileMode", item.mode);
          window.dispatchEvent(
            new CustomEvent("efruitmandi-profile-mode-change", {
              detail: { mode: item.mode },
            })
          );
        }
        onAction(item.path);
      }}
      className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-green-800"
    >
      <span className={`flex w-6 justify-center text-lg ${iconColor}`}>
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.hasChevron && <FaChevronRight className="text-white/75" />}
    </button>
  );

  const buyerMenuItems = [
    {
      label: "Make a Deal",
      icon: <FaHandshake />,
      path: "/auctions",
    },
    {
      label: "My Winning Deals",
      icon: <FaTrophy />,
      path: "/orders",
    },
    {
      label: "Dashboard",
      icon: <FaChartLine />,
      path: "/profile-dashboard",
    },
    {
      label: "KYC",
      icon: <FaBriefcase />,
      path: "/kyc",
    },
    {
      label: "Transactions",
      icon: <FaFileInvoice />,
      path: "/orders",
    },
    {
      label: "Invest With us",
      icon: <FaDollarSign />,
      path: "/profile-dashboard",
    },
    {
      label: "How to buy with us",
      icon: <FaInfoCircle />,
      path: "/auctions",
    },
    {
      label: "Become Certified Buyer",
      icon: <FaCertificate />,
      path: "/get-verified",
    },
    {
      label: "Growersr’s Review",
      icon: <FaStar />,
      path: "/profile-dashboard",
    },
    {
      label: "Your Sujestions",
      icon: <FaCommentDots />,
      path: "/profile-dashboard",
    },
    {
      label: "Help & Feedback",
      icon: <FaHeadset />,
      path: "/profile-dashboard",
    },
  ];
  const containerClass = mobile
    ? "fixed bottom-[calc(3.6rem+env(safe-area-inset-bottom))] left-0 right-0 top-12 z-[60] flex flex-col overflow-hidden bg-green-700 text-white shadow-2xl"
    : "fixed right-4 top-14 bottom-0 z-50 flex w-80 flex-col overflow-hidden rounded-b-lg border border-t-0 border-green-600 bg-green-700 text-white shadow-2xl";
  const openGrowerMenuItem = (item) => {
    setActiveGrowerMenuItem(item.label);
    localStorage.setItem("activeGrowerMenuItem", item.label);
    onAction(item.path);
  };

  return (
    <div className={containerClass}>
      <div className="flex shrink-0 gap-3 bg-green-800 px-4 py-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-11 w-11 rounded-full border-2 border-white bg-gray-900 object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-lg font-semibold text-white">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">{displayName}</p>
          <p className="truncate text-sm text-white/80">{handle}</p>
          <button
            type="button"
            onClick={() => onAction("/profile-dashboard")}
            className="mt-1 text-left text-sm font-semibold text-white hover:text-yellow-200"
          >
            View your profile
          </button>
          {isBuyer && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-950/45 px-3 py-1 text-xs font-extrabold text-yellow-200">
              <FaLock />
              <span>Locked Amount: {lockedAmountLabel}</span>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/15 py-2 [scrollbar-color:#facc15_#15803d] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-yellow-400 [&::-webkit-scrollbar-track]:bg-green-700 [&::-webkit-scrollbar]:w-2">
        <div className="border-b border-white/15 pb-2">
          {profileActionItems.map((item) => renderMenuButton(item, "text-white"))}
        </div>

        {isGrower ? (
          growerMenuSections.map((section, sectionIndex) => (
            <div
              key={sectionIndex}
              className={sectionIndex > 0 ? "border-t border-white/15 py-2" : "py-2"}
            >
              {section.map((item) => {
                const isActive = activeGrowerMenuItem === item.label;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => openGrowerMenuItem(item)}
                    className={`flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-green-800 active:bg-orange-500 active:text-white focus-visible:bg-orange-500 focus-visible:text-white focus-visible:outline-none ${
                      isActive ? "bg-orange-500" : ""
                    }`}
                  >
                    <span
                      className={`flex w-6 justify-center text-lg ${
                        isActive ? "text-white" : "text-yellow-300"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))
        ) : isBuyer ? (
          <div className="py-2">
            {buyerMenuItems.map((item) => renderMenuButton(item, "text-yellow-300"))}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/15 py-2">
        <button
          type="button"
          onClick={openEFruitInstallPrompt}
          className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-green-800"
        >
          <span className="flex w-6 justify-center text-lg text-yellow-300">
            <FaDownload />
          </span>
          <span>Download App</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-green-800"
        >
          <span className="flex w-6 justify-center text-lg text-yellow-300">
            <FaSignOutAlt />
          </span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
