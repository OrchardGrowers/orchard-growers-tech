import { BrowserRouter, Routes, Route } from "react-router-dom";
import StartupSplash from "./components/StartupSplash";
import AppFeedback from "./components/AppFeedback";
import InstallAppPrompt from "./components/InstallAppPrompt";

// 🔹 Layout
import MainLayout from "./layouts/MainLayout";

// 🔹 Pages
import Home from "./pages/Home";
import Auctions from "./pages/Auctions";
import Orders from "./pages/Orders";
import InvoicesChalan from "./pages/InvoicesChalan";
import Delivery from "./pages/Delivery";
import Payment from "./pages/Payment";
import Profile from "./pages/Profile";
import ProfileDashboard from "./pages/ProfileDashboard";
import Notifications from "./pages/Notifications";
import RegisterGrower from "./pages/RegisterGrower";
import RegisterBuyer from "./pages/RegisterBuyer";
import RegisterDriver from "./pages/RegisterDriver";
import ListNewLot from "./pages/ListNewLot";
import LotDetails from "./pages/LotDetails";
import SearchResults from "./pages/SearchResults";
import GetVerified from "./pages/GetVerified";
import Kyc from "./pages/Kyc";
import TermsAndConditions from "./pages/TermsAndConditions";
import PolicyPage from "./pages/PolicyPage";
import GpsTracking from "./pages/GpsTracking";
import EscrowWorkflow from "./pages/EscrowWorkflow";
import QuotePrice from "./pages/QuotePrice";
import RateGrower from "./pages/RateGrower";

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppFeedback />
      <StartupSplash />
      <InstallAppPrompt />
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
            <Route path="/privacy-policy" element={<PolicyPage type="privacy" />} />
            <Route path="/terms-of-service" element={<PolicyPage type="terms" />} />
            <Route path="/user-data-deletion" element={<PolicyPage type="deletion" />} />
            <Route path="/lots/:lotId" element={<LotDetails />} />
            <Route path="/lots/:lotId/quote" element={<QuotePrice />} />
            <Route path="/lots/:lotId/rating" element={<RateGrower />} />
            <Route path="/search" element={<SearchResults />} />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
