import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";

export default function MainLayout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="flex min-h-screen flex-col bg-[#eef3ef]">
      <Navbar />
      <main className={`flex-1 ${isHome ? "pt-[54px] md:pt-[74px]" : "pt-[64px]"} px-3 md:px-4`}>
        <Outlet />
      </main>
      <footer className="pb-[104px] md:pb-6" />
      <BottomNav />
    </div>
  );
}
