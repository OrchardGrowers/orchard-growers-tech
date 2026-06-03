import { Link } from "react-router-dom";

const terms = [
  {
    title: "Account responsibility",
    body: "Use accurate account, product, pricing, delivery, and contact details. You are responsible for activity performed through your account.",
  },
  {
    title: "Security",
    body: "Keep OTPs, passwords, and payment details private. Payment, settlement, listing, and delivery actions should be performed only by authorized users.",
  },
  {
    title: "Marketplace activity",
    body: "Fruit listings, quotes, orders, logistics requests, and settlement information must be genuine and lawful. E-Fruit Mandi may review suspicious or disputed marketplace activity.",
  },
  {
    title: "Verification and disputes",
    body: "KYC, product, delivery, or payment disputes may require document, image, call, or admin verification before settlement or account changes are completed.",
  },
  {
    title: "Policy updates",
    body: "Terms may be updated as services, legal requirements, or marketplace processes change. Continued use of the platform means you accept the latest posted terms.",
  },
];

export default function TermsAndConditions() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">E-Fruit Mandi</p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Terms & Conditions</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          By signing in, creating an account, or using E-Fruit Mandi services, you agree to these platform terms.
        </p>

        <div className="mt-6 space-y-4">
          {terms.map((item) => (
            <article key={item.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h2 className="text-sm font-extrabold text-gray-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
            </article>
          ))}
        </div>

        <Link
          to="/login"
          className="mt-6 inline-flex rounded-md bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}
