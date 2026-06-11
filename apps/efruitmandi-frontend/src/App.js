import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";

import StartupSplash from "./components/StartupSplash";
import AppFeedback from "./components/AppFeedback";
import InstallAppPrompt from "./components/InstallAppPrompt";

import { initAnalytics, trackPageView } from "./services/analytics";

// 🔹 Layout
import MainLayout from "./layouts/MainLayout";

// 🔹 Pages
import Home from "./pages/Home";

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
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
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

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
}

function RouteFallback() {
  return <StartupSplash autoHide={false} />;
}

function App() {
  return (
    <>
      <AppFeedback />
      <StartupSplash />
      <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AnalyticsTracker />
          <InstallAppPrompt />
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
            <Route path="/get-verified" element={<GetVerified />} />
            <Route path="/kyc" element={<Kyc />} />
            <Route path="/kyc/status" element={<Kyc />} />
            <Route path="/profile/kyc" element={<Kyc />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
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

        </Route>

            </Routes>
          </Suspense>
        </BrowserRouter>
    </>
  );
}

export default App;
