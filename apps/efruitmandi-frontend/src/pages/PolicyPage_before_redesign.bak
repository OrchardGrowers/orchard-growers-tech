import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { business, staticPages } from "../data/staticPages";

const homeLabel = "Back to eFruitMandi";

export default function PolicyPage({ type }) {
  const content = staticPages[type] || staticPages.privacy;
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

      <main className="mx-auto w-full max-w-5xl px-1 pb-24 pt-3 sm:px-3 md:pt-5">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-green-700">
            {content.eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-black leading-tight text-gray-950 sm:text-3xl">
            {content.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
            {content.intro}
          </p>

          {content.sections?.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {content.sections.map((section) => (
                <InfoSection key={section.title} section={section} />
              ))}
            </div>
          ) : null}

          {content.faqs?.length ? <FaqGroups groups={content.faqs} /> : null}

          {!content.noContact && (
            <section className="mt-6 rounded-md border border-green-100 bg-green-50 p-4">
              <h2 className="text-sm font-extrabold text-gray-950">
                Need help?
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                Contact {business.platform} support for account, KYC, listing,
                quotation, payment, delivery, or dispute questions.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`mailto:${business.email}`}
                  className="rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
                >
                  Email support
                </a>
                <a
                  href={`tel:${business.phone.replace(/\s+/g, "")}`}
                  className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
                >
                  Call support
                </a>
              </div>
            </section>
          )}

          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-gray-100 px-4 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-200"
          >
            {homeLabel}
          </Link>
        </section>
      </main>
    </>
  );
}

function InfoSection({ section }) {
  return (
    <article className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <h2 className="text-sm font-extrabold text-gray-950">{section.title}</h2>

      {section.body?.map((paragraph) => (
        <p key={paragraph} className="mt-2 text-sm leading-6 text-gray-700">
          {paragraph}
        </p>
      ))}

      {section.bullets?.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
          {section.bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-700" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.steps?.length ? (
        <ol className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
          {section.steps.map((item, index) => (
            <li key={item} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-700 text-xs font-black text-white">
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
    <div className="mt-6 space-y-4">
      {groups.map((group) => (
        <section key={group.category} className="rounded-md border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <h2 className="text-base font-black text-gray-950">{group.category}</h2>
          <div className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {group.items.map((item) => (
              <details key={item.q} className="group">
                <summary className="cursor-pointer list-none px-3 py-3 text-sm font-extrabold text-gray-900">
                  <span className="flex items-center justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="shrink-0 text-green-700 group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="px-3 pb-3 text-sm leading-6 text-gray-700">
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
