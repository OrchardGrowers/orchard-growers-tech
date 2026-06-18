import SEO from "../components/SEO";
import { Link } from "react-router-dom";

const horticultureCards = [
  {
    title: "Apple Fruit Buyers",
    description:
      "Find apple buyers, traders, wholesalers and procurement opportunities for apple growers across India.",
    image:
      "https://res.cloudinary.com/doprdp6bi/image/upload/f_auto,q_auto,w_1200/v1781716974/noname_13-apple-2788616_lihydh.jpg",
    link: "/fruit-buyers/apple",
    buttonText: "Explore Apple Buyers",
  },
  {
    title: "Apple Growers Guide",
    description:
      "Explore apple farming, orchard management, grading, packing and marketing information for apple growers.",
    image:
      "https://res.cloudinary.com/doprdp6bi/image/upload/f_auto,q_auto,w_1200/v1781717271/alandsmann-harvest-7458975_g3knnc.jpg",
    link: "/fruit-growers/apple",
    buttonText: "Explore Grower Guide",
  },
  {
    title: "Apple Market Price & Trends",
    description:
      "Understand apple mandi trends, seasonal demand, market prices and price discovery for fruit trading.",
    image:
      "https://res.cloudinary.com/doprdp6bi/image/upload/f_auto,q_auto,w_1200/v1781717350/couleur-apple-1589869_qjsdfe.jpg",
    link: "/blog/market-price/apple",
    buttonText: "View Market Trends",
  },
  {
    title: "Fruit Transport & Logistics",
    description:
      "Learn about fruit transport, logistics planning, loading, dispatch and delivery support for fruit trade.",
    image:
      "https://res.cloudinary.com/doprdp6bi/image/upload/f_auto,q_auto,w_1200/v1781717511/mploscar-apple-1122537_nkygzs.jpg",
    link: "/fruit-transport",
    buttonText: "Explore Logistics",
  },
];
export default function BlogPage() {
  return (
    <>
      <SEO
        title="Horticulture Blog | Fruit Farming, Market Trends & Trading Guides | eFruitMandi"
        description="Read horticulture blogs, fruit farming guides, apple buyer resources, fruit market trends, grading, packing, logistics and digital fruit trading insights from eFruitMandi."
        keywords="horticulture blog, fruit farming blog India, apple buyers India, apple growers guide, apple market price, fruit logistics, fruit trading India, Horticulture Blog"
      />

      <div className="min-h-screen bg-[#eef3ef]">
        <section className="bg-gradient-to-br from-green-950 via-green-800 to-lime-700 px-4 py-16 text-white">
          <div className="mx-auto max-w-6xl">
            <p className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
              Horticulture Blog
            </p>

            <h1 className="max-w-5xl text-4xl font-extrabold leading-tight sm:text-5xl">
              Fruit Farming, Market Trends, Buyers & Trading Guides
            </h1>

            <p className="mt-6 max-w-4xl text-lg text-green-50">
              Expert insights on fruit farming, fruit buyers, market prices, grading, packing, logistics and digital fruit trading across India.
            </p>
          </div>
        </section>

        <main className="mx-auto max-w-5xl px-4 py-12">
          <section className="mb-12 grid gap-6 md:grid-cols-2">
            {horticultureCards.map((card) => (
              <article
                key={card.title}
                className="overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <img
                  src={card.image}
                  alt={card.title}
                  className="h-56 w-full object-cover"
                  loading="lazy"
                />

                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {card.title}
                  </h2>

                  <p className="mt-3 text-gray-700">{card.description}</p>

                  <Link
                    to={card.link}
                    className="mt-5 inline-flex rounded-full bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
                  >
                    {card.buttonText}
                  </Link>
                </div>
              </article>
            ))}
          </section>

          <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-10">
            <h2 className="text-3xl font-bold text-gray-900">
              Why India Needs a Digital Fruit Marketplace Like eFruitMandi
            </h2>

            <p className="mt-5 text-gray-700">
              India has one of the most diverse fruit economies in the world.
              From apple orchards in Himachal Pradesh, Jammu & Kashmir and
              Uttarakhand to mango belts in Maharashtra, Uttar Pradesh, Andhra
              Pradesh, Karnataka and Gujarat, every region has its own growing
              season, fruit quality, buyer network and mandi system. Fruits such
              as apple, mango, pear, plum, cherry, persimmon, peach,
              pomegranate, grapes, almond and many other categories move through
              a large chain of growers, traders, commission agents,
              transporters, wholesalers, retailers and exporters.
            </p>

            <p className="mt-4 text-gray-700">
              Even after years of hard work in orchards and farms, many growers
              still depend on limited local contacts for selling their produce.
              A grower may have good quality fruit, but if the right buyer does
              not know about that lot at the right time, the grower may not get
              the best possible opportunity. On the other side, buyers and
              traders also need reliable information about available fruit lots,
              quality, quantity, location and dispatch readiness. This gap
              between growers and buyers is exactly where a digital fruit
              marketplace becomes important.
            </p>

            <p className="mt-4 text-gray-700">
              eFruitMandi has been created by Orchard Growers Private Limited
              with the vision of building a practical digital platform for
              India’s fruit trade. The platform is not designed for only one
              fruit or one state. It is being developed for the complete fruit
              industry, including growers, orchard owners, buyers, traders,
              commission agents, exporters and logistics partners. The purpose
              is simple: before a grower goes to the mandi, the grower should be
              able to list fruit digitally, show basic details, attract serious
              buyers and understand market demand in a more organized way.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              The Real Problem in Traditional Fruit Selling
            </h2>

            <p className="mt-4 text-gray-700">
              Traditional mandis play an important role in Indian agriculture,
              and they will continue to remain important. However, the fruit
              trade has some practical challenges. Fruits are perishable. Timing
              matters. Quality matters. Packing matters. Transport matters. A
              delay of even one or two days can affect price, quality and buyer
              interest. In many regions, growers have to make selling decisions
              without full access to demand from other markets.
            </p>

            <p className="mt-4 text-gray-700">
              Many growers do not know which buyer is looking for which fruit
              category. Buyers may not know which village, valley, orchard belt
              or region currently has ready-to-dispatch lots. Growers often
              depend on phone calls, local agents, WhatsApp messages or personal
              networks. This system works for some people, but it does not
              provide equal access to every grower. Small and medium growers
              especially need better visibility.
            </p>

            <p className="mt-4 text-gray-700">
              eFruitMandi is being built to reduce this information gap. The
              platform allows growers to present their lot information digitally
              and allows buyers to discover fruit opportunities in a more
              structured way. This does not remove the importance of trust,
              local knowledge or physical inspection. Instead, it gives both
              sides better starting information so that they can communicate
              faster and make better decisions.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              eFruitMandi: A Platform for the Entire Fruit Economy
            </h2>

            <p className="mt-4 text-gray-700">
              eFruitMandi is not only for apple growers. Apple is important,
              especially in hilly regions, but India’s fruit economy is much
              larger. Mango, pear, plum, persimmon, cherry, peach, pomegranate,
              grapes, almond, citrus fruits and many other fruits have strong
              demand across different markets. A platform that wants to serve
              India must support multiple fruit categories and multiple growing
              regions.
            </p>

            <p className="mt-4 text-gray-700">
              This is why eFruitMandi is planned as an all-India digital fruit
              marketplace. A grower in Himachal Pradesh should be able to reach
              a buyer in Delhi, Chandigarh, Punjab, Haryana, Maharashtra or any
              other demand market. A mango buyer should be able to explore
              mango-producing regions. A trader looking for pear, plum or
              persimmon should be able to identify available lots. A logistics
              partner should be able to participate in the movement of goods
              from orchard to market.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              How Growers Can Benefit
            </h2>

            <p className="mt-4 text-gray-700">
              For growers, the biggest benefit is visibility. When a grower
              lists a fruit lot on eFruitMandi, the lot becomes digitally
              discoverable. The grower can mention fruit type, expected price,
              quantity, grade, packing status and main location. Full address
              privacy can be protected while still showing enough location
              information for buyers to understand the region.
            </p>

            <p className="mt-4 text-gray-700">
              Growers can use the platform before visiting the mandi. This gives
              them a chance to understand buyer interest, compare communication,
              and avoid depending only on one local route. Over time, digital
              records, verified profiles and transparent interactions can help
              serious growers build credibility.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              How Buyers and Traders Can Benefit
            </h2>

            <p className="mt-4 text-gray-700">
              Buyers need timely access to supply. In fruit trading, the right
              lot at the right time can make a major difference. eFruitMandi
              helps buyers discover fruit lots from different regions without
              depending only on scattered phone calls. Buyers can view available
              produce, connect with growers and make informed decisions based on
              listed details.
            </p>

            <p className="mt-4 text-gray-700">
              Traders, commission agents, wholesalers and exporters can use the
              platform as a discovery layer. It can help them find growers,
              understand fruit availability and build a more organized sourcing
              pipeline. For exporters and large buyers, verified profiles and
              quality-focused systems can become especially useful as the
              platform grows.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              Why Trust, KYC and OG Verified Matter
            </h2>

            <p className="mt-4 text-gray-700">
              Digital agriculture platforms cannot succeed only with listings.
              Trust is equally important. That is why eFruitMandi gives
              importance to KYC, profile visibility and OG Verified or Trusted
              Badge features. KYC helps create basic identity trust. OG Verified
              is planned as a separate trust and quality layer for serious
              participants who want stronger credibility.
            </p>

            <p className="mt-4 text-gray-700">
              The goal is not to expose private information unnecessarily. The
              goal is to show enough profile details to build confidence:
              company or orchard name, logo, role, main location and
              verification status. Buyers should be able to see grower
              credibility, and growers should also be able to understand buyer
              seriousness. This two-way trust is important for a healthy digital
              marketplace.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              Logistics: The Missing Link in Fruit Trade
            </h2>

            <p className="mt-4 text-gray-700">
              Fruit trade does not end when a buyer and grower connect. The
              fruit still has to move safely from orchard, collection point or
              packing location to the buyer’s destination. Transport cost,
              distance, labour, packing and timing all affect the final deal. A
              platform that supports fruit trading must also think about
              logistics.
            </p>

            <p className="mt-4 text-gray-700">
              eFruitMandi is being planned with logistics support in mind. This
              can help buyers, growers and drivers coordinate better. Clear
              logistics slabs, labour charges and dispatch details can reduce
              confusion. Over time, this can support a more predictable and
              organized fruit movement system.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              Orchard Growers Private Limited: The Vision Behind the Platform
            </h2>

            <p className="mt-4 text-gray-700">
              Orchard Growers Private Limited was created with a farmer-focused
              and orchard-focused vision. The company has worked around orchard
              management, natural and organic growing practices, plant care,
              grower support and practical agricultural solutions. eFruitMandi
              is a natural extension of this mission because market access is
              one of the most important needs of growers.
            </p>

            <p className="mt-4 text-gray-700">
              Producing good fruit is only one side of the story. Selling that
              fruit at the right time to the right buyer is equally important.
              Orchard Growers Private Limited believes that technology can help
              growers, but technology must remain practical, affordable and easy
              to use. eFruitMandi is being developed with that practical
              mindset.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              Future of Digital Fruit Trading in India
            </h2>

            <p className="mt-4 text-gray-700">
              The future of fruit trading will likely be hybrid. Physical
              mandis, local networks and traditional trade relationships will
              continue, but digital discovery, verified profiles, online
              listings, transparent quotation systems and logistics coordination
              will become more important. Growers who adopt digital tools early
              can gain better visibility, and buyers who use digital sourcing
              can discover more opportunities.
            </p>

            <p className="mt-4 text-gray-700">
              eFruitMandi aims to become a trusted digital layer for this
              transition. The platform is focused on the real needs of growers
              and buyers rather than only creating a technology product. Its
              success will depend on trust, regular listings, serious buyers,
              clear communication, quality control, logistics support and
              continuous improvement based on field feedback.
            </p>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              Topics We Will Cover on This Blog
            </h2>

            <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
              <li>
                How fruit growers can list lots before going to the mandi.
              </li>
              <li>
                How buyers can discover growers and fruit lots across India.
              </li>
              <li>
                Apple, mango, pear, plum, cherry, persimmon and other fruit
                market insights.
              </li>
              <li>Fruit grading, packing and dispatch education.</li>
              <li>KYC, OG Verified and trusted profile guidance.</li>
              <li>Digital mandi pricing and quotation education.</li>
              <li>Logistics planning for fruit transportation.</li>
              <li>Grower success stories and platform updates.</li>
              <li>
                Buyer guides for sourcing fresh fruit from growing regions.
              </li>
              <li>
                SEO-friendly fruit trade education for India’s digital
                agriculture future.
              </li>
            </ul>

            <h2 className="mt-10 text-2xl font-bold text-gray-900">
              Start With eFruitMandi
            </h2>

            <p className="mt-4 text-gray-700">
              If you are a fruit grower, orchard owner, buyer, trader,
              commission agent, exporter or logistics partner, eFruitMandi is
              being built for you. The platform is still evolving, but its
              direction is clear: create a digital bridge between
              fruit-producing regions and demand markets.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/register-grower"
                className="rounded-full bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900"
              >
                Register as Grower
              </Link>

              <Link
                to="/register-buyer"
                className="rounded-full bg-lime-100 px-6 py-3 font-semibold text-green-900 hover:bg-lime-200"
              >
                Register as Buyer
              </Link>

              <Link
                to="/media"
                className="rounded-full bg-gray-100 px-6 py-3 font-semibold text-gray-900 hover:bg-gray-200"
              >
                Visit Media Center
              </Link>
            </div>
          </article>
        </main>
      </div>
    </>
  );
}



