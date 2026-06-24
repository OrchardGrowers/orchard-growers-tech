import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import StartupSplash from "./components/StartupSplash";

// 🔹 Layout
const MainLayout = lazy(() => import("./layouts/MainLayout"));
const AppFeedback = lazy(() => import("./components/AppFeedback"));
const InstallAppPrompt = lazy(() => import("./components/InstallAppPrompt"));

// 🔹 Pages
const Home = lazy(() => import("./pages/Home"));
const FruitLotsPage = lazy(() => import("./pages/FruitLotsPage"));
const NewsUpdatesPage = lazy(() => import("./pages/NewsUpdatesPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const MediaPage = lazy(() => import("./pages/MediaPage"));
const PressReleasePage = lazy(() => import("./pages/PressReleasePage"));
const Orders = lazy(() => import("./pages/Orders"));
const InvoicesChalan = lazy(() => import("./pages/InvoicesChalan"));
const Delivery = lazy(() => import("./pages/Delivery"));
const Notifications = lazy(() => import("./pages/Notifications"));
const RegisterGrower = lazy(() => import("./pages/RegisterGrower"));
const RegisterBuyer = lazy(() => import("./pages/RegisterBuyer"));
const RegisterDriver = lazy(() => import("./pages/RegisterDriver"));
const ListNewLot = lazy(() => import("./pages/ListNewLot"));
const GetVerified = lazy(() => import("./pages/GetVerified"));
const Kyc = lazy(() => import("./pages/Kyc"));
const PolicyPage = lazy(() => import("./pages/PolicyPage"));
const GpsTracking = lazy(() => import("./pages/GpsTracking"));
const EscrowWorkflow = lazy(() => import("./pages/EscrowWorkflow"));
const QuotePrice = lazy(() => import("./pages/QuotePrice"));
const QuoteDetails = lazy(() => import("./pages/QuoteDetails"));
const RateGrower = lazy(() => import("./pages/RateGrower"));
const Auctions = lazy(() => import("./pages/Auctions"));
const Payment = lazy(() => import("./pages/Payment"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileDashboard = lazy(() => import("./pages/ProfileDashboard"));
const LotDetails = lazy(() => import("./pages/LotDetails"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const FruitSeoPage = lazy(() => import("./pages/FruitSeoPage"));
const MobileCapture = lazy(() => import("./pages/MobileCapture"));
const MandiRates = lazy(() => import("./pages/MandiRates"));

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
    const cancel = scheduleDeferred(() => {
      import("./services/analytics")
        .then(({ initAnalytics, trackPageView }) => {
          if (!active) return;
          if (!initializedRef.current) {
            initAnalytics();
            initializedRef.current = true;
          }
          trackPageView(location.pathname + location.search);
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      cancel();
    };
  }, [location]);

  return null;
}

function RouteFallback() {
  return <StartupSplash autoHide={false} />;
}

function DeferredEnhancements() {
  const [ready, setReady] = useState(false);

  useEffect(() => scheduleDeferred(() => setReady(true), 3500), []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <AppFeedback />
      <InstallAppPrompt />
    </Suspense>
  );
}

function App() {
  return (
    <>
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
          <Route path="delivery" element={<Delivery />} />

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
            <Route path="/list-new-lot" element={<ListNewLot />} />
            <Route path="/mobile-capture/:sessionId" element={<MobileCapture />} />
            <Route path="/get-verified" element={<GetVerified />} />
            <Route path="/kyc" element={<Kyc />} />
            <Route path="/kyc/status" element={<Kyc />} />
            <Route path="/profile/kyc" element={<Kyc />} />
            <Route path="/about" element={<PolicyPage type="about" />} />
            <Route path="/our-story" element={<PolicyPage type="story" />} />
            <Route path="/vision-mission" element={<PolicyPage type="visionMission" />} />
            <Route path="/why-efruitmandi" element={<PolicyPage type="why" />} />
            <Route path="/contact" element={<PolicyPage type="contact" />} />
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

