import { useNavigate } from "react-router-dom";
import BackHomeButton from "./BackHomeButton";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo-240.webp`;

const trustBadges = [
  {
    title: "Secure Buyer Payments",
    detail: "eFruitMandi Escrow Protected",
    mark: "SAFE",
    markClass: "text-[#18a64b]",
  },
  {
    title: "eFruitMandi Escrow Protected",
    detail: "Secure - Trusted - Transparent",
    mark: "✓",
    markClass: "text-[#18a64b]",
  },
  {
    title: "Orchard Growers",
    detail: "Trusted Growers and Buyers",
    logo: logoUrl,
    logoClass: "h-9 w-auto object-contain",
    mobileLogoClass: "h-5 w-auto object-contain lg:h-9",
  },
];

export default function AuthBrandShell({ children, compact = false }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[999] bg-[#18a64b] p-2 sm:p-3">
      <div className="grid h-full grid-rows-[minmax(150px,30vh)_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl sm:grid-rows-[minmax(180px,32vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_430px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="relative flex min-h-0 flex-col justify-center bg-[#18a64b] px-6 py-5 text-white sm:px-8 lg:px-8 lg:py-8 xl:px-12">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="absolute left-6 top-4 rounded-md p-1 sm:left-8 lg:left-8 lg:top-7"
            aria-label="Go to home"
          >
            <img src={logoUrl} alt="E-Fruit Mandi" width="240" height="160" className="h-8 w-auto sm:h-10 lg:h-16 xl:h-20" />
          </button>

          <div className="max-w-2xl pt-12 sm:pt-14 lg:pt-0">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] sm:text-[10px] lg:mb-6 lg:text-xs">
              INDIA'S FIRST
            </p>
            <h1 className="text-[19px] font-black leading-[1.08] sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl">
              Innovative, Trusted, and Authentic Fruit Trading Platform
            </h1>
            <p className="mt-2 max-w-xl text-[10px] font-medium leading-4 sm:text-xs lg:mt-5 lg:text-sm lg:leading-6 xl:text-base">
              Sell, Buy, Manage Horticulture Produce Payments and Logistics All at One place.
            </p>
            <div className="mt-3 grid max-w-xl grid-cols-3 gap-1.5 lg:mt-8 lg:gap-3">
              {trustBadges.map((item) => (
                <div
                  key={item.title}
                  className="rounded-md border border-white/15 bg-white/10 p-1.5 shadow-sm backdrop-blur lg:rounded-lg lg:p-3"
                >
                  <div className="flex h-5 items-center lg:h-10">
                    {item.logo ? (
                      <img
                        src={item.logo}
                        alt={item.title}
                        className={item.mobileLogoClass || item.logoClass}
                      />
                    ) : (
                      <span
                        className={`rounded-sm bg-white px-1 py-0.5 text-[7px] font-black lg:rounded-md lg:px-2 lg:py-1 lg:text-sm ${item.markClass}`}
                      >
                        {item.mark}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[8px] font-black leading-tight lg:mt-3 lg:text-sm">
                    {item.title}
                  </p>
                  <p className="hidden lg:mt-1 lg:block lg:text-xs lg:font-semibold lg:text-white/80">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="h-full min-h-0 overflow-y-auto bg-white px-5 py-3 sm:px-7 lg:px-6 lg:py-4">
          <div className="mb-3 flex justify-end">
            <BackHomeButton />
          </div>
          <div className={`mx-auto min-h-full w-full ${compact ? "max-w-[360px]" : "max-w-[390px]"} lg:flex lg:items-center`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
