import { Link, useParams } from "react-router-dom";
import SEO from "../components/SEO";
import { getFruitSeoPage } from "../data/fruitSeoPages";

export default function FruitSeoPage({ type }) {
  const { fruitSlug } = useParams();
  const page = getFruitSeoPage(type, fruitSlug);

  if (!page) {
    return (
      <div className="min-h-screen bg-[#eef3ef] px-4 py-16">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white p-5 shadow sm:rounded-3xl sm:p-8">
          <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Page not available</h1>
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-100 sm:text-sm sm:tracking-[0.25em]">eFruitMandi SEO Network</p>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-6xl">{page.h1}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-green-50 sm:mt-6 sm:text-lg">{page.intro}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/fruit-lots/apple" className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-3 font-bold text-green-800">
                View Apple Lots
              </Link>
              <Link to="/buyer-guide" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 px-5 py-3 font-bold text-white">
                Buyer Guide
              </Link>
              <Link to="/grower-guide" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 px-5 py-3 font-bold text-white">
                Grower Guide
              </Link>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-6">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-7">
                <h2 className="text-xl font-black text-gray-900 sm:text-2xl">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-gray-700 sm:text-base sm:leading-8">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-2xl bg-green-900 p-4 text-white sm:rounded-3xl sm:p-7">
            <h2 className="text-2xl font-black">Useful Links</h2>
            <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
              <Link to="/kyc-verification-policy" className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 font-bold text-green-800">KYC Policy</Link>
              <Link to="/og-verified-policy" className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 font-bold text-green-800">OG Verified</Link>
              <Link to="/fruit-grading-packing-guidelines" className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 font-bold text-green-800">Grading & Packing</Link>
              <Link to="/shipping-logistics-policy" className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 font-bold text-green-800">Logistics Policy</Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
