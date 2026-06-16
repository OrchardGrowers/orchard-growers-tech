const business = {
  company: "Orchard Growers Private Limited",
  platform: "eFruitMandi",
  domain: "https://www.efruitmandi.live",
  email: "support@efruitmandi.live",
  phone: "+91 7018108900",
  address: "Musrani, Tehsil Gohar, District Mandi, Himachal Pradesh - 175029",
  jurisdiction:
    "Mandi, Himachal Pradesh. Higher legal matters may fall under Shimla, Himachal Pradesh or higher courts as applicable.",
};

const supportText = `For support, contact ${business.platform} at ${business.email} or ${business.phone}.`;
const facilitatorText =
  "eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing.";

const page = ({
  route,
  eyebrow,
  title,
  description,
  intro,
  sections,
  faqs,
  noContact = false,
}) => ({
  route,
  eyebrow,
  title,
  description,
  intro,
  sections,
  faqs,
  noContact,
});

export const staticPages = {
  about: page({
    route: "/about",
    eyebrow: "Company",
    title: "About Us",
    description:
      "Learn about eFruitMandi, a fresh fruit marketplace facilitation platform by Orchard Growers Private Limited.",
    intro:
      "eFruitMandi helps growers, buyers, and logistics partners connect around fresh fruit listings, quotations, deals, consignments, delivery support, and settlement records.",
    sections: [
      {
        title: "Who we are",
        body: [
          `${business.company} operates eFruitMandi for the horticulture and fresh fruit marketplace ecosystem.`,
          facilitatorText,
        ],
      },
      {
        title: "What the platform does",
        bullets: [
          "Helps growers create fruit lot listings with quantity, grade, packing, location, media, and consignment details.",
          "Helps buyers review listings, share quotations, and finalize deals directly with growers.",
          "Helps logistics partners support delivery where they are appointed through the grower or seller side.",
          "Keeps account, KYC, payment, delivery, and dispute records for safer marketplace operations.",
        ],
      },
      {
        title: "Business details",
        bullets: [
          `Company: ${business.company}`,
          `Platform: ${business.platform}`,
          `Domain: ${business.domain}`,
          `Registered address: ${business.address}`,
          `Legal jurisdiction: ${business.jurisdiction}`,
        ],
      },
    ],
  }),

  story: page({
    route: "/our-story",
    eyebrow: "Company",
    title: "Our Story",
    description:
      "Read why eFruitMandi was created for growers, buyers, and logistics partners in the fresh fruit supply chain.",
    intro:
      "eFruitMandi was created to reduce uncertainty in fresh fruit trade by giving growers, buyers, and logistics partners a clearer way to connect and record consignment activity.",
    sections: [
      {
        title: "Built around orchard realities",
        body: [
          "Fresh fruit is perishable, seasonal, quality-sensitive, and dependent on packing, transport, trust, and timing.",
          "Growers often need better visibility, buyers need reliable consignment information, and logistics partners need clear delivery and payment references.",
        ],
      },
      {
        title: "A practical marketplace layer",
        body: [
          "The platform focuses on listings, quotations, deal records, KYC, support, and operational clarity. Final deal decisions remain between grower and buyer.",
          facilitatorText,
        ],
      },
      {
        title: "A long-term goal",
        body: [
          "The goal is not to replace local relationships. The goal is to make those relationships more transparent, better documented, and easier to manage across markets.",
        ],
      },
    ],
  }),

  visionMission: page({
    route: "/vision-mission",
    eyebrow: "Company",
    title: "Vision & Mission",
    description:
      "The eFruitMandi vision and mission for a transparent, trusted, and efficient fresh fruit marketplace.",
    intro:
      "Our vision and mission are centered on trust, access, documentation, and practical technology for the fresh fruit ecosystem.",
    sections: [
      {
        title: "Vision",
        body: [
          "To support a trusted digital fruit marketplace where growers, buyers, and logistics partners can work with better information, clearer records, and fairer movement of consignments.",
        ],
      },
      {
        title: "Mission",
        bullets: [
          "Help growers present fruit lots with clear grade, packing, quantity, and location details.",
          "Help buyers review listings and share quotations through a safer process.",
          "Support logistics coordination, tracking information, and settlement references where applicable.",
          "Promote KYC, transparent records, and responsible marketplace behavior.",
        ],
      },
      {
        title: "Operating principles",
        bullets: [
          "The platform does not promise any sale, rate, profit, or final outcome.",
          "Final deal decisions are between grower and buyer.",
          "Fruit is perishable, so policies depend on consignment status and operational confirmation.",
        ],
      },
    ],
  }),

  why: page({
    route: "/why-efruitmandi",
    eyebrow: "Company",
    title: "Why eFruitMandi",
    description:
      "Understand how eFruitMandi helps growers, buyers, and logistics partners manage fresh fruit listings, quotations, deals, and consignments.",
    intro:
      "eFruitMandi is designed for users who need simple marketplace tools without losing the human decisions that matter in fresh fruit trade.",
    sections: [
      {
        title: "For growers",
        bullets: [
          "Create structured fruit lot listings.",
          "Share grade-wise samples, packing details, quantity, and location.",
          "Receive buyer interest and quotations through a documented platform process.",
          "Use KYC and optional OG Verified status to build better trust.",
        ],
      },
      {
        title: "For buyers",
        bullets: [
          "Review fresh fruit listings and grower details.",
          "Share quotations and track deal records.",
          "Use payment and support workflows intended to reduce operational uncertainty.",
        ],
      },
      {
        title: "For logistics partners",
        bullets: [
          "Support delivery details when appointed through the grower or seller side.",
          "Help maintain tracking and settlement references where applicable.",
        ],
      },
    ],
  }),

  contact: page({
    route: "/contact",
    eyebrow: "Support",
    title: "Contact Us",
    description:
      "Contact eFruitMandi support for account, KYC, listing, quotation, payment, delivery, or dispute help.",
    intro:
      "Use the contact details below for support requests, marketplace questions, payment follow-up, KYC help, or reporting a problem.",
    sections: [
      {
        title: "Support channels",
        bullets: [
          `Email: ${business.email}`,
          `Phone and WhatsApp: ${business.phone}`,
          `Website: ${business.domain}`,
          `Registered address: ${business.address}`,
        ],
      },
      {
        title: "What to include",
        bullets: [
          "Your registered name and phone number or email.",
          "Your role: Grower, Buyer, or Logistics Partner.",
          "Relevant listing, quotation, deal, payment, delivery, or KYC reference.",
          "Clear screenshots, photos, documents, or delivery details where available.",
        ],
      },
      {
        title: "Support scope",
        body: [
          "eFruitMandi can help review platform records, connect support information, and guide next steps. Final fruit quality, rate, and consignment decisions remain between grower and buyer unless separately agreed in writing.",
        ],
      },
    ],
  }),

  faqs: page({
    route: "/faqs",
    eyebrow: "Help Center",
    title: "FAQs",
    description:
      "Frequently asked questions about eFruitMandi accounts, growers, buyers, logistics, KYC, payments, refunds, disputes, and safety.",
    intro:
      "These FAQs explain common marketplace situations in simple language for growers, buyers, logistics partners, and support reviewers.",
    sections: [],
    faqs: [
      {
        category: "General",
        items: [
          {
            q: "What is eFruitMandi?",
            a: "eFruitMandi is a fresh fruit marketplace facilitation platform for growers, buyers, and logistics partners.",
          },
          {
            q: "Does eFruitMandi buy or sell fruit directly?",
            a: facilitatorText,
          },
          {
            q: "Who operates eFruitMandi?",
            a: `${business.platform} is operated by ${business.company}.`,
          },
          {
            q: "What can users do on the platform?",
            a: "Users can create or review fruit listings, share quotations, manage deal records, submit KYC, coordinate logistics information, and request support.",
          },
          {
            q: "What are the platform access hours?",
            a: "Platform access, registration, and KYC submission are available 24x7. Live quotation hours are 09:00 AM IST to 04:00 PM IST.",
          },
        ],
      },
      {
        category: "Grower",
        items: [
          {
            q: "How does a grower list fruit?",
            a: "A grower creates a grower profile, completes required KYC, and adds fruit, variety, grade, packing, quantity, location, and media details.",
          },
          {
            q: "Does a grower pay registration or listing fees?",
            a: "No. Grower registration, platform onboarding, and listing fees are currently 0%.",
          },
          {
            q: "Who decides the final deal with a buyer?",
            a: "The final deal decision is between the grower and buyer. eFruitMandi supports the platform record and process.",
          },
          {
            q: "Can a grower also be a buyer on the same account?",
            a: "Yes. Grower plus Buyer is allowed on the same account if profile and KYC requirements are met.",
          },
          {
            q: "Can a grower work with a logistics partner?",
            a: "Yes. A logistics partner is normally appointed through the grower or seller side for delivery support.",
          },
        ],
      },
      {
        category: "Buyer",
        items: [
          {
            q: "How can a buyer share a quotation?",
            a: "A buyer must log in, create a buyer profile if needed, complete required KYC, and then use the listing quotation flow.",
          },
          {
            q: "Is there a buyer-side success commission?",
            a: "Yes. eFruitMandi may charge 5% on successfully completed final deals from the buyer side.",
          },
          {
            q: "Can a buyer also be a logistics partner on the same account?",
            a: "No. Buyer plus Logistics Partner is not allowed under the same account or person due to conflict of interest, delivery tracking, settlement, and payment disbursement issues.",
          },
          {
            q: "Can separate buyer and logistics businesses use separate accounts?",
            a: "Yes, if they are separate firms with separate accounts, separate KYC, and separate business identities.",
          },
          {
            q: "Does eFruitMandi guarantee fruit quality or final rate?",
            a: "No. Users should review listing details, samples, inspection information, and deal terms before finalizing.",
          },
        ],
      },
      {
        category: "Logistics Partner",
        items: [
          {
            q: "Who appoints the logistics partner?",
            a: "The logistics partner is normally appointed through the grower or seller side.",
          },
          {
            q: "Who is responsible for delivery?",
            a: "The grower and logistics partner are jointly responsible for delivering the consignment to buyer premises where a logistics partner is appointed.",
          },
          {
            q: "Why are logistics details collected?",
            a: "Logistics details help with delivery tracking, support review, and payment settlement references where applicable.",
          },
          {
            q: "Can a logistics partner also be a grower?",
            a: "Yes. Grower plus Logistics Partner is allowed if account, profile, and KYC requirements are met.",
          },
          {
            q: "Does eFruitMandi transport fruit directly?",
            a: "No. eFruitMandi does not directly transport fruit unless separately stated in writing.",
          },
        ],
      },
      {
        category: "KYC",
        items: [
          {
            q: "Is KYC mandatory?",
            a: "Yes. KYC is mandatory for Growers, Buyers, and Logistics Partners.",
          },
          {
            q: "Is KYC free?",
            a: "Yes. KYC submission and review are free of cost.",
          },
          {
            q: "Why is KYC needed?",
            a: "KYC supports identity checks, bank and payment trust, compliance, and safer marketplace records.",
          },
          {
            q: "Is KYC the same as OG Verified?",
            a: "No. KYC is mandatory and free. OG Verified is an optional trusted badge process for Growers and Buyers.",
          },
          {
            q: "Can KYC be rejected?",
            a: "KYC may require correction or additional review if submitted information is incomplete, unclear, or inconsistent.",
          },
        ],
      },
      {
        category: "OG Verified / Trusted Badge",
        items: [
          {
            q: "Who can apply for OG Verified?",
            a: "OG Verified is applicable only for Growers and Buyers.",
          },
          {
            q: "What is the OG Verified fee?",
            a: "The OG Verified / Trusted Badge process fee is Rs. 5,000.",
          },
          {
            q: "What does OG Verified include?",
            a: "It includes physical visit, farm or premises inspection, video documentation, business assessment, guidance, and trusted badge issuance if approved.",
          },
          {
            q: "Is OG Verified automatic after payment?",
            a: "No. Approval is not automatic. The eFruitMandi or Orchard Growers team may approve, reject, or revoke the badge if trust standards are not met.",
          },
          {
            q: "Why should a user apply for OG Verified?",
            a: "It helps build trust, quality confidence, physical verification history, and better confidence in future deals.",
          },
        ],
      },
      {
        category: "Payments",
        items: [
          {
            q: "Who pays first in the payment flow?",
            a: "The buyer pays first as part of the deal process.",
          },
          {
            q: "How is payment held?",
            a: "Payment may be collected or held through a payment gateway, special account, or escrow-style process integrated with BillDesk or another authorized payment partner.",
          },
          {
            q: "When is payment released?",
            a: "Payment release happens only after the required consignment and deal process is completed.",
          },
          {
            q: "Who may receive settlement?",
            a: "Settlement may be made to the grower, logistics partner, and platform commission as applicable.",
          },
          {
            q: "Are taxes included?",
            a: "Applicable taxes, if any, may be charged as per Indian law. Users should consult their own tax advisor for specific obligations.",
          },
        ],
      },
      {
        category: "Refunds",
        items: [
          {
            q: "When can a refund apply?",
            a: "A refund can apply if a deal is cancelled, the consignment is not dispatched, or the delivery process is not completed.",
          },
          {
            q: "How long does refund processing take?",
            a: "Refund should be processed within 3 working days after confirmation of cancellation, non-dispatch, or non-completion.",
          },
          {
            q: "Can the buyer adjust the locked amount in another deal?",
            a: "The buyer may choose to adjust the locked amount in the next deal if operationally allowed.",
          },
          {
            q: "Is refund available after completed delivery?",
            a: "Once a deal is properly completed and the consignment is accepted or settled, refund may not be applicable except as per dispute policy or applicable law.",
          },
          {
            q: "Does fruit being perishable affect refunds?",
            a: "Yes. Refund handling depends on consignment status, dispatch, delivery progress, acceptance, and operational confirmation.",
          },
        ],
      },
      {
        category: "Disputes",
        items: [
          {
            q: "Who should first resolve quality or rate disputes?",
            a: "The grower and buyer should first try to resolve quality, rate, and consignment disputes mutually.",
          },
          {
            q: "What happens if no mutual agreement is reached?",
            a: "If no mutual agreement is reached, the grower has the right to withdraw or take back the consignment.",
          },
          {
            q: "Can the grower move the consignment elsewhere?",
            a: "Yes. The grower may move the consignment to another buyer, another market, or offline mandi.",
          },
          {
            q: "Can the buyer hold the consignment unfairly?",
            a: "The buyer should not unlawfully stop or hold the grower's consignment.",
          },
          {
            q: "What is eFruitMandi's role in disputes?",
            a: "eFruitMandi supports fair movement, platform records, and grower consignment rights while remaining a marketplace facilitator.",
          },
        ],
      },
      {
        category: "Account & Safety",
        items: [
          {
            q: "What is the minimum age to use eFruitMandi?",
            a: "Users must be at least 18 years old.",
          },
          {
            q: "Can one account hold every role?",
            a: "No. Buyer plus Logistics Partner is not allowed under the same account or person. Other allowed role combinations must still meet KYC and profile rules.",
          },
          {
            q: "What should I do if I see suspicious activity?",
            a: "Use Report a Problem or contact support with screenshots, listing details, phone number, and a clear description.",
          },
          {
            q: "Can eFruitMandi restrict an account?",
            a: "The platform may review, restrict, or suspend activity that appears misleading, unsafe, unlawful, or against policy.",
          },
          {
            q: "Where are legal matters handled?",
            a: `Legal jurisdiction is ${business.jurisdiction}`,
          },
        ],
      },
    ],
  }),

  privacy: page({
    route: "/privacy-policy",
    eyebrow: "Legal",
    title: "Privacy Policy",
    description:
      "Privacy Policy for eFruitMandi users, including growers, buyers, and logistics partners.",
    intro:
      "This Privacy Policy explains how eFruitMandi collects, uses, shares, and protects information needed to operate the marketplace facilitation platform.",
    sections: [
      {
        title: "Information we collect",
        bullets: [
          "Name, phone number, email address, account role, business identity, and profile details.",
          "Grower, buyer, logistics, KYC, bank/payment trust, listing, quotation, deal, consignment, and support records.",
          "Images, videos, documents, location or map-point information, delivery updates, and communication submitted through the platform.",
          "Device, browser, session, and basic usage information needed for safety and service reliability.",
        ],
      },
      {
        title: "How we use information",
        bullets: [
          "Create and secure user accounts.",
          "Review KYC, profile details, listings, quotations, payments, delivery records, and support requests.",
          "Support marketplace safety, dispute review, compliance, reporting, and platform improvement.",
          "Communicate service updates, verification requests, support responses, and transaction-related notices.",
        ],
      },
      {
        title: "Sharing of information",
        body: [
          "Information may be shared with growers, buyers, logistics partners, payment partners, verification teams, support providers, technology service providers, legal authorities, or compliance reviewers only where needed for platform operations, safety, payment, delivery, or legal requirements.",
        ],
      },
      {
        title: "Data retention and rights",
        body: [
          "Some records may be retained for completed deals, payment records, invoices, dispute handling, fraud prevention, security, tax, regulatory, and legal compliance. Users may contact support for correction, access, or deletion requests where legally and operationally allowed.",
          supportText,
        ],
      },
    ],
  }),

  terms: page({
    route: "/terms-of-service",
    eyebrow: "Legal",
    title: "Terms of Service",
    description:
      "Terms of Service for using eFruitMandi as a grower, buyer, or logistics partner.",
    intro:
      "By using eFruitMandi, you agree to use the platform responsibly for lawful fresh fruit marketplace activity.",
    sections: [
      {
        title: "Marketplace facilitator role",
        body: [
          facilitatorText,
          "Final decisions about listing details, quotations, deal acceptance, quality, delivery, and commercial terms remain between the grower and buyer.",
        ],
      },
      {
        title: "Eligibility and accounts",
        bullets: [
          "Users must be at least 18 years old.",
          "Users must provide accurate account, profile, KYC, listing, payment, and delivery information.",
          "Grower plus Buyer is allowed.",
          "Grower plus Logistics Partner is allowed.",
          "Buyer plus Logistics Partner is not allowed under the same account or person due to conflict of interest, delivery tracking, settlement, and payment disbursement issues.",
          "Separate buyer and logistics businesses must maintain separate accounts, separate KYC, and separate business identities.",
        ],
      },
      {
        title: "Fees and taxes",
        bullets: [
          "Grower commission is currently 0%.",
          "Registration, listing, and platform onboarding fees are currently 0%.",
          "Buyer-side success commission is 5% on successfully completed final deals and may be included in the final consignment value.",
          "Applicable taxes, if any, may be charged as per Indian law.",
        ],
      },
      {
        title: "Timings and jurisdiction",
        bullets: [
          "Platform access, registration, and KYC submission are available 24x7.",
          "Live quotation hours are 09:00 AM IST to 04:00 PM IST.",
          `Legal jurisdiction: ${business.jurisdiction}`,
        ],
      },
    ],
  }),

  refund: page({
    route: "/refund-cancellation-policy",
    eyebrow: "Legal",
    title: "Refund & Cancellation Policy",
    description:
      "Refund and cancellation policy for eFruitMandi deals, payments, and perishable fruit consignments.",
    intro:
      "This policy explains when refund or cancellation may apply in fresh fruit deals handled through the platform.",
    sections: [
      {
        title: "When refund can apply",
        bullets: [
          "A deal is cancelled before the required consignment process is completed.",
          "The consignment is not dispatched.",
          "The delivery process is not completed.",
          "A confirmed operational issue requires reversal under platform support review or applicable law.",
        ],
      },
      {
        title: "Refund timeline",
        body: [
          "Refund should be processed within 3 working days after confirmation of cancellation, non-dispatch, or non-completion. Actual bank or payment partner timelines may vary.",
        ],
      },
      {
        title: "Adjustment option",
        body: [
          "The buyer may choose to adjust the locked amount in the next deal if operationally allowed by the platform and payment process.",
        ],
      },
      {
        title: "Perishable goods limitation",
        body: [
          "Fruit is perishable. Once a deal is properly completed and the consignment is accepted or settled, refund may not be applicable except as per dispute policy or applicable law.",
        ],
      },
    ],
  }),

  payment: page({
    route: "/payment-escrow-policy",
    eyebrow: "Legal",
    title: "Payment / Escrow Policy",
    description:
      "Payment and escrow-style policy for eFruitMandi buyer payments, consignment completion, and settlement.",
    intro:
      "This policy explains how buyer payment, holding, release, and settlement may work through the platform and authorized payment partners.",
    sections: [
      {
        title: "Buyer pays first",
        body: [
          "In the platform payment flow, the buyer pays first before payment release or settlement steps are completed.",
        ],
      },
      {
        title: "Payment holding process",
        body: [
          "Payment may be collected or held through a payment gateway, special account, or escrow-style process as integrated with BillDesk or another authorized payment partner.",
        ],
      },
      {
        title: "Release and settlement",
        bullets: [
          "Payment release happens only after the required consignment and deal process is completed.",
          "Payment may be settled to the grower, logistics partner, and platform commission as applicable.",
          "The platform does not hard-code final bank settlement promises in this policy. Settlement follows implemented payment partner and operational rules.",
        ],
      },
      {
        title: "Taxes and compliance",
        body: [
          "Applicable taxes, if any, may be charged as per Indian law. Users remain responsible for their own tax, invoice, and compliance obligations.",
        ],
      },
    ],
  }),

  kyc: page({
    route: "/kyc-verification-policy",
    eyebrow: "Trust & Safety",
    title: "KYC Verification Policy",
    description:
      "KYC policy for growers, buyers, and logistics partners using eFruitMandi.",
    intro:
      "KYC helps protect marketplace users by improving identity, payment, compliance, and support records.",
    sections: [
      {
        title: "Mandatory and free",
        bullets: [
          "KYC is mandatory for Growers, Buyers, and Logistics Partners.",
          "KYC is free of cost.",
          "KYC is separate from OG Verified / Trusted Badge.",
        ],
      },
      {
        title: "Purpose of KYC",
        bullets: [
          "Identity and business verification.",
          "Bank, payment, and settlement trust.",
          "Compliance support and safer marketplace records.",
          "Reduced misuse, fake accounts, and misleading marketplace activity.",
        ],
      },
      {
        title: "Review and correction",
        body: [
          "KYC may require additional documents, clearer images, updated information, or support follow-up. Submitting KYC does not automatically approve a profile for every platform action.",
        ],
      },
      {
        title: "Role-specific KYC",
        body: [
          "Separate role profiles may require separate KYC or business details. Separate buyer and logistics businesses must maintain separate accounts, separate KYC, and separate business identities.",
        ],
      },
    ],
  }),

  ogVerified: page({
    route: "/og-verified-policy",
    eyebrow: "Trust & Safety",
    title: "OG Verified / Trusted Badge Policy",
    description:
      "Policy for the eFruitMandi OG Verified / Trusted Badge program for growers and buyers.",
    intro:
      "OG Verified is a trust and physical verification program. It is separate from mandatory KYC.",
    sections: [
      {
        title: "Eligibility and fee",
        bullets: [
          "Applicable only for Growers and Buyers.",
          "Fee: Rs. 5,000.",
          "It is not automatic and does not replace KYC.",
        ],
      },
      {
        title: "What the process includes",
        bullets: [
          "Physical visit.",
          "Farm or premises inspection.",
          "Video documentation.",
          "Business assessment.",
          "Guidance and trusted badge issuance if approved.",
        ],
      },
      {
        title: "Approval, rejection, or revocation",
        body: [
          "The eFruitMandi or Orchard Growers team may approve, reject, or revoke the badge if trust standards are not met or if later information raises a trust concern.",
        ],
      },
      {
        title: "Purpose of the badge",
        body: [
          "OG Verified supports trust, quality confidence, physical verification, and better confidence in future deals. It does not guarantee a rate, sale, profit, or final outcome.",
        ],
      },
    ],
  }),

  commission: page({
    route: "/commission-fee-policy",
    eyebrow: "Legal",
    title: "Commission & Fee Policy",
    description:
      "Commission and fee policy for eFruitMandi growers, buyers, listings, onboarding, and completed deals.",
    intro:
      "This page explains the current platform fee structure in simple terms.",
    sections: [
      {
        title: "Current zero-fee items",
        bullets: [
          "Grower commission: 0%.",
          "Registration fee: 0%.",
          "Listing fee: 0%.",
          "Platform onboarding fee: 0%.",
        ],
      },
      {
        title: "Buyer-side success commission",
        body: [
          "Buyer-side success commission is 5% on successfully completed final deals. The 5% commission is formally charged from the buyer side and may be included in the final consignment value.",
        ],
      },
      {
        title: "Taxes",
        body: [
          "Applicable taxes, if any, may be charged as per Indian law. This policy does not provide final tax advice.",
        ],
      },
      {
        title: "Policy updates",
        body: [
          "Fees may be updated as services, payment integrations, or legal requirements change. Updated policies will be posted on the platform.",
        ],
      },
    ],
  }),

  logistics: page({
    route: "/shipping-logistics-policy",
    eyebrow: "Legal",
    title: "Shipping & Logistics Policy",
    description:
      "Shipping and logistics policy for fresh fruit consignments handled through eFruitMandi marketplace records.",
    intro:
      "This policy explains logistics roles, delivery responsibility, and tracking expectations for fresh fruit consignments.",
    sections: [
      {
        title: "Appointment of logistics partner",
        body: [
          "The logistics partner is normally appointed through the grower or seller side.",
        ],
      },
      {
        title: "Delivery responsibility",
        body: [
          "The grower and logistics partner are jointly responsible for delivering the consignment to buyer premises where a logistics partner is appointed.",
        ],
      },
      {
        title: "Tracking and settlement details",
        bullets: [
          "Vehicle, driver, route, consignment, and delivery details should be captured where applicable.",
          "These details may support tracking, delivery confirmation, support review, and payment settlement references.",
        ],
      },
      {
        title: "Platform role",
        body: [
          "eFruitMandi does not directly transport, insure, or own fruit unless separately stated in writing. Fruit is perishable, and delivery timelines depend on operational conditions.",
        ],
      },
    ],
  }),

  community: page({
    route: "/community-guidelines",
    eyebrow: "Trust & Safety",
    title: "Community Guidelines",
    description:
      "Community guidelines for safe and responsible use of eFruitMandi by growers, buyers, and logistics partners.",
    intro:
      "These guidelines help keep the marketplace fair, respectful, and useful for real fresh fruit business activity.",
    sections: [
      {
        title: "Be accurate",
        bullets: [
          "Use truthful profile, KYC, listing, grade, packing, quantity, location, and payment information.",
          "Do not upload misleading fruit media, documents, or identity details.",
        ],
      },
      {
        title: "Be fair in deals",
        bullets: [
          "Respect agreed quotations and consignment terms.",
          "Do not misuse payment, delivery, support, or dispute workflows.",
          "Do not unlawfully stop or hold a grower's consignment.",
        ],
      },
      {
        title: "Respect role boundaries",
        body: [
          "Buyer plus Logistics Partner is not allowed under the same account or person. Separate businesses must use separate accounts, separate KYC, and separate business identities.",
        ],
      },
      {
        title: "Platform action",
        body: [
          "eFruitMandi may review, restrict, suspend, or escalate activity that appears fraudulent, unsafe, unlawful, abusive, or against platform policy.",
        ],
      },
    ],
  }),

  buyerGuide: page({
    route: "/buyer-guide",
    eyebrow: "Help Center",
    title: "Buyer Guide",
    description:
      "A practical guide for buyers using eFruitMandi to review listings, share quotations, complete payment, and receive consignments.",
    intro:
      "This guide helps buyers understand the normal journey on eFruitMandi.",
    sections: [
      {
        title: "Getting started",
        steps: [
          "Create or log in to your account.",
          "Create a buyer profile if required.",
          "Complete free buyer KYC.",
          "Review fruit listings, grade details, packing, media, and location.",
        ],
      },
      {
        title: "Quotation and payment",
        steps: [
          "Share your quotation during live quotation hours.",
          "Finalize the deal directly with the grower through the platform flow.",
          "Pay first through the available payment process when required.",
          "Track deal, consignment, and support updates.",
        ],
      },
      {
        title: "Buyer responsibilities",
        bullets: [
          "Review fruit details carefully before finalizing.",
          "Keep payment and contact details accurate.",
          "Do not hold a grower's consignment unlawfully.",
          "Raise disputes quickly with clear evidence.",
        ],
      },
    ],
  }),

  growerGuide: page({
    route: "/grower-guide",
    eyebrow: "Help Center",
    title: "Grower Guide",
    description:
      "A practical guide for growers using eFruitMandi to create listings, receive quotations, and manage consignments.",
    intro:
      "This guide helps growers prepare clear fruit lot listings and manage buyer interest.",
    sections: [
      {
        title: "Getting started",
        steps: [
          "Create or log in to your account.",
          "Create a grower profile if required.",
          "Complete free grower KYC.",
          "Add orchard, contact, location, and map-point details where required.",
        ],
      },
      {
        title: "Creating a good listing",
        bullets: [
          "Use accurate fruit, variety, quality, packing, quantity, and grade details.",
          "Upload clear grade-wise sample photos or videos where requested.",
          "Mention correct farm, packing hall, or consignment location.",
          "Keep listing information updated if the consignment status changes.",
        ],
      },
      {
        title: "Consignment rights",
        body: [
          "If a dispute cannot be resolved mutually, the grower has the right to withdraw or take back the consignment and may move it to another buyer, another market, or offline mandi.",
        ],
      },
    ],
  }),

  logisticsGuide: page({
    route: "/logistics-partner-guide",
    eyebrow: "Help Center",
    title: "Logistics Partner Guide",
    description:
      "A practical guide for logistics partners supporting eFruitMandi consignments.",
    intro:
      "This guide explains how logistics partners can support delivery records and consignment movement.",
    sections: [
      {
        title: "Getting started",
        steps: [
          "Create or log in to your account.",
          "Create a logistics partner profile if required.",
          "Complete free logistics KYC.",
          "Keep vehicle, driver, route, and contact information accurate.",
        ],
      },
      {
        title: "Delivery support",
        bullets: [
          "Coordinate with the grower or seller side that appoints you.",
          "Keep consignment and delivery details updated where the platform asks for them.",
          "Support safe movement and timely delivery to buyer premises.",
        ],
      },
      {
        title: "Role boundary",
        body: [
          "A logistics partner cannot also operate as a buyer under the same account or person. Separate businesses require separate accounts, separate KYC, and separate identities.",
        ],
      },
    ],
  }),

  grading: page({
    route: "/fruit-grading-packing-guidelines",
    eyebrow: "Trust & Safety",
    title: "Fruit Grading & Packing Guidelines",
    description:
      "Guidelines for fruit grading, packing, sample media, and consignment clarity on eFruitMandi.",
    intro:
      "These guidelines help growers and buyers use consistent, practical information when discussing fresh fruit consignments.",
    sections: [
      {
        title: "Grading clarity",
        bullets: [
          "Use grade labels consistently within a listing.",
          "Share clear sample photos or videos for each grade where available.",
          "Avoid mixing very different fruit quality in one grade row.",
          "Mention variety, quality, packing type, total quantity, and weight clearly.",
        ],
      },
      {
        title: "Packing clarity",
        bullets: [
          "Mention carton, crate, box, or other packing type accurately.",
          "Mention approximate packing weight where applicable.",
          "Use clean, safe, and transport-suitable packing for perishable fruit.",
          "Keep grade-wise quantity records aligned with actual consignment preparation.",
        ],
      },
      {
        title: "Buyer inspection",
        body: [
          "Buyers should review listing media, grade details, packing details, location, and direct communication before finalizing a deal.",
        ],
      },
      {
        title: "Platform limitation",
        body: [
          "eFruitMandi does not directly grade fruit unless separately stated in writing. Listing information is provided by users and may be reviewed for support or safety purposes.",
        ],
      },
    ],
  }),

  report: page({
    route: "/report-problem",
    eyebrow: "Help Center",
    title: "Report a Problem",
    description:
      "Report an account, listing, quotation, payment, delivery, KYC, or safety problem to eFruitMandi support.",
    intro:
      "Use this page to understand what to send when reporting a marketplace problem.",
    sections: [
      {
        title: "Report by email or WhatsApp",
        bullets: [
          `Email: ${business.email}`,
          `Phone and WhatsApp: ${business.phone}`,
        ],
      },
      {
        title: "Include these details",
        bullets: [
          "Your registered name and contact.",
          "Your role: Grower, Buyer, or Logistics Partner.",
          "Listing, quotation, deal, payment, delivery, or KYC reference.",
          "A short explanation of what happened.",
          "Screenshots, photos, videos, documents, or call details if available.",
        ],
      },
      {
        title: "Safety and urgent issues",
        body: [
          "If there is immediate danger, unlawful detention, threat, or serious legal issue, contact local authorities first. eFruitMandi support can review platform records and assist with marketplace information.",
        ],
      },
      {
        title: "Review process",
        body: [
          "Support may ask for more details, verify records, contact involved parties, or escalate internally. eFruitMandi remains a marketplace facilitator and does not replace legal or law enforcement processes.",
        ],
      },
    ],
  }),

    deletion: page({
    route: "/user-data-deletion",
    eyebrow: "Data Deletion Policy",
    title: "User Data Deletion Policy",
    description:
      "eFruitMandi data deletion policy for account deletion, personal data erasure, verification, retention, grievance redressal, and lawful compliance in India.",
    intro:
      "This policy explains how eFruitMandi users may request deletion or erasure of personal information connected with their account, listings, KYC, support records, quotations, deals, delivery, and payment activity, subject to lawful retention requirements.",
    sections: [
      {
        title: "How to request deletion",
        body: [
          `Send a data deletion request from your registered email address or registered mobile number to ${business.email}. You may also contact support at ${business.phone}.`,
        ],
        bullets: [
          "Your full name",
          "Registered phone number or email address",
          "Account role: Grower, Buyer, or Logistics Partner",
          "A clear statement that you want to delete your eFruitMandi account data",
          "Any relevant listing, KYC, quotation, deal, payment, or support reference",
        ],
      },
      {
        title: "Verification before deletion",
        body: [
          "To protect users from unauthorized deletion requests, eFruitMandi may verify identity through OTP, registered account details, support follow-up, or other reasonable checks before processing a deletion request.",
        ],
      },
      {
        title: "Data that may be deleted or deactivated",
        bullets: [
          "Account profile details that are no longer required",
          "Public profile visibility and optional profile information",
          "Non-essential listing media or account content where deletion is legally and operationally possible",
          "Marketing or communication preferences where applicable",
        ],
      },
      {
        title: "Records that may be retained",
        body: [
          "Some records may be retained where required for completed deals, payments, invoices, KYC verification, delivery records, dispute handling, fraud prevention, platform security, tax, accounting, regulatory, statutory, or legal compliance.",
          "Where full deletion is not immediately possible, eFruitMandi may restrict access, deactivate the account, anonymize non-essential information, or retain only the minimum records required for lawful and operational purposes.",
        ],
      },
      {
        title: "Processing timeline",
        body: [
          "Deletion requests are reviewed after identity verification. eFruitMandi will normally acknowledge the request within a reasonable time and process eligible deletion requests as soon as operationally possible.",
          "If a request cannot be fully completed because of legal, payment, tax, dispute, security, or marketplace record requirements, the user will be informed where reasonably possible.",
        ],
      },
      {
        title: "User rights and grievance redressal",
        body: [
          "Users may request access, correction, completion, updating, or erasure of personal data where legally and operationally permitted.",
          `For privacy, deletion, or grievance requests, contact ${business.platform} at ${business.email} or ${business.phone}.`,
        ],
      },
      {
        title: "Important note",
        body: [
          "Deleting or deactivating an account may affect access to listings, quotes, deals, invoices, KYC status, OG Verified status, delivery records, support history, and marketplace services.",
          "This policy should be read with the Privacy Policy, Terms of Service, KYC Verification Policy, Payment / Escrow Policy, Refund & Cancellation Policy, and Shipping & Logistics Policy.",
        ],
      },
    ],
  }),
};

export const staticPageRouteTypes = [
  "about",
  "story",
  "visionMission",
  "why",
  "contact",
  "faqs",
  "privacy",
  "terms",
  "refund",
  "payment",
  "kyc",
  "ogVerified",
  "commission",
  "logistics",
  "community",
  "buyerGuide",
  "growerGuide",
  "logisticsGuide",
  "grading",
  "report",
  "deletion",
];

export { business };
