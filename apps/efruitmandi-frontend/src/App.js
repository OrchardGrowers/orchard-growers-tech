import { useState } from "react";
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
import GpsTracking from "./pages/GpsTracking";
import EscrowWorkflow from "./pages/EscrowWorkflow";

const TESTING_MODE_SECURITY_CODE = "$543@2PAWann+OG:F$";
const TESTING_MODE_ACCESS_KEY = "efruitTestingModeAccess";

function App() {
  const [hasTestingAccess, setHasTestingAccess] = useState(() => localStorage.getItem(TESTING_MODE_ACCESS_KEY) === "granted");

  if (!hasTestingAccess) {
    return (
      <TestingModeGate
        storageKey={TESTING_MODE_ACCESS_KEY}
        onUnlock={() => setHasTestingAccess(true)}
      />
    );
  }

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
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/lots/:lotId" element={<LotDetails />} />
            <Route path="/search" element={<SearchResults />} />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}

function TestingModeGate({ storageKey, onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submitCode = (event) => {
    event.preventDefault();
    if (code === TESTING_MODE_SECURITY_CODE) {
      localStorage.setItem(storageKey, "granted");
      onUnlock();
      return;
    }
    setError("Invalid developers security code.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white/70 px-4 text-slate-950 backdrop-blur-sm">
      <form onSubmit={submitCode} className="w-full max-w-md text-center">
        <div className="relative mx-auto h-28 w-28 rounded-full border border-slate-400/50 bg-white/20 shadow-[0_0_40px_rgba(21,128,61,0.18)] backdrop-blur">
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-800" />
          <div className="absolute left-1/2 top-1/2 h-10 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rotate-0 rounded-full bg-green-800/80" />
          <div className="absolute left-1/2 top-1/2 h-8 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rotate-90 rounded-full bg-slate-800/70" />
        </div>
        <p className="mt-7 text-xl font-semibold text-slate-900">On testing Mode available shortely to public</p>
        <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="efruit-testing-code">
          Enter developers security code:
        </label>
        <input
          id="efruit-testing-code"
          type="password"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError("");
          }}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white/80 px-4 text-center text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" className="mt-5 h-11 w-full rounded-md bg-green-800 px-5 text-sm font-semibold text-white hover:bg-green-900">
          Unlock
        </button>
      </form>
    </main>
  );
}

export default App;
