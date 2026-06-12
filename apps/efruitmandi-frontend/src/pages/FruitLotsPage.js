import { Link, useParams } from "react-router-dom";
import SEO from "../components/SEO";
import { fruitLotsContent } from "../data/fruitLotsContent";

export default function FruitLotsPage() {
  const { fruitSlug } = useParams();
  const fruit = fruitLotsContent[fruitSlug];

  if (!fruit) {
    return (
      <>
        <SEO
          title="Fruit Lot Category Not Found | eFruitMandi"
          description="The requested fruit lot category could not be found on eFruitMandi."
          canonical={`/fruit-lots/${fruitSlug || ""}`}
          noIndex
        />

        <main className="w-full max-w-full overflow-x-hidden pb-[calc(140px+env(safe-area-inset-bottom))]">
          <section className="section rounded-md bg-white p-4">
            <h1 className="text-xl font-extrabold text-green-900">
              Fruit Lot Category Not Found
            </h1>

            <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-700">
              This fruit category is not available yet. You can explore live
              fruit lots or list a new fruit lot on eFruitMandi.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/auctions"
                className="rounded-full bg-green-700 px-4 py-2 text-sm font-extrabold text-white"
              >
                View Live Fruit Lots
              </Link>

              <Link
                to="/list-new-lot"
                className="rounded-full bg-green-50 px-4 py-2 text-sm font-extrabold text-green-800 ring-1 ring-green-200"
              >
                List a Fruit Lot
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How can I sell ${fruit.name} fruit lots online?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Growers can list ${fruit.name} fruit lots on eFruitMandi with Fruit Lot No., Lot Size, grade, total boxes, packing details, orchard location and fruit images.`,
        },
      },
      {
        "@type": "Question",
        name: `Can buyers request quotations for ${fruit.name} lots?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. Buyers can explore available ${fruit.name} fruit lots and request quotations according to eFruitMandi platform rules.`,
        },
      },
      {
        "@type": "Question",
        name: `What details should be added in a ${fruit.name} lot listing?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `A ${fruit.name} fruit lot listing should include Fruit Lot No., Lot Size, variety, grade, total boxes, average box weight, harvest date, packing details and location.`,
        },
      },
      {
        "@type": "Question",
        name: `Is Fruit Lot No. different from batch number?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. Fruit Lot No. is a fresh produce trading term used to identify a packed fruit lot. It works like batch number in manufacturing, but is more suitable for growers, buyers and fruit trading.`,
        },
      },
    ],
  };

  return (
    <>
      <SEO
        title={fruit.title}
        description={fruit.description}
        canonical={`/fruit-lots/${fruitSlug}`}
        schema={faqSchema}
      />

      <main className="w-full max-w-full overflow-x-hidden pb-[calc(140px+env(safe-area-inset-bottom))]">
        <section className="section rounded-md bg-white p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">
            Fruit Lots
          </p>

          <h1 className="mt-2 text-xl font-extrabold text-green-900">
            {fruit.h1}
          </h1>

          <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-700">
            {fruit.intro} Each listing can include Fruit Lot No., Lot Size,
            total boxes, grade, variety, packing details, orchard location,
            harvest date and fruit images or videos.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/auctions"
              className="rounded-full bg-green-700 px-4 py-2 text-sm font-extrabold text-white"
            >
              View Live Fruit Lots
            </Link>

            <Link
              to="/list-new-lot"
              className="rounded-full bg-green-50 px-4 py-2 text-sm font-extrabold text-green-800 ring-1 ring-green-200"
            >
              List a Fruit Lot
            </Link>
          </div>

          <h2 className="mt-6 text-base font-extrabold text-black">
            What is a {fruit.name} Fruit Lot?
          </h2>

          <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">
            A {fruit.name} Fruit Lot is a complete identifiable quantity of
            packed fruit prepared for sale. In fresh fruit trading, Fruit Lot
            No. and Lot Size are used to identify and describe packed produce,
            similar to batch number and batch size in manufacturing. This
            terminology is more suitable for orchard growers, fruit buyers,
            logistics partners and marketplace traceability.
          </p>

          <h2 className="mt-6 text-base font-extrabold text-black">
            Important Lot Details
          </h2>

          <ul className="mt-2 list-disc pl-5 text-sm font-semibold leading-relaxed text-gray-700">
            <li>Fruit Lot No.</li>
            <li>{fruit.name} variety</li>
            <li>Grade and quality details</li>
            <li>Lot Size</li>
            <li>Total boxes</li>
            <li>Average box weight</li>
            <li>Total estimated weight</li>
            <li>Orchard or packing location</li>
            <li>Harvest date</li>
            <li>Packing details</li>
            <li>Fruit images and videos</li>
          </ul>

          {fruit.varieties?.length > 0 && (
            <>
              <h2 className="mt-6 text-base font-extrabold text-black">
                Popular {fruit.name} Varieties
              </h2>

              <ul className="mt-2 list-disc pl-5 text-sm font-semibold leading-relaxed text-gray-700">
                {fruit.varieties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {fruit.regions?.length > 0 && (
            <>
              <h2 className="mt-6 text-base font-extrabold text-black">
                Popular {fruit.name} Growing Regions
              </h2>

              <ul className="mt-2 list-disc pl-5 text-sm font-semibold leading-relaxed text-gray-700">
                {fruit.regions.map((region) => (
                  <li key={region}>{region}</li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-6 text-base font-extrabold text-black">
            Seasonal Availability
          </h2>

          <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">
            {fruit.season}
          </p>

          <h2 className="mt-6 text-base font-extrabold text-black">
            Benefits for Growers
          </h2>

          <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">
            Growers can list their {fruit.name} fruit lots online and reach
            buyers beyond local mandi networks. Clear information such as Fruit
            Lot No., Lot Size, grade, total boxes and packing details helps
            buyers understand the available quantity and quality before
            requesting quotations.
          </p>

          <h2 className="mt-6 text-base font-extrabold text-black">
            Benefits for Buyers
          </h2>

          <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">
            Bulk buyers can explore {fruit.name} lots, compare available
            quantities, review quality details and request quotations for
            complete-lot deals. This helps buyers save time while sourcing fresh
            produce directly from growing regions.
          </p>

          <h2 className="mt-6 text-base font-extrabold text-black">
            How eFruitMandi Works
          </h2>

          <ol className="mt-2 list-decimal pl-5 text-sm font-semibold leading-relaxed text-gray-700">
            <li>Growers list their fruit lot with complete lot details.</li>
            <li>Buyers explore available fruit lots on the marketplace.</li>
            <li>Interested buyers request quotations.</li>
            <li>Growers and buyers proceed according to platform rules.</li>
            <li>Logistics and payment flow follow eFruitMandi policies.</li>
          </ol>

          <h2 className="mt-6 text-base font-extrabold text-black">
            Frequently Asked Questions
          </h2>

          <div className="mt-3 space-y-3">
            <FAQ
              question={`How can I sell ${fruit.name} fruit lots online?`}
              answer={`Growers can list ${fruit.name} fruit lots on eFruitMandi with Fruit Lot No., Lot Size, grade, total boxes, packing details, orchard location and fruit images.`}
            />

            <FAQ
              question={`Can buyers request quotations for ${fruit.name} lots?`}
              answer={`Yes. Buyers can explore available ${fruit.name} fruit lots and request quotations according to eFruitMandi platform rules.`}
            />

            <FAQ
              question={`What details should be added in a ${fruit.name} lot listing?`}
              answer={`A ${fruit.name} fruit lot listing should include Fruit Lot No., Lot Size, variety, grade, total boxes, average box weight, harvest date, packing details and location.`}
            />

            <FAQ
              question="Is Fruit Lot No. different from batch number?"
              answer="Yes. Fruit Lot No. is a fresh produce trading term used to identify a packed fruit lot. It works like batch number in manufacturing, but is more suitable for growers, buyers and fruit trading."
            />
          </div>

          <h2 className="mt-6 text-base font-extrabold text-black">
            Useful Links
          </h2>

          <ul className="mt-2 list-disc pl-5 text-sm font-bold text-green-800">
            <li>
              <Link to="/auctions">Live Fruit Lots</Link>
            </li>
            <li>
              <Link to="/list-new-lot">List a Fruit Lot</Link>
            </li>
            <li>
              <Link to="/fruit-buyers">Fruit Buyers</Link>
            </li>
            <li>
              <Link to="/fruit-growers">Fruit Growers</Link>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}

function FAQ({ question, answer }) {
  return (
    <div className="rounded-md bg-green-50 p-3">
      <h3 className="text-sm font-extrabold text-green-900">{question}</h3>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-700">
        {answer}
      </p>
    </div>
  );
}