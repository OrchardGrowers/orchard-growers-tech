import React from "react";
import { Helmet } from "react-helmet-async";
import {
  APP_BUILD_ID,
  attemptChunkLoadRecovery,
} from "../utils/chunkLoadRecovery";

const HOME_TITLE = "eFruitMandi - Fruit Buyers & Growers Marketplace in India";
const HOME_DESCRIPTION =
  "Connect directly with verified fruit growers, buyers, commission agents, wholesalers, exporters and logistics partners across India.";
const HOME_CANONICAL = "https://www.efruitmandi.live/";
const HOME_IMAGE = "https://www.efruitmandi.live/og-efruitmandi.jpg";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.hasLoggedError = false;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (attemptChunkLoadRecovery(error)) return;
    if (this.hasLoggedError) return;
    this.hasLoggedError = true;

    if (import.meta.env.DEV) {
      console.error("eFruitMandi route render failed", error, info);
    } else {
      console.warn(`eFruitMandi render failure (build ${APP_BUILD_ID})`);
    }
  }

  render() {
    if (this.state.error) {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
      const isHome = pathname === "/";

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#eef3ef] px-4">
          {isHome && (
            <Helmet>
              <title>{HOME_TITLE}</title>
              <meta name="description" content={HOME_DESCRIPTION} />
              <link rel="canonical" href={HOME_CANONICAL} />
              <meta name="robots" content="index,follow" />
              <meta property="og:site_name" content="eFruitMandi" />
              <meta property="og:type" content="website" />
              <meta property="og:title" content={HOME_TITLE} />
              <meta property="og:description" content={HOME_DESCRIPTION} />
              <meta property="og:url" content={HOME_CANONICAL} />
              <meta property="og:image" content={HOME_IMAGE} />
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content={HOME_TITLE} />
              <meta name="twitter:description" content={HOME_DESCRIPTION} />
              <meta name="twitter:image" content={HOME_IMAGE} />
            </Helmet>
          )}
          <section className="w-full max-w-md rounded-md border border-green-100 bg-white p-5 text-center shadow-sm">
            <h1 className="text-lg font-black text-gray-950">
              {isHome ? "eFruitMandi Marketplace" : "Page could not load"}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-600">
              {isHome
                ? "Live Deals, Active Deals, Completed Deals, Fruit Lots, Buy Lots, Sell Lots, and Marketplace updates are available after refresh."
                : "Please refresh the page. If this continues, return home and try again."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-extrabold text-white"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="rounded-md bg-green-50 px-4 py-2 text-sm font-extrabold text-green-800"
              >
                Home
              </button>
            </div>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
