import { useEffect, useMemo, useState } from "react";
import {
  FaBell,
  FaCheck,
  FaClock,
  FaEye,
  FaFilter,
  FaGavel,
  FaMapMarkerAlt,
  FaRegBell,
  FaSeedling,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API, { FILE_BASE_URL } from "../services/api";
import { getEfruitMandiProducts } from "../utils/marketProducts";

const filters = [
  { key: "all", label: "All" },
  { key: "deal", label: "Deal Open" },
  { key: "upcoming", label: "Upcoming" },
  { key: "closed", label: "Closed" },
];
const READ_NOTIFICATIONS_KEY = "efruitmandiReadNotifications";
const NOTIFICATION_STATE_EVENT = "efruitmandi-notifications-updated";

export default function Notifications() {
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [readIds, setReadIds] = useState(() => loadReadNotifications());

  useEffect(() => {
    const loadLots = async () => {
      try {
        const res = await API.get("/products?platform=efruitmandi");
        const latestLots = getEfruitMandiProducts(res.data)
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 24);

        setLots(latestLots);
      } catch (err) {
        console.error(err);
        setLots([]);
      } finally {
        setLoading(false);
      }
    };

    loadLots();
  }, []);

  const notifications = useMemo(
    () => lots.map((lot) => buildLotNotification(lot, readIds.has(lot._id))),
    [lots, readIds]
  );

  const visibleNotifications = notifications.filter((notification) =>
    activeFilter === "all" ? true : notification.type === activeFilter
  );
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const dealOpenCount = notifications.filter((notification) => notification.type === "deal").length;

  const markRead = (id) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadNotifications(next);
  };

  const markAllRead = () => {
    const next = new Set(notifications.map((notification) => notification.id));
    setReadIds(next);
    saveReadNotifications(next);
  };

  const openLot = (id) => {
    markRead(id);
    navigate(`/lots/${id}`);
  };

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <header className="full-bleed-notifications -mx-3 bg-green-800 px-4 pb-5 pt-4 text-white md:-mx-4 md:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-green-100">
                <FaBell />
                eFruitMandi Alerts
              </p>
              <h1 className="mt-2 text-2xl font-black leading-tight md:text-3xl">
                Notifications
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-green-50">
                Track fresh lot listings, live deal windows, and marketplace updates from verified growers.
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-green-800 shadow-sm disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-500"
            >
              Mark all read
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Metric label="Unread" value={unreadCount} />
            <Metric label="Deal Open" value={dealOpenCount} />
            <Metric label="Latest Lots" value={notifications.length} />
          </div>
        </div>
      </header>

      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-extrabold text-gray-700">
            <FaFilter className="text-green-700" />
            Notification filters
          </p>
          <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold text-green-800">
            {visibleNotifications.length} shown
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
                activeFilter === filter.key
                  ? "bg-green-700 text-white"
                  : "bg-white text-gray-700 ring-1 ring-green-100 hover:bg-green-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {loading && <NotificationSkeleton />}

      {!loading && !visibleNotifications.length ? (
        <EmptyNotification filter={activeFilter} />
      ) : (
        <section className="mt-2 space-y-3">
          {visibleNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onOpen={() => openLot(notification.id)}
              onMarkRead={() => markRead(notification.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-3 ring-1 ring-white/15">
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-extrabold uppercase text-green-100">{label}</p>
    </div>
  );
}

function NotificationCard({ notification, onOpen, onMarkRead }) {
  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm ${
        notification.read ? "border-gray-200" : "border-green-300 ring-1 ring-green-100"
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="relative h-20 w-24 shrink-0 overflow-hidden rounded-md bg-green-50"
          aria-label={`Open ${notification.title}`}
        >
          {notification.imageUrl ? (
            <img
              src={notification.imageUrl}
              alt={notification.title}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl text-green-700">
              <FaSeedling />
            </span>
          )}
          {!notification.read && (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-green-700">
                {notification.icon}
                {notification.kicker}
              </p>
              <h2 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-gray-950">
                {notification.title}
              </h2>
            </div>
            <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-extrabold ${notification.statusClass}`}>
              {notification.statusLabel}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-gray-600">
            <span className="inline-flex min-w-0 items-center gap-1">
              <FaMapMarkerAlt className="shrink-0 text-green-700" />
              <span className="truncate">{notification.location}</span>
            </span>
            <span>{notification.quantity} Box Lot</span>
            <span className="inline-flex items-center gap-1">
              <FaClock className="text-green-700" />
              {notification.time}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 rounded-full bg-green-700 px-3 py-1.5 text-[10px] font-extrabold text-white hover:bg-green-800"
            >
              <FaEye />
              View Listing
            </button>
            {!notification.read && (
              <button
                type="button"
                onClick={onMarkRead}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-extrabold text-gray-700 hover:bg-gray-200"
              >
                <FaCheck />
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function NotificationSkeleton() {
  return (
    <section className="mt-4 space-y-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-lg border border-green-100 bg-white p-3">
          <div className="flex gap-3">
            <div className="h-20 w-24 rounded-md bg-green-50" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-24 rounded bg-green-50" />
              <div className="h-4 w-3/4 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function EmptyNotification({ filter }) {
  const filterLabel = filters.find((item) => item.key === filter)?.label || "notifications";

  return (
    <div className="mt-4 rounded-lg border border-dashed border-green-200 bg-green-50 px-4 py-6 text-center text-green-900">
      <FaRegBell className="mx-auto text-2xl" />
      <p className="mt-3 text-sm font-black">No {filterLabel.toLowerCase()} notifications yet.</p>
      <p className="mt-1 text-xs font-bold text-green-800">
        Fresh lot updates will appear here as growers list fruit for the marketplace.
      </p>
    </div>
  );
}

function buildLotNotification(lot, read) {
  const type = getNotificationType(lot.status);

  return {
    id: lot._id,
    read,
    type,
    title: lot.title || "Fresh fruit lot listed",
    location: lot.location || "Fruit Mandi",
    quantity: lot.quantity || 0,
    imageUrl: getImageUrl(lot),
    time: formatNotificationTime(lot.createdAt),
    kicker: getNotificationKicker(type),
    icon: getNotificationIcon(type),
    statusLabel: formatDealStatus(lot.status),
    statusClass: getStatusClass(type),
  };
}

function getNotificationType(status = "") {
  const normalized = String(status || "AVAILABLE").trim().toUpperCase();
  if (["IN_AUCTION", "ACTIVE", "AVAILABLE"].includes(normalized)) return "deal";
  if (["SCHEDULED", "UPCOMING"].includes(normalized)) return "upcoming";
  if (["SOLD", "ENDED", "CLOSED"].includes(normalized)) return "closed";
  return "deal";
}

function getNotificationKicker(type) {
  if (type === "upcoming") return "Scheduled lot";
  if (type === "closed") return "Deal update";
  return "New live lot";
}

function getNotificationIcon(type) {
  if (type === "closed") return <FaCheck />;
  if (type === "upcoming") return <FaClock />;
  return <FaGavel />;
}

function getStatusClass(type) {
  if (type === "closed") return "bg-gray-100 text-gray-700";
  if (type === "upcoming") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

function getImageUrl(product) {
  const gradeImage = Array.isArray(product.gradeLots)
    ? product.gradeLots.find((gradeLot) => gradeLot?.images?.[0])?.images?.[0]
    : "";
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : gradeImage;
  const normalizedImage = image ? image.replace(/\\/g, "/") : "";

  if (/^https?:\/\//i.test(normalizedImage)) return normalizedImage;
  return normalizedImage ? `${FILE_BASE_URL}/${normalizedImage}` : "";
}

function loadReadNotifications() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_NOTIFICATIONS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveReadNotifications(ids) {
  localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids)));
  window.dispatchEvent(new Event(NOTIFICATION_STATE_EVENT));
}

function formatNotificationTime(value) {
  if (!value) return "Just now";

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (Number.isFinite(diffMinutes) && diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDealStatus(status = "") {
  const normalized = String(status || "AVAILABLE").trim().toUpperCase();
  const labels = {
    IN_AUCTION: "Deal Open",
    ACTIVE: "Deal Open",
    AVAILABLE: "Available",
    SCHEDULED: "Upcoming Deal",
    UPCOMING: "Upcoming Deal",
    SOLD: "Deal Closed",
    ENDED: "Deal Closed",
  };
  return labels[normalized] || normalized.replace(/_/g, " ");
}
