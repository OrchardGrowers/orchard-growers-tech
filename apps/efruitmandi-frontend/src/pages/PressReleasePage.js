import SEO from "../components/SEO";
import { Link } from "react-router-dom";

export default function PressReleasePage() {
  return (
    <>
      <SEO
        title="Press Release | eFruitMandi by Orchard Growers Private Limited"
        description="Read the official press release of eFruitMandi, India's digital fruit marketplace by Orchard Growers Private Limited, built for fruit growers, buyers, traders and logistics partners."
        keywords="eFruitMandi press release, Orchard Growers press release, digital fruit marketplace India, fruit mandi platform, fruit growers India, fruit buyers, agri tech startup India"
      />

      <div className="min-h-screen bg-[#eef3ef]">
        <section className="relative overflow-hidden bg-gradient-to-br from-green-950 via-green-800 to-lime-700 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
              Official Press Release
            </p>

            <h1 className="max-w-4xl text-3xl font-extrabold leading-tight sm:text-5xl">
              eFruitMandi Launches as India’s Digital Fruit Marketplace to
              Connect Growers, Buyers, Traders and Logistics Partners
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-7 text-green-50 sm:mt-6 sm:text-lg">
              Orchard Growers Private Limited introduces eFruitMandi, a
              technology-driven platform created to make fruit trading more
              transparent, accessible and organized for India’s fruit economy.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                to="/register-grower"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 py-3 font-semibold text-green-900 shadow-lg transition hover:bg-green-50"
              >
                Register as Grower
              </Link>

              <Link
                to="/register-buyer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/70 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Register as Buyer
              </Link>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <article className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
              For Immediate Release
            </p>

            <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
              Orchard Growers Private Limited Announces eFruitMandi, a Digital
              Platform for India’s Fruit Trade
            </h2>

            <p className="mt-3 text-gray-500">
              Mandi, Himachal Pradesh, India — Orchard Growers Private Limited
              has announced eFruitMandi, a digital fruit marketplace designed to
              support fruit growers, orchard owners, buyers, traders,
              commission agents, exporters and logistics partners across India.
            </p>

            <div className="prose prose-green mt-8 max-w-none text-gray-700">
              <p>
                India’s fruit sector is one of the most important parts of the
                agricultural economy. From apples, mangoes, pears, plums,
                cherries and persimmons to pomegranates, grapes, almonds and
                other fruit categories, growers across the country work for
                months to produce quality harvests. However, many growers still
                face challenges such as limited buyer access, unclear price
                discovery, dependence on local market networks, delayed
                communication and lack of transparent digital trade records.
              </p>

              <p>
                eFruitMandi has been created to address these challenges by
                bringing fruit listings, buyer discovery, grower profiles,
                offer flow, logistics coordination and trust-based
                verification into one digital ecosystem. The platform is focused
                on making fruit trading simpler, faster and more transparent
                while keeping the practical needs of Indian growers and buyers
                at the center.
              </p>

              <p>
                Through eFruitMandi, fruit growers can list available produce
                before going to the physical mandi, share basic details of their
                lot, highlight fruit category, grade, quantity, location and
                expected price, and reach potential buyers beyond their local
                circle. Buyers, traders and commission agents can discover
                available fruit lots, compare opportunities, contact growers and
                participate in a more organized digital purchase process.
              </p>

              <p>
                The platform is not limited to one fruit or one state.
                eFruitMandi has been planned as an all-India fruit marketplace
                where growers from different fruit-producing regions and buyers
                from high-demand markets can connect digitally. The focus is on
                the entire fruit economy, including fresh fruits, orchard
                produce and related trade services.
              </p>

              <blockquote>
                “Our goal is to give fruit growers better digital access to
                buyers and to help buyers discover quality produce directly from
                growing regions. eFruitMandi is being built as a practical,
                trust-based and scalable platform for India’s fruit market,”
                said Pawan Kumar, Founder and Executive Director of Orchard
                Growers Private Limited.
              </blockquote>

              <p>
                The platform also includes the vision of trusted participation
                through KYC, grower and buyer profile visibility, OG Verified
                identity, transparent communication and future logistics support.
                eFruitMandi aims to support a more reliable trade environment
                where both sides can make informed decisions.
              </p>

              <p>
                Orchard Growers Private Limited believes that digital platforms
                can play an important role in improving agricultural market
                access. With increasing smartphone adoption, better internet
                connectivity and growing interest in direct digital trade,
                eFruitMandi is positioned to support the next phase of fruit
                commerce in India.
              </p>
            </div>
          </article>

          <section className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">
                For Growers
              </h3>
              <p className="mt-3 text-gray-600">
                List fruit lots, show main location, connect with buyers and
                explore better market opportunities before visiting the mandi.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">
                For Buyers
              </h3>
              <p className="mt-3 text-gray-600">
                Discover available fruit lots, connect with growers and source
                produce from different fruit-growing regions of India.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">
                For Logistics
              </h3>
              <p className="mt-3 text-gray-600">
                Future-ready logistics coordination to support movement of fruit
                produce from growing regions to demand markets.
              </p>
            </div>
          </section>

          <section className="mt-10 rounded-2xl bg-green-950 p-5 text-white shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-bold">About eFruitMandi</h2>
            <p className="mt-4 text-green-50">
              eFruitMandi is a digital fruit marketplace by Orchard Growers
              Private Limited. The platform is designed for fruit growers,
              buyers, traders, commission agents, exporters and logistics
              partners. Its purpose is to make fruit trading more transparent,
              organized and accessible through digital technology.
            </p>
          </section>

          <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">
              About Orchard Growers Private Limited
            </h2>
            <p className="mt-4 text-gray-700">
              Orchard Growers Private Limited is an agri-focused company based
              in Himachal Pradesh. The company works with the vision of
              supporting growers through orchard management, digital market
              access, practical agricultural solutions and environment-friendly
              initiatives.
            </p>
          </section>

          <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Media Contact
            </h2>

            <div className="mt-4 space-y-2 text-gray-700">
              <p>
                <strong>Company:</strong> Orchard Growers Private Limited
              </p>
              <p>
                <strong>Platform:</strong> eFruitMandi
              </p>
              <p>
                <strong>CIN:</strong> U01100HP2022PTC009319
              </p>
              <p>
                <strong>Startup India:</strong> Recognized Startup
              </p>
              <p>
                <strong>MSME:</strong> Registered Enterprise
              </p>
              <p>
                <strong>Founder & Executive Director:</strong> Pawan Kumar
              </p>
              <p>
                <strong>Website:</strong>{" "}
                <a
                  href="https://www.efruitmandi.live"
                  className="font-semibold text-green-700 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  www.efruitmandi.live
                </a>
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:info@orchardgrowers.in"
                  className="font-semibold text-green-700 hover:underline"
                >
                  info@orchardgrowers.in
                </a>
              </p>
              <p>
                <strong>Location:</strong> Himachal Pradesh, India
              </p>
            </div>
          </section>

          <section className="mt-10 rounded-2xl bg-gradient-to-br from-lime-100 to-green-100 p-5 text-center shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-2xl font-extrabold text-green-950 sm:text-3xl">
              Join India’s Digital Fruit Marketplace
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-700">
              Whether you are a fruit grower, buyer, trader or logistics
              partner, eFruitMandi is built to support a more connected fruit
              trade ecosystem.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                to="/register-grower"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-green-800 px-6 py-3 font-semibold text-white transition hover:bg-green-900"
              >
                Start as Grower
              </Link>

              <Link
                to="/register-buyer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 py-3 font-semibold text-green-900 shadow-sm transition hover:bg-green-50"
              >
                Start as Buyer
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}


