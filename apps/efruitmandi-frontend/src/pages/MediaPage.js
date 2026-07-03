import SEO from "../components/SEO";
import { Link } from "react-router-dom";

export default function MediaPage() {
  return (
    <>
      <SEO
        title="Media Center | eFruitMandi Digital Fruit Marketplace"
        description="Official Media Center of eFruitMandi by Orchard Growers Private Limited. Company information, media resources, fruit market insights, press notes and platform updates."
        keywords="eFruitMandi Media Center, Orchard Growers Private Limited, Fruit Marketplace India, AgriTech Startup India, Digital Fruit Marketplace, Fruit Trading Platform India, Fruit Market News, Media Resources"
      />

      <div className="min-h-screen bg-[#eef3ef]">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900 via-green-700 to-lime-600 px-4 py-12 text-white shadow-lg sm:px-5 md:rounded-3xl md:px-10 md:py-20">
          <div className="absolute inset-0 hidden opacity-20 md:block">
            <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-yellow-300 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-52 w-52 rounded-full bg-white blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-300 blur-3xl" />
          </div>

          <div className="relative z-10 max-w-5xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-lime-100 sm:text-sm sm:tracking-[0.25em]">
              Media • Blogs • Fruit Market Technology
            </p>
            <h1 className="mb-5 text-3xl font-extrabold leading-tight md:text-6xl">
              Media and eFruitMandi Updates
            </h1>
            <p className="max-w-3xl text-base leading-7 text-green-50 md:text-xl md:leading-8">
              Stories, blogs, market insights, press notes and knowledge content
              from eFruitMandi — India’s digital fruit marketplace connecting
              growers, buyers, traders, commission agents and logistics partners.
            </p>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-4 py-10">
          <section className="mb-8 rounded-2xl bg-white p-4 shadow-sm sm:p-6 md:p-8">
            <h2 className="mb-4 text-2xl font-bold text-green-800 sm:text-3xl">
              About eFruitMandi Media
            </h2>
            <p className="mb-4 leading-7 text-gray-700 md:leading-8">
              eFruitMandi Media is the official information and knowledge section
              of eFruitMandi, a digital fruit marketplace initiative by Orchard
              Growers Private Limited. This section has been created to share
              updates, educational articles, fruit market explanations, buyer and
              grower guides, mandi-related information, press releases, platform
              announcements and practical knowledge for India’s fruit industry.
            </p>
            <p className="mb-4 leading-7 text-gray-700 md:leading-8">
              India’s fruit market is large, seasonal, fragmented and highly
              dependent on trust, timing, logistics, grading, communication and
              market access. Fruit growers often search for reliable buyers,
              traders and commission agents, while buyers search for quality
              produce, verified growers, transparent supply and better
              communication. eFruitMandi aims to bring these market participants
              closer through technology, verified profiles, fruit listings,
              offers, logistics coordination and useful market information.
            </p>
            <p className="leading-7 text-gray-700 md:leading-8">
              Through this media section, eFruitMandi will publish content related
              to fruit buyers, fruit commission agents, mandi bhav, fruit trading,
              APMC markets, fruit logistics, grading, packing, payment trust,
              KYC verification, OG Verified profiles and the changing role of
              technology in fruit marketing.
            </p>
          </section>

          <section className="mb-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-xl font-bold text-green-800">
                Media Updates
              </h3>
              <p className="leading-7 text-gray-700">
                Official announcements, platform updates, launch notes and
                important developments related to eFruitMandi and Orchard Growers
                Private Limited.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-xl font-bold text-green-800">
                Fruit Market Blogs
              </h3>
              <p className="leading-7 text-gray-700">
                Detailed articles explaining fruit buyers, commission agents,
                APMC markets, mandi bhav, fruit trading, direct selling and
                digital marketplace systems.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-xl font-bold text-green-800">
                Press Releases
              </h3>
              <p className="leading-7 text-gray-700">
                Press notes and public updates about new features, trusted
                verification, buyer onboarding, grower support and fruit market
                technology.
              </p>
            </div>
          </section>

          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-3xl font-bold text-green-800">
              Why Media and Knowledge Content Matters in Fruit Marketing
            </h2>
            <p className="mb-4 leading-8 text-gray-700">
              Fruit marketing is not only about buying and selling fruits. It is
              also about understanding demand, harvest timing, quality grading,
              packaging, transport cost, mandi price trends, buyer reliability,
              payment security and market communication. Many growers still
              depend on limited local contacts, while many buyers depend on
              traditional networks and market intermediaries. This creates a gap
              between production and demand.
            </p>
            <p className="mb-4 leading-8 text-gray-700">
              eFruitMandi Media will work as a knowledge bridge for this gap.
              Growers can learn how to present their produce professionally,
              buyers can understand how to discover fruit lots, and commission
              agents can understand how digital visibility can help them reach
              more growers and traders. The purpose is not to replace existing
              fruit markets, but to improve discovery, communication and trust.
            </p>
            <p className="leading-8 text-gray-700">
              Articles published here will also help users understand common
              market terms such as fruit buyer, fruit trader, fruit commission
              agent, APMC market, mandi bhav, lot listing, offer, fruit
              grading, packing standards, logistics partner, KYC verification and
              trusted badge. This makes the platform useful not only for
              transactions but also for education and decision-making.
            </p>
          </section>

          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-3xl font-bold text-green-800">
              Topics Covered by eFruitMandi Media
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <ul className="space-y-3 leading-7 text-gray-700">
                <li>• Fruit buyers in India</li>
                <li>• Fruit and vegetable commission agents</li>
                <li>• APMC markets and fruit mandi systems</li>
                <li>• Mandi bhav and fruit price information</li>
                <li>• Apple, mango, pear, plum and persimmon markets</li>
                <li>• Direct grower-to-buyer communication</li>
              </ul>

              <ul className="space-y-3 leading-7 text-gray-700">
                <li>• Fruit grading and packing guidelines</li>
                <li>• Fruit logistics and transportation</li>
                <li>• KYC verification and trust building</li>
                <li>• OG Verified and trusted fruit profiles</li>
                <li>• Digital marketplace education</li>
                <li>• Press releases and platform announcements</li>
              </ul>
            </div>
          </section>

          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-3xl font-bold text-green-800">
              eFruitMandi and India’s Digital Fruit Marketplace Vision
            </h2>
            <p className="mb-4 leading-8 text-gray-700">
              eFruitMandi is being developed as a digital marketplace focused on
              India’s fruit industry. The platform is designed for fruit growers,
              orchard owners, buyers, traders, commission agents, exporters,
              logistics partners and other participants of the fruit supply
              chain. The goal is to make fruit marketing more transparent,
              searchable, organised and accessible.
            </p>
            <p className="mb-4 leading-8 text-gray-700">
              Traditional fruit trade has its own strength. Mandis, commission
              agents, buyers and traders have built networks over many years.
              However, new challenges are also increasing. Growers want better
              buyer discovery, buyers want reliable produce information, and
              everyone wants timely communication. Digital platforms can support
              this process by making market information easier to access.
            </p>
            <p className="leading-8 text-gray-700">
              eFruitMandi Media will help explain this transition. It will cover
              both traditional market concepts and modern fruit technology
              systems. This includes blogs on how fruit lots are listed, how
              offers work, why KYC matters, how fruit grading improves buyer
              confidence, how logistics affects net price, and how online
              visibility can help growers and market participants.
            </p>
          </section>

          <section className="mb-8 rounded-2xl bg-green-50 p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-3xl font-bold text-green-900">
              Featured Content Areas
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl bg-white p-5">
                <h3 className="mb-2 text-xl font-semibold text-green-800">
                  Fruit Buyers and Traders
                </h3>
                <p className="leading-7 text-gray-700">
                  Content explaining how growers can find fruit buyers, how
                  buyers source fruit lots, and how traders participate in fruit
                  markets across India.
                </p>
              </div>

              <div className="rounded-xl bg-white p-5">
                <h3 className="mb-2 text-xl font-semibold text-green-800">
                  Commission Agents and APMC Markets
                </h3>
                <p className="leading-7 text-gray-700">
                  Guides explaining the role of commission agents, mandi
                  communication, APMC market structure and fruit trading
                  terminology.
                </p>
              </div>

              <div className="rounded-xl bg-white p-5">
                <h3 className="mb-2 text-xl font-semibold text-green-800">
                  Mandi Bhav and Price Awareness
                </h3>
                <p className="leading-7 text-gray-700">
                  Educational content about mandi bhav, seasonal fruit pricing,
                  demand-supply movement and factors that influence fruit rates.
                </p>
              </div>

              <div className="rounded-xl bg-white p-5">
                <h3 className="mb-2 text-xl font-semibold text-green-800">
                  Fruit Logistics and Packing
                </h3>
                <p className="leading-7 text-gray-700">
                  Articles on packing, grading, transport planning, loading,
                  delivery coordination and quality preservation during movement.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-3xl font-bold text-green-800">
              For Journalists, Bloggers and Industry Partners
            </h2>
            <p className="mb-4 leading-8 text-gray-700">
              eFruitMandi welcomes media professionals, agriculture writers,
              fruit industry bloggers, startup ecosystem observers and market
              stakeholders who want to understand how digital tools can support
              India’s fruit supply chain. This media section will gradually
              include press releases, company background, platform milestones,
              founder notes, product updates and market education resources.
            </p>
            <p className="leading-8 text-gray-700">
              Media queries, partnership communication and public information
              requests related to eFruitMandi and Orchard Growers Private Limited
              can be directed through the contact page. As the platform grows,
              more structured media resources, downloadable company information
              and official press material may be added.
            </p>
          </section>

          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-3xl font-bold text-green-800">
              Frequently Asked Questions
            </h2>

            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900">
                  What is eFruitMandi Media?
                </h3>
                <p className="leading-7 text-gray-700">
                  eFruitMandi Media is the information section of eFruitMandi
                  where users can read blogs, fruit market updates, platform
                  announcements, press notes and educational content.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">
                  What type of blogs will be published here?
                </h3>
                <p className="leading-7 text-gray-700">
                  Blogs may cover fruit buyers, commission agents, mandi bhav,
                  APMC markets, fruit trading, grading, packing, logistics,
                  verified profiles and digital fruit marketplace education.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">
                  Is this page useful for fruit growers?
                </h3>
                <p className="leading-7 text-gray-700">
                  Yes. Growers can use this section to understand fruit selling,
                  buyer discovery, market terms, price awareness and digital
                  listing practices.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">
                  Is this page useful for commission agents and buyers?
                </h3>
                <p className="leading-7 text-gray-700">
                  Yes. Buyers, traders and commission agents can use eFruitMandi
                  Media to understand digital visibility, grower communication,
                  market discovery and platform updates.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-green-800 p-4 text-white shadow-sm sm:p-6 md:p-8">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">
              Explore eFruitMandi Resources
            </h2>
            <p className="mb-5 max-w-3xl leading-8 text-green-50">
              Learn more about eFruitMandi, buyer registration, grower support,
              verification, policies and fruit market education.
            </p>

            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link to="/about" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 py-2 text-green-800">
                About eFruitMandi
              </Link>
              <Link to="/buyer-guide" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 py-2 text-green-800">
                Buyer Guide
              </Link>
              <Link to="/grower-guide" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 py-2 text-green-800">
                Grower Guide
              </Link>
              <Link to="/contact" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 py-2 text-green-800">
                Contact
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
