import SEO from "../components/SEO";
import { Link } from "react-router-dom";

export default function NewsUpdatesPage() {
  return (
    <>
      <SEO
        title="News & Updates | eFruitMandi Fruit Market News India"
        description="Read eFruitMandi news, platform updates, fruit market insights, grower guidance, buyer announcements and digital fruit marketplace updates from India."
        keywords="eFruitMandi news, fruit market news India, digital fruit marketplace updates, fruit mandi news, Orchard Growers Private Limited news, grower updates, buyer updates, AgriTech news India"
      />

      <div className="min-h-screen bg-[#eef3ef]">
        <section className="bg-gradient-to-br from-green-950 via-green-800 to-lime-700 px-4 py-16 text-white">
          <div className="mx-auto max-w-6xl">
            <p className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
              News & Updates
            </p>

            <h1 className="max-w-5xl text-3xl font-extrabold leading-tight sm:text-5xl">
              Latest Updates from eFruitMandi and Orchard Growers
            </h1>

            <p className="mt-5 max-w-4xl text-base leading-7 text-green-50 sm:mt-6 sm:text-lg">
              Follow important announcements, platform improvements, fruit trade
              updates, grower guidance and buyer-focused news from India’s
              digital fruit marketplace.
            </p>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <p className="text-xs font-bold uppercase text-green-700">
                Platform Update
              </p>
              <h2 className="mt-3 text-xl font-bold text-gray-900">
                eFruitMandi Expands Digital Fruit Listing Experience
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                Growers can list fruit lots digitally and connect with buyers
                before visiting the mandi, helping improve visibility and market
                access.
              </p>
            </article>

            <article className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <p className="text-xs font-bold uppercase text-green-700">
                Grower Update
              </p>
              <h2 className="mt-3 text-xl font-bold text-gray-900">
                Focus on Multi-Fruit Marketplace Across India
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                eFruitMandi supports apple, mango, pear, plum, persimmon,
                cherry, peach, almond and other fruit categories for growers and
                buyers.
              </p>
            </article>

            <article className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <p className="text-xs font-bold uppercase text-green-700">
                Trust Update
              </p>
              <h2 className="mt-3 text-xl font-bold text-gray-900">
                KYC and OG Verified Build Safer Fruit Trade
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                Verified profiles help buyers and growers build confidence while
                protecting private details and showing only required business
                information.
              </p>
            </article>
          </div>

          <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              eFruitMandi News Desk
            </h2>

            <p className="mt-4 text-gray-700">
              eFruitMandi is being developed as a digital fruit marketplace by
              Orchard Growers Private Limited. The platform focuses on helping
              fruit growers, orchard owners, buyers, traders, commission agents,
              exporters and logistics partners connect through a more organized
              digital system.
            </p>

            <p className="mt-4 text-gray-700">
              This News & Updates page will publish platform announcements,
              feature releases, grower education, buyer guidance, logistics
              updates, trust and verification updates, and important fruit trade
              insights.
            </p>

            <p className="mt-4 text-gray-700">
              Our goal is to keep the fruit community informed about new tools,
              better selling practices, digital mandi participation, fair market
              access and India’s growing agri-commerce ecosystem.
            </p>
          </section>

          <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">
              What We Share in News & Updates
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-green-50 p-5">
                <h3 className="font-bold text-green-900">Platform Announcements</h3>
                <p className="mt-2 text-gray-700">
                  Updates about eFruitMandi features, user experience, grower tools,
                  buyer access, verification systems and digital fruit marketplace improvements.
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-5">
                <h3 className="font-bold text-green-900">Fruit Market Insights</h3>
                <p className="mt-2 text-gray-700">
                  Information related to fruit trade, mandi participation, seasonal fruit demand,
                  logistics coordination, grading, packing and market awareness.
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-5">
                <h3 className="font-bold text-green-900">Grower & Buyer Guidance</h3>
                <p className="mt-2 text-gray-700">
                  Practical updates for fruit growers, orchard owners, buyers, traders,
                  commission agents, exporters and logistics partners across India.
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-5">
                <h3 className="font-bold text-green-900">Company Updates</h3>
                <p className="mt-2 text-gray-700">
                  Official updates from Orchard Growers Private Limited, including
                  eFruitMandi development, media announcements and business milestones.
                </p>
              </div>
            </div>
          </section>
          <section className="mt-10 rounded-2xl bg-green-950 p-5 text-white shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-bold">
              Stay Connected with eFruitMandi
            </h2>
            <p className="mt-4 text-green-50">
              Register on eFruitMandi to list fruit lots, discover buyers,
              explore available produce and stay updated with India’s digital
              fruit marketplace.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                to="/register-grower"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 py-3 font-semibold text-green-900"
              >
                Register as Grower
              </Link>

              <Link
                to="/register-buyer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white px-6 py-3 font-semibold text-white"
              >
                Register as Buyer
              </Link>

              <Link
                to="/blog"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-lime-100 px-6 py-3 font-semibold text-green-950"
              >
                Read Blog
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

