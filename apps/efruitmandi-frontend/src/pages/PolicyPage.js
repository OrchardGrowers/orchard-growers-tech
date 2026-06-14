import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { business, staticPages } from "../data/staticPages";

const homeLabel = "Back to eFruitMandi";

const pageVisuals = {
  about: {
    icon: "🍎",
    theme: "Orchard Marketplace",
    bg: "from-lime-100 via-white to-green-100",
    hero: "from-green-950 via-green-800 to-lime-700",
  },
  story: {
    icon: "🌱",
    theme: "Our Journey",
    bg: "from-amber-50 via-white to-green-100",
    hero: "from-emerald-950 via-green-800 to-yellow-700",
  },
  visionMission: {
    icon: "🚀",
    theme: "Future of Fruit Trade",
    bg: "from-green-50 via-white to-cyan-50",
    hero: "from-green-950 via-emerald-800 to-cyan-700",
  },
  why: {
    icon: "🤝",
    theme: "Trusted Connections",
    bg: "from-lime-50 via-white to-emerald-100",
    hero: "from-emerald-950 via-green-800 to-lime-700",
  },
  contact: {
    icon: "☎️",
    theme: "Support Center",
    bg: "from-green-50 via-white to-slate-100",
    hero: "from-green-950 via-green-800 to-slate-700",
  },
  faqs: {
    icon: "❓",
    theme: "Help Center",
    bg: "from-slate-50 via-white to-green-50",
    hero: "from-slate-900 via-green-800 to-emerald-700",
  },
  buyerGuide: {
    icon: "🛒",
    theme: "Buyer Guide",
    bg: "from-orange-50 via-white to-green-50",
    hero: "from-orange-900 via-green-800 to-emerald-700",
  },
  growerGuide: {
    icon: "👨‍🌾",
    theme: "Grower Guide",
    bg: "from-lime-100 via-white to-green-50",
    hero: "from-lime-950 via-green-800 to-emerald-700",
  },
  logisticsGuide: {
    icon: "🚚",
    theme: "Logistics Support",
    bg: "from-sky-50 via-white to-green-50",
    hero: "from-slate-900 via-green-800 to-sky-700",
  },
  default: {
    icon: "🛡️",
    theme: "Trust & Policy",
    bg: "from-green-50 via-white to-lime-50",
    hero: "from-green-950 via-green-800 to-lime-700",
  },
};

export default function PolicyPage({ type }) {
  const content = staticPages[type] || staticPages.privacy;
  const visual = pageVisuals[type] || pageVisuals.default;

  const faqSchema =
    content.faqs?.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: content.faqs.flatMap((group) =>
            group.items.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
              },
            }))
          ),
        }
      : undefined;

  return (
    <>
      <SEO
        title={`${content.title} | eFruitMandi`}
        description={content.description}
        canonical={content.route}
        schema={faqSchema}
      />

      <main className={`min-h-screen bg-gradient-to-br ${visual.bg} px-2 pb-24 pt-4 sm:px-4 md:pt-6`}>
        <div className="mx-auto w-full max-w-6xl">
          <section className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-xl shadow-green-900/10">
            <div className={`relative bg-gradient-to-br ${visual.hero} px-5 py-10 text-white sm:px-8 lg:px-12`}>
              <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_18%_20%,white_0,transparent_22%),radial-gradient(circle_at_80%_12%,white_0,transparent_18%),radial-gradient(circle_at_70%_80%,white_0,transparent_20%)]" />
              <div className="relative max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-200">
                  {content.eyebrow}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/25">
                    {visual.icon}
                  </span>
                  <p className="text-sm font-bold text-green-50">{visual.theme}</p>
                </div>
                <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                  {content.title}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50 sm:text-base">
                  {content.intro}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/auctions" className="rounded-full bg-white px-5 py-2 text-xs font-black text-green-800 shadow hover:bg-green-50">
                    View Fruit Lots
                  </Link>
                  <Link to="/register-grower" className="rounded-full bg-green-950/35 px-5 py-2 text-xs font-black text-white ring-1 ring-white/40 hover:bg-green-950/55">
                    Join as Grower
                  </Link>
                  <Link to="/register-buyer" className="rounded-full bg-green-950/35 px-5 py-2 text-xs font-black text-white ring-1 ring-white/40 hover:bg-green-950/55">
                    Join as Buyer
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {["KYC Verified", "Direct Deals", "Transparent Records", "Pan India Reach"].map((item) => (
                  <div key={item} className="rounded-2xl border border-green-100 bg-green-50 p-4">
                    <p className="text-sm font-black text-green-900">{item}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">Built for safer fresh fruit marketplace operations.</p>
                  </div>
                ))}
              </div>

              {content.sections?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {content.sections.map((section) => (
                    <InfoSection key={section.title} section={section} />
                  ))}
                </div>
              ) : null}

              {content.faqs?.length ? <FaqGroups groups={content.faqs} /> : null}

              {!content.noContact && (
                <section className="mt-7 overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-r from-green-900 via-green-800 to-lime-700 p-5 text-white shadow-lg">
                  <h2 className="text-xl font-black">Need help?</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-green-50">
                    Contact {business.platform} support for account, KYC, listing, quotation, payment, delivery, or dispute questions.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a href={`mailto:${business.email}`} className="rounded-full bg-white px-5 py-2 text-xs font-black text-green-800 hover:bg-green-50">
                      Email support
                    </a>
                    <a href={`tel:${business.phone.replace(/\s+/g, "")}`} className="rounded-full bg-green-950/35 px-5 py-2 text-xs font-black text-white ring-1 ring-white/35 hover:bg-green-950/55">
                      Call support
                    </a>
                  </div>
                </section>
              )}

              <Link to="/" className="mt-7 inline-flex rounded-full bg-gray-100 px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-200">
                {homeLabel}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function InfoSection({ section }) {
  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="text-lg font-black text-gray-950">{section.title}</h2>

      {section.body?.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-sm leading-7 text-gray-700">
          {paragraph}
        </p>
      ))}

      {section.bullets?.length ? (
        <ul className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
          {section.bullets.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-700 text-[10px] font-black text-white">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.steps?.length ? (
        <ol className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
          {section.steps.map((item, index) => (
            <li key={item} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-700 text-xs font-black text-white">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

function FaqGroups({ groups }) {
  return (
    <div className="mt-7 space-y-5">
      {groups.map((group) => (
        <section key={group.category} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-gray-950">{group.category}</h2>
          <div className="mt-4 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-gray-50">
            {group.items.map((item) => (
              <details key={item.q} className="group">
                <summary className="cursor-pointer list-none px-4 py-4 text-sm font-black text-gray-900">
                  <span className="flex items-center justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="shrink-0 text-xl text-green-700 group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm leading-7 text-gray-700">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}