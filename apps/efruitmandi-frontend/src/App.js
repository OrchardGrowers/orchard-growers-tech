import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, useEffect, useRef, useState } from "react";

import StartupSplash from "./components/StartupSplash";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import { lazyWithRecovery } from "./utils/chunkLoadRecovery";
import { hasAccessToken } from "./utils/auth";

// 🔹 Layout
const AppFeedback = lazyWithRecovery(() => import("./components/AppFeedback"));
const InstallAppPrompt = lazyWithRecovery(() => import("./components/InstallAppPrompt"));
const LotListingRoute = lazyWithRecovery(() => import("./components/LotListingRoute"));

// 🔹 Pages
const loadAuctions = () => import("./pages/Auctions");
const loadDelivery = () => import("./pages/Delivery");
const loadProfile = () => import("./pages/Profile");
const loadSearchResults = () => import("./pages/SearchResults");

const FruitLotsPage = lazyWithRecovery(() => import("./pages/FruitLotsPage"));
const NewsUpdatesPage = lazyWithRecovery(() => import("./pages/NewsUpdatesPage"));
const BlogPage = lazyWithRecovery(() => import("./pages/BlogPage"));
const MediaPage = lazyWithRecovery(() => import("./pages/MediaPage"));
const PressReleasePage = lazyWithRecovery(() => import("./pages/PressReleasePage"));
const Orders = lazyWithRecovery(() => import("./pages/Orders"));
const InvoicesChalan = lazyWithRecovery(() => import("./pages/InvoicesChalan"));
const Delivery = lazyWithRecovery(loadDelivery);
const Notifications = lazyWithRecovery(() => import("./pages/Notifications"));
const RegisterGrower = lazyWithRecovery(() => import("./pages/RegisterGrower"));
const RegisterBuyer = lazyWithRecovery(() => import("./pages/RegisterBuyer"));
const RegisterDriver = lazyWithRecovery(() => import("./pages/RegisterDriver"));
const ListNewLot = lazyWithRecovery(() => import("./pages/ListNewLot"));
const GetVerified = lazyWithRecovery(() => import("./pages/GetVerified"));
const Kyc = lazyWithRecovery(() => import("./pages/Kyc"));
const PolicyPage = lazyWithRecovery(() => import("./pages/PolicyPage"));
const GpsTracking = lazyWithRecovery(() => import("./pages/GpsTracking"));
const EscrowWorkflow = lazyWithRecovery(() => import("./pages/EscrowWorkflow"));
const QuotePrice = lazyWithRecovery(() => import("./pages/QuotePrice"));
const QuoteDetails = lazyWithRecovery(() => import("./pages/QuoteDetails"));
const RateGrower = lazyWithRecovery(() => import("./pages/RateGrower"));
const Auctions = lazyWithRecovery(loadAuctions);
const Payment = lazyWithRecovery(() => import("./pages/Payment"));
const Profile = lazyWithRecovery(loadProfile);
const ProfileDashboard = lazyWithRecovery(() => import("./pages/ProfileDashboard"));
const LotDetails = lazyWithRecovery(() => import("./pages/LotDetails"));
const SearchResults = lazyWithRecovery(loadSearchResults);
const FruitSeoPage = lazyWithRecovery(() => import("./pages/FruitSeoPage"));
const MobileCapture = lazyWithRecovery(() => import("./pages/MobileCapture"));
const MandiRates = lazyWithRecovery(() => import("./pages/MandiRates"));
const PublicBusinessProfile = lazyWithRecovery(() => import("./pages/PublicBusinessProfile"));
const PublicProfileDirectory = lazyWithRecovery(() => import("./pages/PublicProfileDirectory"));
const PublicProfileLocation = lazyWithRecovery(() => import("./pages/PublicProfileLocation"));
const PublicFruitDiscovery = lazyWithRecovery(() => import("./pages/PublicFruitDiscovery"));
const DownloadApp = lazyWithRecovery(() => import("./pages/DownloadApp"));

if (typeof window !== "undefined") {
  const priorityRouteLoaders = {
    "/auctions": loadAuctions,
    "/login": loadProfile,
    "/profile": loadProfile,
    "/search": loadSearchResults,
  };

  priorityRouteLoaders[window.location.pathname]?.().catch(() => undefined);
}

const scheduleDeferred = (callback, timeout = 1600) => {
  if (typeof window === "undefined") return () => {};
  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timerId = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(timerId);
};

function AnalyticsTracker() {
  const location = useLocation();
  const initializedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let cancel = () => {};
    let delayTimer;
    const loadAnalytics = () => {
      cancel = scheduleDeferred(() => {
        import("./services/analytics")
          .then(({ initAnalytics, trackPageView }) => {
            if (!active) return;
            if (!initializedRef.current) {
              initAnalytics();
              initializedRef.current = true;
            }
            trackPageView(location.pathname + location.search);
          })
          .catch(() => {
            if (import.meta.env.DEV) {
              console.warn("Optional analytics module could not be loaded.");
            }
          });
      });
    };
    const isMobileHome =
      location.pathname === "/" &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;

    if (isMobileHome) {
      delayTimer = window.setTimeout(loadAnalytics, 12000);
    } else {
      loadAnalytics();
    }

    return () => {
      active = false;
      if (delayTimer) window.clearTimeout(delayTimer);
      cancel();
    };
  }, [location]);

  return null;
}

function RouteFallback() {
  return <StartupSplash autoHide={false} />;
}

function AuthenticatedRoute({ children }) {
  const location = useLocation();

  if (!hasAccessToken()) {
    return (
      <Navigate
        to="/profile"
        replace
        state={{
          mode: "login",
          from: `${location.pathname}${location.search}${location.hash}`,
          message: "Please login to access the delivery workspace.",
        }}
      />
    );
  }

  return children;
}

function DeferredEnhancements() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = () => {};
    const isMobileHome =
      typeof window !== "undefined" &&
      window.location.pathname === "/" &&
      window.matchMedia("(max-width: 767px)").matches;
    const delay = isMobileHome ? 15000 : 3500;
    const timerId = window.setTimeout(() => {
      cancel = scheduleDeferred(() => setReady(true), 2500);
    }, delay);

    return () => {
      window.clearTimeout(timerId);
      cancel();
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <AppFeedback />
    </Suspense>
  );
}

function App() {
  return (
    <>
      <Suspense fallback={null}>
        <InstallAppPrompt />
      </Suspense>
      <DeferredEnhancements />
      <StartupSplash />
      <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AnalyticsTracker />
          <Suspense fallback={<RouteFallback />}>
            <Routes>

        {/* 🔹 Main Layout Wrapper */}
        <Route path="/" element={<MainLayout />}>

          {/* 🏠 Home */}
          <Route index element={<Home />} />

          {/* 📊 Dashboard */}
          <Route path="dashboard" element={<ProfileDashboard />} />

          {/* 🔥 Deals */}
          <Route path="auctions" element={<Auctions />} />
          <Route path="auctions/:lotId" element={<LotDetails />} />

          {/* 📦 Orders */}
          <Route path="orders" element={<Orders />} />
          <Route path="invoices-chalan" element={<InvoicesChalan />} />

          {/* 🚚 Delivery */}
          <Route
            path="delivery"
            element={(
              <AuthenticatedRoute>
                <Delivery />
              </AuthenticatedRoute>
            )}
          />

          {/* 💳 Payment */}
          <Route path="payment/:orderId" element={<Payment />} />
          <Route path="tracking/:orderId" element={<GpsTracking />} />
          <Route path="escrow/:orderId" element={<EscrowWorkflow />} />
          <Route path="login" element={<Profile />} />

            {/* 👤 Profile */}
            <Route path="profile" element={<Profile />} /> 

             {/* 👤 Profile Dashboard */}
            <Route path="profile-dashboard" element={<ProfileDashboard />} />

            {/* 🔔 Notifications */}
            <Route path="notifications" element={<Notifications />} />
            <Route path="/register-grower" element={<RegisterGrower />} />
            <Route path="/register-buyer" element={<RegisterBuyer />} />
            <Route path="/register-driver" element={<RegisterDriver />} />
            <Route
              path="/list-new-lot"
              element={(
                <LotListingRoute>
                  <ListNewLot />
                </LotListingRoute>
              )}
            />
            <Route path="/mobile-capture/:sessionId" element={<MobileCapture />} />
            <Route path="/download-app" element={<DownloadApp />} />
            <Route path="/get-verified" element={<GetVerified />} />
            <Route path="/kyc" element={<Kyc />} />
            <Route path="/kyc/status" element={<Kyc />} />
            <Route path="/profile/kyc" element={<Kyc />} />
            <Route path="/profiles/:businessType/:userId/records/:publicHistoryKey" element={<PublicBusinessProfile />} />
            <Route path="/profiles/:businessType/:userId" element={<PublicBusinessProfile />} />
            <Route path="/growers" element={<PublicProfileDirectory role="grower" />} />
            <Route path="/growers/state/:stateSlug" element={<PublicProfileLocation role="grower" />} />
            <Route path="/growers/state/:stateSlug/district/:districtSlug" element={<PublicProfileLocation role="grower" />} />
            <Route path="/growers/:slug/records/:publicHistoryKey" element={<PublicBusinessProfile publicBusinessType="grower" />} />
            <Route path="/growers/:slug" element={<PublicBusinessProfile publicBusinessType="grower" />} />
            <Route path="/buyers" element={<PublicProfileDirectory role="buyer" />} />
            <Route path="/buyers/state/:stateSlug" element={<PublicProfileLocation role="buyer" />} />
            <Route path="/buyers/state/:stateSlug/district/:districtSlug" element={<PublicProfileLocation role="buyer" />} />
            <Route path="/buyers/:slug/records/:publicHistoryKey" element={<PublicBusinessProfile publicBusinessType="buyer" />} />
            <Route path="/buyers/:slug" element={<PublicBusinessProfile publicBusinessType="buyer" />} />
            <Route path="/fruits" element={<PublicFruitDiscovery view="directory" />} />
            <Route path="/fruits/:fruitSlug/varieties/:varietySlug/growers" element={<PublicFruitDiscovery role="grower" />} />
            <Route path="/fruits/:fruitSlug/varieties/:varietySlug/buyers" element={<PublicFruitDiscovery role="buyer" />} />
            <Route path="/fruits/:fruitSlug/varieties/:varietySlug" element={<PublicFruitDiscovery />} />
            <Route path="/fruits/:fruitSlug/growers/state/:stateSlug/district/:districtSlug" element={<PublicFruitDiscovery role="grower" />} />
            <Route path="/fruits/:fruitSlug/growers/state/:stateSlug" element={<PublicFruitDiscovery role="grower" />} />
            <Route path="/fruits/:fruitSlug/buyers/state/:stateSlug/district/:districtSlug" element={<PublicFruitDiscovery role="buyer" />} />
            <Route path="/fruits/:fruitSlug/buyers/state/:stateSlug" element={<PublicFruitDiscovery role="buyer" />} />
            <Route path="/fruits/:fruitSlug/growers" element={<PublicFruitDiscovery role="grower" />} />
            <Route path="/fruits/:fruitSlug/buyers" element={<PublicFruitDiscovery role="buyer" />} />
            <Route path="/fruits/:fruitSlug" element={<PublicFruitDiscovery />} />
            <Route path="/about" element={<PolicyPage type="about" />} />
            <Route path="/our-story" element={<PolicyPage type="story" />} />
            <Route path="/vision-mission" element={<PolicyPage type="visionMission" />} />
            <Route path="/why-efruitmandi" element={<PolicyPage type="why" />} />
            <Route path="/contact" element={<PolicyPage type="contact" />} />
            <Route path="/contact-us" element={<PolicyPage type="contact" />} />
            <Route path="/faqs" element={<PolicyPage type="faqs" />} />
            <Route path="/privacy-policy" element={<PolicyPage type="privacy" />} />
            <Route path="/terms-of-service" element={<PolicyPage type="terms" />} />
            <Route path="/refund-cancellation-policy" element={<PolicyPage type="refund" />} />
            <Route path="/payment-escrow-policy" element={<PolicyPage type="payment" />} />
            <Route path="/kyc-verification-policy" element={<PolicyPage type="kyc" />} />
            <Route path="/og-verified-policy" element={<PolicyPage type="ogVerified" />} />
            <Route path="/commission-fee-policy" element={<PolicyPage type="commission" />} />
            <Route path="/shipping-logistics-policy" element={<PolicyPage type="logistics" />} />
            <Route path="/community-guidelines" element={<PolicyPage type="community" />} />
            <Route path="/buyer-guide" element={<PolicyPage type="buyerGuide" />} />
            <Route path="/grower-guide" element={<PolicyPage type="growerGuide" />} />
            <Route path="/logistics-partner-guide" element={<PolicyPage type="logisticsGuide" />} />
            <Route path="/fruit-grading-packing-guidelines" element={<PolicyPage type="grading" />} />
            <Route path="/report-problem" element={<PolicyPage type="report" />} />
            <Route path="/user-data-deletion" element={<PolicyPage type="deletion" />} />
            <Route path="/lots/:lotId" element={<LotDetails />} />
            <Route path="/lots/:lotId/quote" element={<QuotePrice />} />
            <Route path="/quotes/:quoteId" element={<QuoteDetails />} />
            <Route path="/lots/:lotId/rating" element={<RateGrower />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/mandi-rates" element={<MandiRates />} />
            <Route path="/mandi-rates/:commoditySlug" element={<MandiRates />} />
            <Route path="/fruit-lots/:fruitSlug" element={<FruitLotsPage />} />
            <Route path="/blog/fruit-buyers/:fruitSlug" element={<FruitSeoPage type="buyers" />} />
            <Route path="/blog/fruit-growers/:fruitSlug" element={<FruitSeoPage type="growers" />} />
            <Route path="/blog/market-price/:fruitSlug" element={<FruitSeoPage type="marketPrice" />} />
            <Route path="/blog/fruit-transport" element={<FruitSeoPage type="transport" />} />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/press-release" element={<PressReleasePage />} />
            <Route path="/news-updates" element={<NewsUpdatesPage />} />
            <Route path="/blog" element={<BlogPage />} />

        </Route>

            </Routes>
          </Suspense>
        </BrowserRouter>
    </>
  );
}

export default App;

