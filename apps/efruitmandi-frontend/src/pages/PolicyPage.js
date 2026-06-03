import { Link } from "react-router-dom";

const policyContent = {
  privacy: {
    eyebrow: "Privacy Policy",
    title: "Privacy Policy",
    intro:
      "E-Fruit Mandi collects only the information needed to operate fruit trading, account access, verification, orders, delivery, payments, support, and marketplace safety.",
    sections: [
      {
        title: "Information we collect",
        body:
          "We may collect your name, phone number, email address, account role, business or orchard details, KYC information, product and lot details, order records, payment status, delivery information, support messages, device details, and basic usage activity.",
      },
      {
        title: "How we use information",
        body:
          "Your information is used to create and secure accounts, verify users, publish fruit lots, connect growers and buyers, process orders, coordinate logistics, prevent misuse, improve platform reliability, and provide customer support.",
      },
      {
        title: "Sharing and protection",
        body:
          "We share information only when needed for marketplace operations, legal compliance, payment, logistics, verification, or support. We use reasonable safeguards and limit access to sensitive information.",
      },
      {
        title: "Contact",
        body:
          "For privacy questions, corrections, or deletion requests, contact Orchard Growers Private Limited through the support channels available on the platform.",
      },
    ],
  },
  terms: {
    eyebrow: "Terms of Service",
    title: "Terms of Service",
    intro:
      "By using E-Fruit Mandi, you agree to use the platform responsibly for legitimate horticulture marketplace activity and to provide accurate account and trading information.",
    sections: [
      {
        title: "Account responsibility",
        body:
          "Users are responsible for their login details, OTP access, submitted profile information, listed lots, quotes, orders, payment actions, and communication made from their account.",
      },
      {
        title: "Marketplace conduct",
        body:
          "Growers, buyers, drivers, and service users must provide truthful information, avoid fraud or misleading listings, respect agreed transactions, and follow applicable laws and platform verification requirements.",
      },
      {
        title: "Orders, payments, and delivery",
        body:
          "Prices, availability, payment status, delivery timelines, and order completion depend on verified platform records, partner services, and operational confirmation. Failed or suspicious activity may be reviewed or restricted.",
      },
      {
        title: "Changes and availability",
        body:
          "Features, fees, verification rules, and terms may change as the service evolves. Continued use of the platform means you accept the latest posted terms.",
      },
    ],
  },
  deletion: {
    eyebrow: "User Data Deletion",
    title: "User Data Deletion",
    intro:
      "Users can request deletion of account information that is no longer required for legal, payment, verification, dispute, security, or marketplace record purposes.",
    sections: [
      {
        title: "How to request deletion",
        body:
          "Send a deletion request from your registered email or phone number through platform support. Include your name, registered contact, account role, and a clear request to delete your E-Fruit Mandi data.",
      },
      {
        title: "Verification before deletion",
        body:
          "We may verify your identity with OTP, account details, or support follow-up before processing deletion so that another person cannot remove your account without permission.",
      },
      {
        title: "What may be retained",
        body:
          "Some records may be retained where required for completed orders, payments, invoices, dispute handling, fraud prevention, security logs, tax, regulatory, or legal compliance.",
      },
      {
        title: "Processing timeline",
        body:
          "After verification, eligible deletion requests are reviewed and processed within a reasonable operational timeline. We will confirm the request status through registered contact details.",
      },
    ],
  },
};

export default function PolicyPage({ type }) {
  const content = policyContent[type] || policyContent.privacy;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-green-700">{content.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-black text-gray-950 sm:text-3xl">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{content.intro}</p>

        <div className="mt-6 space-y-4">
          {content.sections.map((section) => (
            <section key={section.title} className="rounded-md border border-green-100 bg-green-50/40 p-4">
              <h2 className="text-sm font-extrabold text-gray-950">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">{section.body}</p>
            </section>
          ))}
        </div>

        <Link to="/" className="mt-6 inline-flex text-sm font-bold text-green-700 underline">
          Back to E-Fruit Mandi
        </Link>
      </section>
    </main>
  );
}
