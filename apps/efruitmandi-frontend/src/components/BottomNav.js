import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaChartLine, FaHandshake, FaHome, FaTruck, FaUser } from "react-icons/fa";
import { getCurrentUser, hasAccessToken, logoutUser } from "../utils/auth";

const ProfileAccountMenu = lazy(() => import("./ProfileAccountMenu"));

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasUser = hasAccessToken();
  const profileMenuRef = useRef(null);
  const currentUser = getCurrentUser();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    setProfileMenuOpen(false);
    setSelectedItem("");
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const navItems = [
    { path: "/", icon: <FaHome />, label: "Home" },
    { path: "/profile-dashboard", icon: <FaChartLine />, label: "Profile Dashboard" },
    { path: "/auctions", icon: <FaHandshake />, label: "Live Fruit Lots", isLiveLots: true },
    ...(hasUser ? [{ path: "/delivery", icon: <FaTruck />, label: "Delivery" }] : []),
    {
      path: hasUser ? "/profile-dashboard" : "/profile",
      icon: <FaUser />,
      label: "Profile",
      isProfile: true,
    },
  ];

  const openProfileAction = (path) => {
    setProfileMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[100vw] overflow-x-hidden border-t border-green-800 bg-green-700 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 md:hidden">
      <nav className="mx-auto flex w-full max-w-md items-center justify-around px-2">
        {navItems.map((item, i) => {
          const isActive =
            selectedItem === item.label ||
            (!selectedItem && location.pathname === item.path && !(profileMenuOpen && item.path === "/"));
          const baseClass = `relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-green-700 shadow-sm transition ${
            isActive ? "scale-105 ring-2 ring-yellow-400" : ""
          }`;

          if (item.isProfile && hasUser) {
            return (
              <div key={item.label} ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Profile menu"
                  aria-expanded={profileMenuOpen}
                  onClick={() => {
                    setSelectedItem(item.label);
                    setProfileMenuOpen((open) => !open);
                  }}
                  className={`${baseClass} ${profileMenuOpen ? "scale-105 ring-2 ring-yellow-400" : ""}`}
                >
                  {item.icon}
                </button>

                {profileMenuOpen && (
                  <Suspense fallback={null}>
                    <ProfileAccountMenu
                      user={currentUser}
                      onAction={openProfileAction}
                      onLogout={logoutUser}
                      mobile
                    />
                  </Suspense>
                )}
              </div>
            );
          }

          return (
            <Link
              key={i}
              to={item.path}
              aria-label={item.label}
              onClick={() => setSelectedItem(item.label)}
            >
              <div className={baseClass}>
                <span>{item.icon}</span>
                {item.isLiveLots && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold leading-none text-white">
                    Rs
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
