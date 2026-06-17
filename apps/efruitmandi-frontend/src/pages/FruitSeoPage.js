import { Link, useParams } from "react-router-dom";
import SEO from "../components/SEO";
import { getFruitSeoPage } from "../data/fruitSeoPages";

export default function FruitSeoPage({ type }) {
  const { fruitSlug } = useParams();
  const page = getFruitSeoPage(type, fruitSlug);

  if (!page) {
    return (
      <div className="min-h-screen bg-[#eef3ef] px-4 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow">
          <h1 className="text-3xl font-black text-gray-900">Page not available</h1>
          <p className="mt-4 text-gray-700">This fruit SEO page is not available yet.</p>
          <Link className="mt-6 inline-block font-bold text-green-700" to="/">
            Back to eFruitMandi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title={page.title} description={page.description} keywords={`${page.h1}, eFruitMandi, fruit marketplace India, fruit growers, fruit buyers, mandi bhav`} />

      <div className="min-h-screen bg-[#eef3ef]">
        <section className="bg-gradient-to-br from-green-900 via-green-700 to-lime-600 px-4 py-16 text-white">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-lime-100">eFruitMandi SEO Network</p>
            <h1 className="mt-4 text-4xl font-black md:text-6xl">{page.h1}</h1>
            <p className="mt-6 max-w-3xl text-lg text-green-50">{page.intro}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/fruit-lots/apple" className="rounded-full bg-white px-5 py-3 font-bold text-green-800">
                View Apple Lots
              </Link>
              <Link to="/buyer-guide" className="rounded-full border border-white/60 px-5 py-3 font-bold text-white">
                Buyer Guide
              </Link>
              <Link to="/grower-guide" className="rounded-full border border-white/60 px-5 py-3 font-bold text-white">
                Grower Guide
              </Link>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-6">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-3xl bg-white p-7 shadow-sm">
                <h2 className="text-2xl font-black text-gray-900">{section.title}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-gray-700">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-3xl bg-green-900 p-7 text-white">
            <h2 className="text-2xl font-black">Useful Links</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/kyc-verification-policy" className="rounded-full bg-white px-4 py-2 font-bold text-green-800">KYC Policy</Link>
              <Link to="/og-verified-policy" className="rounded-full bg-white px-4 py-2 font-bold text-green-800">OG Verified</Link>
              <Link to="/fruit-grading-packing-guidelines" className="rounded-full bg-white px-4 py-2 font-bold text-green-800">Grading & Packing</Link>
              <Link to="/shipping-logistics-policy" className="rounded-full bg-white px-4 py-2 font-bold text-green-800">Logistics Policy</Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
