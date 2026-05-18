import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";

export default function MainLayout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="flex min-h-screen flex-col bg-[#eef3ef]">
      <Navbar />
      <main className={`flex-1 ${isHome ? "pt-[106px] md:pt-[74px]" : "pt-[64px]"} px-3 md:px-4`}>
        <Outlet />
      </main>
      <footer className="px-3 pb-[104px] pt-4 text-center text-xs font-semibold text-gray-600 md:pb-6">
        (c) All rights reserved by Orchard Growers Pvt. Ltd.
      </footer>
      <BottomNav />
    </div>
  );
}
