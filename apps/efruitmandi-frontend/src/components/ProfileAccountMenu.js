import { useState } from "react";
import {
  FaBriefcase,
  FaCertificate,
  FaChartLine,
  FaChevronRight,
  FaCommentDots,
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
  const avatarUrl = user.avatarUrl;
  const isGrower = user.role === "grower" || Boolean(user.orchardName);
  const isBuyer = user.role === "buyer" || Boolean(user.businessName);
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

  const menuItems = [
    {
      label: "Edit Profile",
      icon: <FaUserCircle />,
      path: "/profile-dashboard",
    },
    {
      label: "Register as Grower",
      icon: <FaSeedling />,
      path: "/register-grower",
      hasChevron: true,
    },
    {
      label: "Register as Fruit Buyer",
      icon: <FaHandshake />,
      path: "/register-buyer",
      hasChevron: true,
    },
    {
      label: "Register as Logistic Partner",
      icon: <FaTruck />,
      path: "/register-driver",
      hasChevron: true,
    },
  ];
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
        {isGrower ? (
          growerMenuSections.map((section, sectionIndex) => (
            <div
              key={sectionIndex}
              className={sectionIndex > 0 ? "border-t border-white/15 py-2" : "pb-2"}
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
          buyerMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item.path)}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-green-800"
            >
              <span className="flex w-6 justify-center text-lg text-yellow-300">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              <FaChevronRight className="text-white/75" />
            </button>
          ))
        ) : (
          menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item.path)}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-green-800"
            >
              <span className="flex w-6 justify-center text-lg text-white">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.hasChevron && <FaChevronRight className="text-white/75" />}
            </button>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/15 py-2">
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
