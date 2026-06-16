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
      "Learn about eFruitMandi, a digital fruit marketplace facilitation platform by Orchard Growers Private Limited for growers, buyers, logistics partners, traders, and fruit industry stakeholders in India.",
    intro:
      "eFruitMandi is built to support India's fruit trade with structured listings, quotations, KYC, OG Verified trust systems, logistics records, and digital marketplace tools.",
    sections: [
      {
            "title": "About eFruitMandi",
            "body": [
                  "eFruitMandi is a digital fruit marketplace facilitation platform operated by Orchard Growers Private Limited. The platform has been created for India's fresh fruit ecosystem, including fruit growers, orchard owners, buyers, commission agents, traders, logistics partners, packers, and future export-linked participants.",
                  "The company is based in Himachal Pradesh, a region where fruit cultivation is not just an agricultural activity but a way of life for thousands of families. eFruitMandi has been built from practical field experience, not only from a software idea. Its foundation comes from more than 14 years of practical fruit industry experience in orchard management, fruit production, grading, packing, post-harvest handling, and horticulture operations.",
                  "Along with this practical experience, the platform is backed by more than 5 years of focused research on the sale and purchase of fruits and vegetables. This research includes mandi systems, commission agent networks, buyer behavior, grower challenges, trader practices, logistics issues, price discovery, payment risks, supply chain gaps, and digital marketplace opportunities.",
                  "eFruitMandi is designed to help growers present fruit lots in a structured way, buyers discover available fruit consignments, and logistics partners support movement where required. The platform focuses on listings, quotations, deal records, KYC, payment references, delivery support, dispute records, and trust-building features like OG Verified and Trusted Badge.",
                  "Orchard Growers Private Limited created eFruitMandi with a long-term vision to modernize fruit trade without disconnecting it from real-world mandi practices. The platform does not claim to replace every existing relationship in the fruit industry. Instead, it creates a digital layer where information can be recorded, verified, compared, and managed more clearly.",
                  "In India's fruit trade, growers often face challenges such as limited buyer reach, uncertain price discovery, dependence on local networks, transport delays, payment risk, quality disputes, and lack of digital records. Buyers also face challenges in finding reliable growers, verifying quality, understanding packing standards, and coordinating logistics. eFruitMandi has been developed to reduce these gaps through a structured marketplace process.",
                  "The platform supports multiple fruit categories, including apple, mango, pear, plum, persimmon, pomegranate, grapes, and other seasonal fruits. The goal is to build an all-India digital fruit mandi network where fruit growers and buyers can connect before physical movement of produce begins.",
                  "eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing. Final commercial decisions remain between growers and buyers. The platform helps organize the process, document important activity, and support transparency.",
                  "The company believes that Indian fruit growers need better access to buyers, better documentation, stronger trust systems, and practical technology that works for real agricultural conditions. eFruitMandi has therefore been built around simple user flows, mobile-first access, PWA functionality, KYC verification, listing tools, quotation systems, and support processes.",
                  "The long-term objective is to create a trusted national fruit marketplace where growers can list produce before going to mandi, buyers can review lots before committing, logistics partners can coordinate movement, and support teams can review records when disputes arise.",
                  "eFruitMandi also supports the idea that technology should not remove human negotiation from fruit trade. Fruit quality, grade, packing, timing, and market demand can vary widely. Therefore, the platform keeps direct grower-buyer decision-making at the center while improving the information available to both sides.",
                  "Orchard Growers Private Limited is committed to building eFruitMandi as a serious AgriTech platform for India. The company aims to support growers, buyers, logistics providers, commission agents, exporters, and related stakeholders through digital tools that are practical, transparent, and field-informed."
            ]
      },
      {
            "title": "Business details",
            "bullets": [
                  "Company: ${business.company}",
                  "Platform: ${business.platform}",
                  "Domain: ${business.domain}",
                  "Registered address: ${business.address}",
                  "Legal jurisdiction: ${business.jurisdiction}"
            ]
      },
      {
            "title": "Important marketplace note",
            "body": [
                  "eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing."
            ]
      }
],
  }),


  story: page({
    route: "/our-story",
    eyebrow: "Company",
    title: "Our Story",
    description:
      "Read the story behind eFruitMandi, created from orchard experience, fruit industry research, mandi observations, and the need for a trusted digital fruit marketplace in India.",
    intro:
      "eFruitMandi was created from practical fruit industry experience and years of research on fruit and vegetable sale, purchase, mandi systems, buyer networks, and supply chain gaps.",
    sections: [
      {
            "title": "How eFruitMandi started",
            "body": [
                  "The story of eFruitMandi begins in the orchards and fruit-growing regions of Himachal Pradesh. It did not begin as a simple app idea or a generic marketplace concept. It grew from years of direct observation, practical fruit industry experience, and continuous study of how fruits and vegetables are actually sold, purchased, transported, negotiated, and settled in Indian markets.",
                  "The founder's background includes more than 14 years of practical experience in the fruit industry, including orchard management, fruit production, grading, packing, post-harvest handling, and horticulture operations. This experience created a close understanding of what fruit growers face during every season: weather uncertainty, harvesting pressure, packing decisions, labour availability, transport timing, buyer negotiation, price fluctuation, and payment concerns.",
                  "Over time, it became clear that many growers produce good quality fruit but do not always receive the best market access or transparent price information. Many growers still depend on limited buyer networks or traditional mandi channels. These systems have their own importance, but they also create challenges when information is incomplete, records are weak, and communication happens informally.",
                  "Alongside field experience, more than 5 years were spent studying fruit and vegetable sale and purchase systems. This included observing mandi behavior, commission agent roles, buyer requirements, trader networks, logistics arrangements, price discovery methods, payment cycles, and quality disputes. The study showed that the problem was not only price. The bigger issue was lack of structured information, verified trust, transparent records, and reliable digital coordination.",
                  "eFruitMandi was created to address these practical challenges. The goal was not to build a platform that ignores existing mandi culture. Instead, the goal was to create a digital fruit marketplace layer that can support growers, buyers, commission agents, logistics partners, and exporters with better records and wider visibility.",
                  "Fresh fruit is different from many other products. It is perishable, grade-sensitive, season-dependent, region-specific, and highly affected by time. A delay of one or two days can change value. Poor packing can affect quality. Weak communication can create disputes. Missing records can make payment settlement difficult. eFruitMandi was built with these realities in mind.",
                  "The platform therefore focuses on fruit lot listings, grade-wise information, packing details, location, media, quotations, deal records, KYC, support references, logistics coordination, and dispute documentation. These are not random features. They are based on real problems seen in fruit trade.",
                  "The vision behind eFruitMandi is also national. Although the platform has strong roots in Himachal Pradesh and orchard-growing regions, it is not limited to apples or one state. India has a large fruit economy, including mango, pear, plum, persimmon, pomegranate, grapes, citrus, banana, and many other fruits. eFruitMandi aims to serve the wider fruit industry across India.",
                  "The story is also about trust. In agricultural trade, trust is everything. Buyers want confidence in growers and produce. Growers want confidence in buyers and payments. Logistics partners need clear routes and settlement references. eFruitMandi uses KYC, OG Verified, Trusted Badge, structured records, and support processes to strengthen that trust.",
                  "The company understands that digital adoption in agriculture takes time. Many users are comfortable with phone calls, WhatsApp, local agents, and personal relationships. eFruitMandi does not reject those practices. Instead, it gives them a more organized digital backbone so that important information is not lost.",
                  "The long-term journey of eFruitMandi is to move from local fruit listing support to a wider digital fruit market network. The platform can support pre-mandi price discovery, buyer discovery, grower onboarding, logistics coordination, verified profiles, market communication, and eventually stronger export-linked opportunities.",
                  "This story is still developing. eFruitMandi is being built step by step, with learning from growers, buyers, market participants, and real operational feedback. The aim is not only to launch a website, but to build a trusted digital institution for India's fruit trade ecosystem."
            ]
      },
      {
            "title": "Marketplace facilitation approach",
            "body": [
                  "eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing."
            ]
      }
],
  }),


  visionMission: page({
    route: "/vision-mission",
    eyebrow: "Company",
    title: "Vision & Mission",
    description:
      "The eFruitMandi vision and mission for transparent, trusted, digital, and efficient fruit marketplace operations across India.",
    intro:
      "Our vision and mission are centered on grower empowerment, buyer trust, logistics clarity, market transparency, documentation, KYC, OG Verified trust systems, and practical technology.",
    sections: [
      {
            "title": "Vision and mission",
            "body": [
                  "The vision of eFruitMandi is to support a transparent, trusted, and efficient digital fruit marketplace for India. The platform aims to help growers, buyers, logistics partners, commission agents, traders, exporters, and other fruit industry stakeholders connect through better information, stronger documentation, and practical digital tools.",
                  "India's fruit industry has huge potential. The country produces many categories of fruits across different climatic zones, including apples in hill states, mangoes in many regions, pears, plums, persimmons, pomegranates, grapes, citrus fruits, and other seasonal produce. Despite this strength, many growers still face market access limitations, weak price discovery, payment uncertainty, and fragmented buyer networks.",
                  "eFruitMandi's vision is to reduce these gaps by creating a marketplace where fruit lots can be listed before physical movement, buyers can review produce information in a structured format, logistics partners can support movement, and support teams can review records when required.",
                  "The mission of eFruitMandi is practical. The platform is not built around theory alone. It is built on more than 14 years of fruit industry experience and more than 5 years of research on the sale and purchase of fruits and vegetables. This combination of field knowledge and market study helps the platform focus on real needs.",
                  "The first mission is to empower growers. Growers should be able to present their fruit lots with grade, quantity, packing, location, images, videos, and other important details. They should not remain dependent only on limited local networks. A grower should have a digital identity, KYC record, and marketplace presence.",
                  "The second mission is to support buyers. Buyers need reliable information before making quotations or finalizing deals. eFruitMandi helps buyers review listings, understand available fruit lots, communicate interest, and create documented quotation records.",
                  "The third mission is to improve trust. Trust is central to fruit trade. KYC, OG Verified, Trusted Badge, support records, dispute references, and clear platform policies help build confidence between participants.",
                  "The fourth mission is to support logistics coordination. Fruit movement requires timing, route clarity, vehicle coordination, labour, loading, unloading, and settlement references. eFruitMandi supports logistics details where applicable so that delivery records are clearer.",
                  "The fifth mission is to create transparent records. In many fruit transactions, disputes arise because important details were not recorded properly. eFruitMandi supports structured records for listings, quotations, deals, payments, delivery, and support issues.",
                  "The sixth mission is to help modernize fruit marketing in India. Digital tools can make the system more efficient, but they must be simple enough for real users. eFruitMandi is therefore built as a mobile-first, practical platform with PWA functionality and future mobile app direction.",
                  "The seventh mission is to support all-India expansion. The platform is not limited to one fruit or one region. It aims to become useful for fruit growers and buyers across states, markets, and fruit categories.",
                  "The eighth mission is to support future export readiness. Indian fruits have domestic and export potential, but export-linked trade requires stronger quality, packing, traceability, documentation, and verified participants. eFruitMandi can gradually support this direction.",
                  "The platform's operating principle is clear: eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing. Final deal decisions remain between grower and buyer. The platform supports information, records, trust, and process clarity.",
                  "The long-term vision is to make eFruitMandi a trusted digital fruit mandi network where growers can list before going to mandi, buyers can discover produce before committing capital, logistics partners can coordinate movement, and market participants can work with more confidence."
            ]
      },
      {
            "title": "Core operating principles",
            "bullets": [
                  "The platform does not promise any sale, rate, profit, or final outcome.",
                  "Final deal decisions are between grower and buyer.",
                  "Fruit is perishable, so policies depend on consignment status and operational confirmation.",
                  "KYC and OG Verified are trust-building tools, not absolute guarantees."
            ]
      }
],
  }),


  why: page({
    route: "/why-efruitmandi",
    eyebrow: "Company",
    title: "Why eFruitMandi",
    description:
      "Understand why eFruitMandi is useful for fruit growers, buyers, logistics partners, commission agents, traders, exporters, and India's fruit supply chain.",
    intro:
      "eFruitMandi is designed for practical fruit trade realities where growers need wider reach, buyers need reliable information, logistics needs coordination, and all parties need better trust records.",
    sections: [
      {
            "title": "Why choose eFruitMandi",
            "body": [
                  "eFruitMandi is needed because India's fruit trade is large, valuable, and full of opportunity, but still faces many practical challenges. Growers produce fruit with hard work over many months, but when the selling season arrives, they often face limited buyer reach, uncertain rates, transport pressure, quality disputes, and payment concerns.",
                  "The platform is different because it has been designed from real fruit industry experience. It is backed by more than 14 years of practical experience in orchard management, fruit production, grading, packing, post-harvest handling, and horticulture operations. It is also supported by more than 5 years of research on sale and purchase systems of fruits and vegetables.",
                  "Many digital platforms fail because they do not understand ground realities. Fruit trade is not like selling a fixed factory product. Fruit quality changes by grade, size, color, maturity, packing, season, weather, transport time, and market demand. eFruitMandi is designed with this complexity in mind.",
                  "For growers, eFruitMandi provides a way to create structured fruit lot listings. A grower can present fruit details, quantity, grade, packing, location, photos, videos, and other information. This creates better visibility and helps buyers review produce before direct communication or quotation.",
                  "For buyers, eFruitMandi provides organized access to fruit listings. Instead of depending only on scattered calls or informal references, buyers can review available lots, compare details, and share quotations through a documented platform process.",
                  "For logistics partners, the platform supports delivery-related records where they are appointed through the grower or seller side. Fruit transport needs clarity because delay, route confusion, or poor coordination can damage value.",
                  "For commission agents and market-linked participants, eFruitMandi can become a digital communication layer. The platform does not need to remove existing mandi systems. It can make them more transparent, searchable, and documented.",
                  "One major reason to choose eFruitMandi is trust. The platform includes KYC and optional OG Verified / Trusted Badge features. These systems help build confidence between growers and buyers. In future, verified profiles can become important for serious fruit trade and export-linked opportunities.",
                  "Another reason is documentation. In traditional systems, many discussions happen verbally. When disputes arise, users may not have clear records. eFruitMandi supports listing records, quotation records, deal references, payment references, delivery details, and support history.",
                  "Another reason is price discovery. Before going to mandi or finalizing a deal, growers need better market communication. eFruitMandi can help growers understand buyer interest and possible market demand. The platform does not promise any fixed sale or price, but it improves information flow.",
                  "Another reason is scalability. India needs a fruit marketplace that can work across states and categories. eFruitMandi is not only for apple growers. It is designed for apples, mangoes, pears, plums, persimmons, pomegranates, grapes, and other fruits across India.",
                  "Another reason is future readiness. The fruit industry is moving toward digital payments, verified sellers, traceability, quality documentation, logistics tracking, and online buyer discovery. eFruitMandi is being built in that direction with PWA functionality, future mobile app plans, KYC, support systems, and structured marketplace workflows.",
                  "eFruitMandi is also important because it is founder-led with real industry understanding. The platform is not only a technical product. It is connected to orchard experience, grower problems, mandi observations, buyer behavior, and supply chain realities.",
                  "The platform also respects human decision-making. Fruit trade depends on negotiation, inspection, timing, and trust. eFruitMandi does not remove these elements. It helps users manage them better.",
                  "In simple terms, eFruitMandi is needed because growers need better reach, buyers need better information, logistics needs coordination, and the fruit industry needs stronger digital trust."
            ]
      },
      {
            "title": "Useful for",
            "bullets": [
                  "Fruit growers and orchard owners",
                  "Fruit buyers and bulk purchasers",
                  "Commission agents and mandi-linked participants",
                  "Fruit traders and exporters",
                  "Logistics partners and delivery coordinators",
                  "Packing, grading, and support service providers"
            ]
      },
      {
            "title": "Important marketplace note",
            "body": [
                  "eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing."
            ]
      }
],
  }),


  contact: page({
    route: "/contact",
    eyebrow: "Support",
    title: "Contact Us",
    description:
      "Contact eFruitMandi support for account, KYC, listing, quotation, payment, delivery, dispute, OG Verified, or marketplace help.",
    intro:
      "Use the official contact details below for eFruitMandi support requests, marketplace questions, payment follow-up, KYC help, OG Verified support, or reporting a problem.",
    sections: [
      {
            "title": "Contact eFruitMandi",
            "body": [
                  "eFruitMandi support is available for growers, buyers, logistics partners, and marketplace users who need help with account access, registration, KYC, fruit listings, quotations, deal records, payment references, delivery coordination, support requests, or dispute-related information.",
                  "Users can contact eFruitMandi through the official email, phone, WhatsApp number, and website details provided on this page. While contacting support, users should provide their registered name, registered mobile number or email address, platform role, and the relevant listing, quotation, deal, payment, delivery, KYC, or support reference.",
                  "For grower support, users may contact eFruitMandi for help with profile creation, KYC submission, fruit lot listing, grade information, packing details, media upload, quotation review, OG Verified process, Trusted Badge information, and support records.",
                  "For buyer support, users may contact eFruitMandi for help with account registration, KYC, listing review, quotation submission, deal references, payment process questions, buyer verification, and support escalation.",
                  "For logistics partner support, users may contact eFruitMandi regarding delivery details, vehicle information, route references, settlement references, and delivery-related support where logistics coordination is applicable.",
                  "For payment or settlement support, users should share clear reference details, screenshots, transaction information, and deal references. eFruitMandi can review platform records and guide the next step based on available information and applicable policies.",
                  "For disputes, users should share complete details, including photos, videos, screenshots, call details, listing information, quotation references, delivery information, and payment details. Fruit quality, grade, rate, and consignment matters are generally between grower and buyer, but eFruitMandi can review platform records and assist with support information where possible.",
                  "For urgent safety, unlawful detention, threat, fraud, or serious legal matters, users should contact local authorities first. eFruitMandi support can assist with platform records but does not replace law enforcement, courts, or legal authorities.",
                  "Official support should be contacted only through verified eFruitMandi channels. Users should avoid sharing OTP, passwords, bank credentials, or sensitive documents with unauthorized persons."
            ]
      },
      {
            "title": "Support channels",
            "bullets": [
                  "Email: ${business.email}",
                  "Phone and WhatsApp: ${business.phone}",
                  "Website: ${business.domain}",
                  "Registered address: ${business.address}"
            ]
      },
      {
            "title": "What to include",
            "bullets": [
                  "Your registered name and phone number or email.",
                  "Your role: Grower, Buyer, or Logistics Partner.",
                  "Relevant listing, quotation, deal, payment, delivery, or KYC reference.",
                  "Clear screenshots, photos, documents, or delivery details where available."
            ]
      }
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
      "Complete buyer guide for eFruitMandi covering fruit sourcing, buyer quotations, rate discovery, mandi terminology, Phad, Boli, Ladani, Commission Agent, Parcha, Bilty, fruit grading, packing, logistics, KYC, payment safety, and buyer responsibilities.",
    intro:
      "eFruitMandi helps fruit buyers, wholesalers, traders, commission agents, exporters, retailers, processing units, and bulk fruit buyers discover fruit lots directly from growers and orchard owners. This buyer guide explains how to use the platform, understand traditional fruit mandi terminology, evaluate produce quality, share quotations, coordinate logistics, and complete safe fruit trade through mutual agreement.",
    sections: [
      {
        title: "What is eFruitMandi for Buyers?",
        body: [
          "eFruitMandi is a digital fruit marketplace and fruit trade facilitation platform by Orchard Growers Private Limited. It connects fruit buyers with fruit growers, orchard owners, fruit producers, traders, commission agents, logistics partners, and other market participants.",
          "For buyers, eFruitMandi helps discover available fruit lots, review fruit type, variety, grade, packing, estimated quantity, location, harvest stage, photos, videos, and grower details where available.",
          "The platform is useful for wholesale fruit buyers, fruit traders, commission agents, fruit shops, retail chains, exporters, processors, juice units, hotels, institutional buyers, and anyone sourcing fruit in bulk.",
          "eFruitMandi does not force any buyer to purchase and does not force any grower to sell. Final trade depends on mutual agreement between buyer and grower regarding rate, quantity, grade, packing, logistics, payment, and delivery conditions."
        ],
      },
      {
        title: "Who can register as a Buyer?",
        body: [
          "A buyer on eFruitMandi may be an individual trader, fruit wholesaler, fruit and vegetable commission agent, Ladani, retailer, exporter, processor, institutional buyer, supermarket buyer, hotel supplier, juice plant, cold store operator, or fruit procurement agency.",
          "Small buyers can use the platform to discover fruit lots and connect with growers. Large buyers can use it to source bulk fruit directly from growing regions, compare quality, review lot details, and plan procurement.",
          "Commission agents can also use eFruitMandi to discover fruit growers, understand market supply, coordinate with Ladanis, and improve digital visibility for fruit trade.",
          "The buyer guide is written for practical mandi users as well as new digital fruit buyers who want to understand fruit sourcing, mandi terms, fruit grading, packing, logistics, bilty, challan, parcha, and payment safety."
        ],
      },
      {
        title: "Important Mandi Terminology for Buyers",
        body: [
          "Traditional fruit mandis use many local words that are important for buyers to understand. eFruitMandi uses these terms to educate users and explain market practices in simple language.",
          "Phad (फड़) means the designated trading place inside a fruit mandi or APMC mandi where a commission agent manages trading activity between growers and buyers. In many mandis, fruit lots are displayed, discussed, quoted, or auctioned from the Phad.",
          "Boli (बोली) means the traditional price discovery process where buyers propose rates for a grower's produce. In English, it is often called auction, bidding, quote, quotation, or rate discovery.",
          "Ladani (लदानी) means a bulk fruit buyer. A Ladani usually buys fruit in large quantity and supplies it to other mandis, wholesalers, retailers, supermarkets, processing units, or export markets.",
          "Commission Agent means the middle person or mandi agent who helps connect growers and buyers, manages Phad activity, coordinates Boli, prepares records, and supports settlement in traditional mandi systems.",
          "Grower means the fruit producer, orchard owner, farmer, or supplier who grows fruits such as apple, mango, pear, plum, persimmon, pomegranate, grapes, citrus, peach, cherry, kiwi, or other produce.",
          "Parcha (पर्चा) is a mandi transaction slip or sale record. It may include fruit quantity, grade, rate, buyer name, seller name, commission, charges, and other trade details. In some regions, it is also called challan.",
          "Bilty (बिल्टी) is a transport document or consignment note used when goods are moved from one place to another. It helps track loaded goods, transport details, destination, and delivery record.",
          "Challan or Invoice is an official transaction document that records buyer, seller, quantity, price, tax, payment, and other commercial details where applicable."
        ],
      },
      {
        title: "Clarification about Auction, Boli, Bid, Quote and Rate Discovery",
        body: [
          "On eFruitMandi, words such as Auction, Boli, Bid, Quote, Quotation, Offer, and Rate Discovery may be used only to explain the traditional fruit mandi price discovery system.",
          "eFruitMandi is not a compulsory auction platform and does not create a forced sale. A quotation shared by a buyer is only a proposed rate or commercial interest.",
          "A final deal becomes meaningful only when the buyer and grower mutually agree on fruit quality, grade, rate, packing, quantity, loading, logistics, payment, and delivery terms.",
          "Buyers should not treat a quotation as automatic ownership of the fruit lot. Growers can accept, reject, negotiate, pause, update, or withdraw their listings depending on market situation and mutual understanding.",
          "This clarification is important because traditional mandi words like Boli, auction, Phad, commission agent, Ladani, parcha, and bilty are used for education and market communication, not for creating a forced transaction."
        ],
      },
      {
        title: "Getting started as a Buyer",
        steps: [
          "Create or log in to your eFruitMandi account.",
          "Create a buyer profile with correct name, mobile number, location, and business information.",
          "Complete free buyer KYC where required.",
          "Review available fruit lots carefully before sharing a quotation.",
          "Check fruit type, variety, grade, packing, quantity, location, harvest stage, photos, videos, and grower details.",
          "Share a realistic quotation based on quality, market demand, logistics cost, commission, labour, packing, and expected resale value.",
          "Finalize the deal only after mutual agreement with the grower."
        ],
      },
      {
        title: "How Buyers can find Fruit Lots",
        body: [
          "Buyers can search and review fruit lots listed by growers and orchard owners. A fruit lot may include apple, mango, pear, plum, persimmon, peach, cherry, pomegranate, grapes, citrus, kiwi, dry fruits, or other fruit categories.",
          "A good buyer should compare fruit lots based on location, variety, size, grade, packing, expected quantity, harvest date, transport feasibility, photos, and grower credibility.",
          "Bulk fruit buyers should also consider road distance, loading point, packing type, shelf life, market demand, delivery time, and risk of damage during transport.",
          "For example, an apple buyer may compare A grade, B grade, mixed grade, carton packing, orchard location, expected harvest date, transport route, and estimated mandi resale rate before sharing a quotation.",
          "A mango buyer may focus on variety, ripening stage, size, packing, distance, transit time, and damage risk. A pear buyer may focus on maturity, firmness, packing strength, and handling requirements."
        ],
      },
      {
        title: "Understanding Fruit Lot Information",
        bullets: [
          "Fruit type and variety such as apple, mango, pear, plum, persimmon, pomegranate, grapes, citrus, kiwi, peach, cherry, or dry fruits.",
          "Grade details such as A+, A, B+, B, C+, C, D, mixed grade, or ungraded fruit.",
          "Packing type such as carton, crate, tray pack, loose packing, wooden box, or export packing.",
          "Estimated quantity in boxes, crates, cartons, kilograms, quintals, or metric tons.",
          "Location of orchard, farm, packing point, cold store, collection center, or dispatch point.",
          "Photos and videos showing sample fruit quality, colour, size, bruising, disease marks, grading, and packing condition.",
          "Harvest stage and expected availability date.",
          "Logistics feasibility, loading point, road access, expected delivery time, and transport requirement."
        ],
      },
      {
        title: "Fruit Grading for Buyers",
        body: [
          "Fruit grading is the process of separating fruit according to size, colour, shape, maturity, appearance, damage, disease marks, bruising, and market quality.",
          "Buyers should never rely only on fruit name or variety. Grade, packing, photos, and sample quality matter strongly in wholesale fruit trade.",
          "A+ grade generally indicates premium fruit quality. A grade indicates good marketable quality. B+, B, C+, C, D, mixed grade, or ungraded fruit may be suitable for different markets, processing, juice, local sale, or lower price segments.",
          "Before finalizing a deal, buyers should clearly discuss grade percentage, mixed grade possibility, damaged fruit tolerance, packing standard, sample photos, and inspection process.",
          "In fruit trade, the same fruit name can have very different market value depending on grade. Apple A grade, mango export grade, pear premium grade, and processing grade fruit cannot be compared only by quantity."
        ],
      },
      {
        title: "Packing Guidelines for Buyers",
        body: [
          "Packing plays a major role in fruit safety, transport, resale value, and buyer satisfaction. Poor packing can damage even good quality fruit during loading, unloading, and long-distance transport.",
          "Buyers should confirm packing type, carton strength, crate quality, tray usage, fruit layering, ventilation, padding, weight per carton, branding, label details, and export or domestic market requirements.",
          "For long-distance fruit logistics, buyers should check whether the fruit requires normal transport, covered vehicle, refrigerated vehicle, cold chain, or quick dispatch.",
          "Packing standards may differ for apple, mango, pear, pomegranate, grapes, plum, persimmon, peach, cherry, citrus, and kiwi. Buyers should never assume that one packing method is suitable for every fruit."
        ],
      },
      {
        title: "Quotation Process for Buyers",
        steps: [
          "Review the fruit lot carefully.",
          "Check quality, grade, packing, location, quantity, harvest timing, and logistics feasibility.",
          "Estimate your buying rate after considering transport, labour, commission, loading, unloading, market demand, and expected resale price.",
          "Share a quotation or proposed rate through the available platform flow.",
          "Discuss final terms with the grower where required.",
          "Proceed only after mutual agreement and payment clarity.",
          "Keep records of quotation, final rate, quantity, grade, payment proof, bilty, challan, parcha, and delivery confirmation."
        ],
      },
      {
        title: "Payment Safety for Buyers",
        body: [
          "Buyers should maintain clear payment records for every transaction. Payment proof, invoices, challan, parcha, bilty, delivery confirmation, and communication history can help prevent disputes.",
          "Before making payment, buyers should verify grower details, lot information, fruit grade, packing, dispatch point, quantity, and agreed rate.",
          "If a buyer is purchasing through a commission agent, the buyer should also maintain records of commission, mandi charges, transport charges, labour charges, and settlement terms.",
          "Buyers should avoid unclear verbal deals, unrealistic rates, unknown parties without KYC, and transactions without proper documentation.",
          "KYC, OG Verified details where available, platform records, photos, videos, transaction slips, and transport documents can help build trust in digital fruit trade."
        ],
      },
      {
        title: "Logistics and Delivery for Buyers",
        body: [
          "Fruit logistics is time-sensitive because fruit quality can reduce due to delay, heat, poor handling, wrong stacking, overloading, rough transport, or weak packing.",
          "Buyers should confirm vehicle type, loading time, unloading location, driver contact, route, expected arrival, bilty, challan, transport charges, and responsibility for damage.",
          "Bilty is especially important in transport because it records movement of goods. Challan or invoice records commercial transaction details. Parcha may record mandi sale or transaction information.",
          "For delicate fruit, buyers should consider faster dispatch, careful loading, ventilation, temperature control, and proper unloading arrangements.",
          "Long-distance buyers should calculate transport cost, loading cost, unloading cost, wastage risk, transit loss, market arrival timing, and resale demand before finalizing the quotation."
        ],
      },
      {
        title: "Working with Growers",
        bullets: [
          "Communicate clearly and respectfully with fruit growers.",
          "Do not force unrealistic rates after the grower has shared quality details.",
          "Ask for photos, videos, grade details, packing information, and dispatch timing before finalizing.",
          "Do not hold a grower's consignment unlawfully.",
          "Make payment as per agreed terms.",
          "Raise disputes quickly with clear evidence.",
          "Understand that growers may accept, reject, negotiate, pause, update, or withdraw fruit listings before final agreement."
        ],
      },
      {
        title: "Working with Commission Agents and Ladanis",
        body: [
          "In traditional fruit mandis, commission agents and Ladanis play an important role in trade flow. A commission agent connects growers and buyers, while a Ladani usually buys fruit in bulk for resale or distribution.",
          "eFruitMandi helps bring this traditional fruit trade language into a digital format. Buyers, growers, commission agents, Ladanis, and logistics partners can understand each other's role more clearly.",
          "The aim is not to remove genuine market participants, but to make fruit trading more transparent, searchable, documented, and accessible.",
          "A fruit and vegetable commission agent may still play a role in local mandi trade, but digital documentation, KYC, buyer records, grower records, and logistics tracking can reduce confusion and improve trust."
        ],
      },
      {
        title: "Buyer Rights",
        bullets: [
          "Buyers have the right to review fruit lot details before quotation.",
          "Buyers have the right to ask for grade, packing, photos, quantity, and location clarity.",
          "Buyers have the right to negotiate before final agreement.",
          "Buyers have the right to receive agreed fruit quality and quantity as per confirmed deal terms.",
          "Buyers have the right to raise a dispute with evidence if quality, quantity, payment, or delivery terms are not followed.",
          "Buyers have the right to maintain and request relevant documents such as invoice, challan, bilty, parcha, and payment proof."
        ],
      },
      {
        title: "Buyer Responsibilities",
        bullets: [
          "Review fruit details carefully before finalizing.",
          "Keep payment and contact details accurate.",
          "Share realistic quotations based on actual market conditions.",
          "Do not misuse Boli, Bid, Quote, or Auction terminology to pressure growers.",
          "Do not hold a grower's consignment unlawfully.",
          "Maintain records such as payment proof, bilty, challan, parcha, invoice, photos, and communication history.",
          "Raise disputes quickly with clear evidence.",
          "Respect grower time, harvest risk, packing effort, labour cost, and logistics limitations."
        ],
      },
      {
        title: "Common mistakes Buyers should avoid",
        bullets: [
          "Do not quote rates without reviewing grade, packing, location, and logistics cost.",
          "Do not assume that all fruit in a lot is premium grade.",
          "Do not finalize deals only through verbal communication.",
          "Do not ignore bilty, challan, invoice, parcha, and payment proof.",
          "Do not delay pickup after confirming dispatch.",
          "Do not compare different grades as if they have the same market value.",
          "Do not treat eFruitMandi as a forced auction platform. Final trade depends on mutual agreement.",
          "Do not ignore transport time, weather, road condition, loading quality, and unloading arrangements."
        ],
      },
      
      {
        title: "Understanding Traditional Fruit Mandi System",
        body: [
          "India's fruit trade has traditionally operated through fruit mandis, wholesale markets, APMC mandis, commission agents, traders, Ladanis, transporters, and fruit growers.",
          "Understanding how fruit mandis work helps buyers evaluate quotations, compare fruit lots, understand market behaviour, and communicate effectively with growers, commission agents, and logistics partners.",
          "Traditional fruit trade uses terminology such as Phad (फड़), Boli (बोली), Ladani (लदानी), Commission Agent, Parcha (पर्चा), Bilty (बिल्टी), Challan, grading, packing, loading, unloading, and rate discovery.",
          "eFruitMandi preserves practical fruit mandi knowledge while helping buyers and growers use modern digital tools."
        ],
      },
      {
        title: "Role of Ladani in Fruit Trade",
        body: [
          "Ladani (लदानी) is a bulk fruit buyer who purchases fruit in large quantity and redistributes it to wholesalers, retailers, supermarkets, exporters, processors, cold stores, and other markets.",
          "Ladanis often evaluate grading, packing, transport cost, market demand, resale opportunities, shelf life, and logistics feasibility before procurement.",
          "Understanding Ladani operations helps buyers understand the wholesale fruit supply chain."
        ],
      },
      {
        title: "Role of Fruit Commission Agents",
        body: [
          "Fruit commission agents coordinate between growers and buyers and often help facilitate trade communication, market information, documentation, and transaction workflows.",
          "In many traditional fruit mandis, commission agents operate from a Phad where fruit lots are reviewed and commercial discussions take place.",
          "Common industry search terms include Fruit Commission Agent, Fruit and Vegetable Commission Agent, APMC Commission Agent, Fruit Market Agent, and Wholesale Fruit Agent."
        ],
      },
      {
        title: "Apple Buying Guide",
        body: [
          "Apple buyers should evaluate grading, size, colour, maturity, packing quality, storage history, transport distance, and market demand before procurement.",
          "Apple procurement decisions should be based on quality, packing, grading consistency, and commercial feasibility rather than variety name alone."
        ],
      },
      {
        title: "Mango Buying Guide",
        body: [
          "Mango buyers should review variety, maturity stage, sweetness, packing quality, transport duration, market demand, and destination requirements before finalizing procurement decisions."
        ],
      },
      {
        title: "Pear Buying Guide",
        body: [
          "Pear buyers should evaluate fruit firmness, grading consistency, maturity, packing quality, shelf life, and transportation requirements."
        ],
      },
      {
        title: "Export Fruit Procurement",
        body: [
          "Export-oriented fruit buyers often operate under stricter grading, packing, traceability, documentation, and logistics requirements than domestic markets.",
          "Export procurement planning should consider destination requirements, transit conditions, compliance expectations, and fruit quality standards."
        ],
      },
      {
        title: "Benefits of OG Verified and Trusted Buyer Status",
        body: [
          "Trust, transparency, documentation, responsible trade behaviour, and long-term business relationships are important for sustainable fruit trade.",
          "OG Verified and Trusted Buyer programs help improve confidence and professional communication between market participants."
        ],
      },


      {
        title: "Fruit Market Terminology Dictionary for Buyers",
        body: [
          "APMC means Agricultural Produce Market Committee. Many traditional fruit and vegetable mandis operate under local APMC market systems.",
          "Auction means a price discovery method. On eFruitMandi, auction, Boli, Bid, Quote, and Rate Discovery words are used only for market education and quotation understanding.",
          "Bilty (\u092c\u093f\u0932\u094d\u091f\u0940) means a transport document or consignment note used when fruit is dispatched from one location to another.",
          "Boli (\u092c\u094b\u0932\u0940) means the traditional price discovery process where buyers propose rates for fruit lots.",
          "Bulk Fruit Buyer means a buyer who purchases fruit in large quantity for resale, wholesale supply, retail chains, processing, or export.",
          "Challan means a transaction or dispatch document that may record buyer, seller, quantity, price, and movement details.",
          "Commission Agent means a mandi intermediary who coordinates between growers and buyers in traditional fruit markets.",
          "Fruit Grading means sorting fruit by size, colour, quality, maturity, appearance, damage, and market value.",
          "Fruit Lot means a listed quantity of fruit offered by a grower or supplier with details such as variety, grade, packing, quantity, and location.",
          "Fruit Packing means preparing fruit in cartons, crates, trays, or other packaging for safe transport and sale.",
          "Ladani (\u0932\u0926\u093e\u0928\u0940) means a bulk fruit buyer or wholesale fruit trader.",
          "Parcha (\u092a\u0930\u094d\u091a\u093e) means a mandi sale record or transaction slip used in fruit trade.",
          "Phad (\u092b\u0921\u093c) means the trading space inside a fruit mandi where commission agents coordinate trade activity.",
          "Quotation means a proposed buying rate shared by a buyer for a fruit lot.",
          "Rate Discovery means the process of finding a fair market rate through buyer interest, quotation, negotiation, or mandi price signals."
        ],
      },
      {
        title: "Buyer Case Studies and Practical Examples",
        body: [
          "Example 1: A wholesale apple buyer from Delhi reviews multiple apple lots from Himachal Pradesh. Instead of quoting only on fruit name, the buyer compares grade, carton quality, orchard location, dispatch timing, transport cost, and expected resale demand.",
          "Example 2: A mango buyer compares two mango lots. One has better variety but longer transport distance, while the other has slightly lower grade but faster delivery. The buyer calculates total landed cost before quotation.",
          "Example 3: A Ladani purchases mixed grade fruit for local wholesale markets. The buyer checks grading percentage, packing type, bilty, challan, loading arrangement, and payment terms before final agreement.",
          "Example 4: An export-focused buyer reviews fruit quality more strictly and asks for better grading, packing, traceability, and logistics planning before procurement."
        ],
      },
      {
        title: "Buyer Best Practices for Safe Fruit Procurement",
        bullets: [
          "Always compare grade, packing, quantity, location, and logistics cost before quotation.",
          "Ask for clear fruit photos and videos when available.",
          "Do not depend only on verbal communication.",
          "Maintain payment proof, bilty, challan, parcha, invoice, and delivery records.",
          "Understand the difference between quotation and final agreement.",
          "Check whether the fruit is suitable for wholesale, retail, processing, export, or local sale.",
          "Respect grower time, harvest risk, packing effort, and transport limitations.",
          "Use KYC, OG Verified details, and platform records to improve trust."
        ],
      },

{
        title: "Buyer FAQs",
        body: [
          "Is eFruitMandi an auction platform? No. eFruitMandi uses auction, Boli, quote, bid, and rate discovery only to explain price discovery. It is not a compulsory auction or forced sale platform.",
          "Who is a Ladani? A Ladani is a bulk fruit buyer who purchases fruit in large quantity for wholesale trade, other mandis, retail chains, processing units, or export markets.",
          "What is Phad? Phad is the designated trading space in a mandi where commission agents manage trading activity between growers and buyers.",
          "What is Boli? Boli is the traditional price discovery process where buyers propose rates for a grower's produce.",
          "What is Parcha? Parcha is a mandi transaction slip or sale record containing quantity, grade, rate, buyer, seller, and trade details.",
          "What is Bilty? Bilty is a transport document or consignment note used when fruit is dispatched from one place to another.",
          "Can buyers negotiate rates? Yes. Buyers and growers may negotiate before final agreement.",
          "Can a buyer reject a lot? A buyer should review and discuss quality before finalization. Rejection after agreement should be handled only as per evidence, terms, and dispute process.",
          "Is KYC required for buyers? Buyer KYC may be required for trust, safety, payment clarity, and dispute handling.",
          "What should buyers check before payment? Buyers should check grower details, fruit grade, packing, quantity, location, dispatch timing, bilty, challan, and agreed terms.",
          "Can commission agents use eFruitMandi? Yes. Fruit and vegetable commission agents can use eFruitMandi to improve discovery, market communication, and digital trade coordination.",
          "Can exporters use eFruitMandi? Yes. Exporters can use eFruitMandi to discover fruit lots, review quality, packing, location, and grower information where available."
        ],
      },
    ],
  }),

  growerGuide: page({
    route: "/grower-guide",
    eyebrow: "Help Center",
    title: "Grower Guide",
    description:
      "Complete grower guide for eFruitMandi covering fruit lot listing, buyer quotations, rate discovery, mandi terminology, grading, packing, logistics, KYC, OG Verified trust badge, payment safety, and grower rights.",
    intro:
      "eFruitMandi helps fruit growers and orchard owners list produce, receive buyer quotations, compare market interest, and complete fruit trade through mutual agreement. This guide explains mandi terms such as Phad, Boli, Ladani, Parcha, Bilty, Commission Agent, grading, packing, and fruit lots.",
    sections: [
      {
        title: "What is eFruitMandi for Growers?",
        body: [
          "eFruitMandi is a digital fruit marketplace and fruit trade facilitation platform by Orchard Growers Private Limited. It connects fruit growers, orchard owners, fruit producers, bulk fruit buyers, traders, commission agents, logistics partners, and market participants.",
          "For growers, eFruitMandi helps create fruit lot listings with fruit type, variety, grade, packing, expected quantity, location, harvest stage, and sample photos. Buyers can review the lot and share quotations or proposed rates.",
          "The final deal depends on mutual agreement between grower and buyer. Listing fruit on eFruitMandi does not force the grower to sell.",
        ],
      },
      {
        title: "Important clarification about Auction, Boli, Quote and Rate Discovery",
        body: [
          "On eFruitMandi, words such as Auction, Boli, Bid, Quotation, Quote, or Rate Discovery may be used only to explain the traditional fruit mandi price discovery concept. eFruitMandi is not a compulsory auction or forced sale platform.",
          "In offline mandi systems, Boli or auction often means that fruit is offered through a commission agent and rate is discovered through buyers. eFruitMandi works differently because the grower can accept, reject, negotiate, pause, update, or withdraw a listing.",
          "A transaction becomes meaningful only when grower and buyer mutually agree on rate, quantity, grade, packing, logistics, payment terms, and delivery conditions.",
        ],
      },
      {
        title: "Getting started as a Grower",
        steps: [
          "Create or log in to your eFruitMandi account.",
          "Create a grower profile with correct name, mobile number, location, orchard details, and business information where required.",
          "Complete free grower KYC.",
          "Add orchard, farm, packing hall, or consignment location accurately.",
          "Upload clear fruit photos, grade-wise sample images, and lot details.",
          "Keep profile and listing information updated during harvest, packing, loading, and delivery stages.",
        ],
      },
      {
        title: "Fruit mandi terminology for growers",
        body: [
          "Phad: Phad is the trading space in a fruit or vegetable mandi where a commission agent coordinates trade discussion, Boli, rate discovery, and buyer-grower dealing.",
          "Boli: Boli means price discovery or rate discussion. On eFruitMandi, Boli does not mean compulsory auction. It means buyer quote and grower-buyer negotiation.",
          "Commission Agent: A commission agent coordinates offline mandi trade between growers and buyers and may handle rate discussion, sale record, payment follow-up, and mandi documentation.",
          "Ladani: Ladani means bulk fruit buyer who buys fruit in large quantity for wholesale, retail, mandi, export, processing, or distribution.",
          "Grower: A grower means fruit producer, orchard owner, farmer, bagwan, producer group, or seller of apple, mango, pear, plum, persimmon, pomegranate, grapes, citrus, cherry, peach, almond, or other fruit.",
          "Parcha: Parcha is a mandi sale slip or transaction record containing quantity, rate, buyer, seller, grade, packing, and trade details.",
          "Bilty: Bilty is a goods transport document used during fruit consignment movement. It records vehicle, transporter, route, dispatch, and destination details.",
          "Challan or Invoice: Challan or invoice is an official transaction document containing buyer, seller, quantity, rate, payment, and trade details.",
        ],
      },
      {
        title: "Creating a strong fruit lot listing",
        bullets: [
          "Use accurate fruit name, variety, grade, packing, quantity, and location details.",
          "Mention grade-wise quantity such as A+, A, B+, B, C+, C, D, ungraded, mixed grade, premium grade, table fruit, processing grade, or juice grade.",
          "Upload clear grade-wise sample photos and videos.",
          "Mention packing type such as carton, crate, wooden box, tray pack, loose packing, export packing, or local mandi packing.",
          "Add pickup location, farm location, packing hall location, nearest road point, and loading point correctly.",
          "Update listing if fruit is sold offline, partially sold, damaged, delayed, repacked, or withdrawn.",
        ],
      },
      {
        title: "Fruit grading, packing and buyer trust",
        body: [
          "Fruit grading is important for buyer trust. Buyers compare fruits based on size, color, maturity, shine, firmness, taste, defects, disease marks, bruising, and packing quality.",
          "Growers should not mix high-grade and low-grade fruit without disclosure. If a lot has multiple grades, mention grade-wise quantity clearly.",
          "Good packing protects fruit during loading, transport, unloading, and delivery. Strong packing can reduce damage and improve buyer confidence.",
        ],
      },
      {
        title: "Grower rights and consignment control",
        body: [
          "The grower remains free to accept or reject buyer quotations. Listing fruit on eFruitMandi does not make it compulsory to sell through the platform.",
          "If the grower does not receive a satisfactory rate, the grower may wait, update the listing, negotiate, withdraw the lot, sell offline, move fruit to another mandi, or choose another buyer.",
          "If a dispute cannot be resolved mutually, the grower has the right to withdraw or take back the consignment and may move it to another buyer, another market, or offline mandi, subject to applicable platform policies and already accepted deal terms.",
        ],
      },
      {
        title: "KYC, OG Verified and trust building",
        body: [
          "Grower KYC on eFruitMandi is free and helps create basic trust for buyers.",
          "OG Verified or Trusted Badge is different from basic KYC. KYC supports identity trust, while OG Verified may support higher trust, quality review, orchard verification, and marketplace credibility.",
          "A complete profile with KYC, correct photos, accurate location, proper grading, and transparent listing information can improve buyer confidence.",
        ],
      },
      {
        title: "Payment, logistics and documentation",
        body: [
          "Before confirming a deal, growers should understand payment mode, payment timing, platform process, transport responsibility, loading charges, labour charges, delivery point, and documentation requirements.",
          "Important documents may include Parcha, Challan, Invoice, Bill, Bilty, delivery note, consignment record, buyer confirmation, and payment record.",
          "Vehicle number, driver details, dispatch time, route, delivery location, and receiver details should be kept clear wherever possible.",
        ],
      },
      {
        title: "Offline Mandi vs eFruitMandi Digital Marketplace",
        body: [
          "In an offline fruit mandi, growers often depend on a local mandi, phad, commission agent, and available buyers on that day. The final rate may depend on arrival volume, demand, buyer presence, fruit quality, and negotiation strength.",
          "eFruitMandi helps growers create digital visibility before moving fruit. A grower can list fruit lots online, receive buyer quotations, compare interest, and decide whether the offered rate is suitable.",
          "This does not remove the importance of offline mandis. Instead, eFruitMandi gives growers an additional digital option for market communication, buyer discovery, and rate comparison.",
        ],
      },
      {
        title: "Pre-harvest planning for better fruit marketing",
        body: [
          "Growers should plan fruit marketing before harvest begins. Good planning includes expected harvest date, fruit variety, grade estimation, packing material, labour arrangement, transport access, and buyer communication.",
          "For apple growers, mango growers, pear growers, plum growers, persimmon growers, pomegranate growers, grape growers, and citrus growers, early planning can reduce distress selling and improve buyer confidence.",
          "A well-prepared grower can share accurate photos, quantity estimates, grading details, and dispatch timeline with buyers before the fruit reaches the mandi.",
        ],
      },
      {
        title: "Post-harvest handling and quality protection",
        body: [
          "Post-harvest handling directly affects fruit price. Rough harvesting, poor sorting, weak packing, overloading, moisture damage, heat exposure, and delayed transport can reduce buyer confidence and final value.",
          "Growers should keep fruits clean, sorted, shaded, and properly packed. Damaged, diseased, bruised, undersized, overripe, or mixed-grade fruit should be disclosed clearly in the listing.",
          "Transparent post-harvest handling improves trust between grower and buyer and reduces disputes after delivery.",
        ],
      },
      {
        title: "Fruit-wise grower guidance",
        body: [
          "Apple growers should mention variety, size grade, color percentage, carton packing, location, harvest date, and whether the fruit is table grade, premium grade, mixed grade, or processing grade.",
          "Mango growers should mention variety, maturity stage, ripening condition, packing type, weight, harvest date, and whether the mango is suitable for table, wholesale, export, or processing use.",
          "Pear, plum, peach, cherry, persimmon, pomegranate, grape, citrus, and other fruit growers should mention variety, firmness, maturity, shelf life, packing, grade, and dispatch timeline clearly.",
        ],
      },
      {
        title: "Commission agent, direct buyer and digital deal comparison",
        body: [
          "A commission agent can be useful in traditional mandi systems because the agent understands buyers, phad operations, local mandi practice, parcha, payment follow-up, and rate movement.",
          "A direct buyer or Ladani may buy in bulk and may offer faster movement when quality, quantity, packing, and logistics match their requirement.",
          "eFruitMandi creates a digital layer where growers can receive buyer interest, understand rate discovery, compare quotations, and then decide whether to deal through platform communication, offline mandi, commission agent, or another buyer option.",
        ],
      },
      {
        title: "How growers can improve SEO visibility of their fruit listings",
        body: [
          "A good fruit listing should use clear searchable words such as apple grower, mango grower, pear grower, fruit lot, bulk fruit supply, orchard fresh fruit, mandi rate, fruit buyer, fruit trader, and fruit packing.",
          "Growers should avoid vague titles. Instead of writing only fresh fruit available, use specific details such as fresh apple lot from Himachal Pradesh, mango lot for bulk buyers, pear grower supply, or premium pomegranate lot.",
          "Clear listing titles, accurate descriptions, location details, fruit variety, grade, packing, and photos help buyers find the right produce faster.",
        ],
      },
      {
        title: "Common mistakes growers should avoid",
        bullets: [
          "Do not upload old or misleading fruit photos.",
          "Do not hide grade mixing, bruising, disease marks, or packing problems.",
          "Do not list unrealistic quantity if the fruit is not ready.",
          "Do not confirm dispatch without payment clarity and buyer confirmation.",
          "Do not depend only on verbal communication; keep records, photos, videos, bilty, challan, parcha, and payment proof.",
          "Do not treat eFruitMandi as a forced auction platform. Final trade depends on mutual agreement.",
        ],
           },
      {
        title: "Understanding Traditional Fruit Mandi System for Growers",
        body: [
          "India's fruit trade has traditionally operated through fruit mandis, wholesale markets, APMC mandis, commission agents, traders, Ladanis, transporters, and fruit growers.",
          "Understanding how traditional fruit mandis work helps growers make better decisions regarding fruit grading, packing, quotations, logistics, and buyer selection.",
          "Traditional fruit trade uses terminology such as Phad (फड़), Boli (बोली), Ladani (लदानी), Commission Agent, Parcha (पर्चा), Bilty (बिल्टी), Challan, grading, packing, loading, unloading, and rate discovery."
        ],
      },
      {
        title: "Role of Ladani from a Grower Perspective",
        body: [
          "A Ladani (लदानी) is usually a bulk fruit buyer who purchases fruit in large quantities and supplies it to wholesale markets, retailers, processors, exporters, and other trade channels.",
          "Understanding Ladani requirements can help growers improve grading, packing, consistency, and logistics planning."
        ],
      },
      {
        title: "Fruit Market Terminology Dictionary for Growers",
        body: [
          "Phad (फड़) means the trading space inside a fruit mandi.",
          "Boli (बोली) means the traditional rate discovery process.",
          "Ladani (लदानी) means a bulk fruit buyer.",
          "Parcha (पर्चा) means a mandi transaction slip.",
          "Bilty (बिल्टी) means a transport document."
        ],
      },
      {
        title: "Apple Grower Guide",
        body: [
          "Apple growers should provide clear information about variety, grade, size, colour percentage, carton packing, harvest date, orchard location, expected quantity, and dispatch timeline.",
          "For apple buyers, details such as A grade, B grade, mixed grade, premium grade, table grade, processing grade, carton quality, storage condition, and transport feasibility are important.",
          "Apple growers from Himachal Pradesh, Jammu and Kashmir, Uttarakhand, and other apple growing regions can improve buyer confidence by sharing recent photos, grade-wise samples, packing details, and realistic quantity.",
          "A good apple lot listing should clearly mention whether the fruit is suitable for wholesale trade, retail sale, cold storage, processing, export, or direct market supply."
        ],
      },
      {
        title: "Mango Grower Guide",
        body: [
          "Mango growers should mention variety, maturity stage, ripening condition, fruit size, packing type, harvest date, estimated quantity, location, and dispatch readiness.",
          "Different mango varieties serve different markets such as wholesale mandis, retail chains, pulp processing units, exporters, and direct fruit buyers.",
          "Clear information about maturity, sweetness, packing, transport time, and shelf life helps mango buyers make better quotations.",
          "Mango growers should avoid uploading old photos or unclear quality information because mango trade is highly sensitive to ripening stage and transit timing."
        ],
      },
      {
        title: "Pear Grower Guide",
        body: [
          "Pear growers should share information about variety, firmness, size, colour, maturity, packing, grade, quantity, location, and dispatch timeline.",
          "Pear quality can be affected by rough handling, weak packing, delayed transport, and poor loading. Therefore, growers should maintain packing clarity and transport coordination.",
          "Buyers usually compare pear lots based on firmness, uniformity, grade, shelf life, packing strength, and distance from market.",
          "Clear documentation and sample photos can reduce disputes and improve buyer trust."
        ],
      },
      {
        title: "Export-Oriented Grower Guide",
        body: [
          "Export-oriented fruit growers may need stricter grading, packing, documentation, traceability, quality control, and logistics planning than normal domestic fruit trade.",
          "Export buyers may ask for uniform size, better packing, specific maturity level, residue awareness, orchard details, dispatch records, and transport planning.",
          "Growers who want to supply export markets should maintain detailed records of orchard practices, harvest date, grade-wise packing, buyer communication, challan, invoice, bilty, and dispatch details.",
          "Export readiness depends on buyer requirement, destination market, quality standard, packing method, logistics route, and compliance expectations."
        ],
      },
      {
        title: "How Growers can Build Long-Term Buyer Trust",
        bullets: [
          "Share honest fruit quality information.",
          "Keep grade-wise photos and videos ready.",
          "Mention real quantity and realistic dispatch date.",
          "Avoid hiding bruising, disease marks, grade mixing, or packing weakness.",
          "Maintain bilty, challan, parcha, invoice, and payment records.",
          "Communicate clearly before loading and dispatch.",
          "Update listing if fruit is sold offline or quantity changes.",
          "Respect buyer inspection, logistics timing, and payment clarity."
        ],
      },
      {
        title: "Grower SEO Keywords and Listing Signals",
        body: [
          "Growers can improve digital discovery by using clear listing words such as apple grower in Himachal Pradesh, mango grower in India, pear grower supply, bulk fruit lot, fresh fruit from orchard, fruit packing, fruit grading, fruit mandi rate, wholesale fruit buyer, Ladani, and fruit trader.",
          "A listing with fruit type, variety, grade, packing, location, quantity, harvest date, and clear photos is more useful than a vague listing with only fruit name.",
          "Searchable and accurate listings help eFruitMandi connect growers with relevant buyers, commission agents, Ladanis, exporters, wholesalers, and logistics partners."
        ],
      },

      {
        title: "Grower FAQs",
        body: [
          "Is eFruitMandi an auction platform? No. eFruitMandi uses auction, Boli, quote, and rate discovery only to explain price discovery. It is not a compulsory auction or forced sale platform.",
          "Can I reject a buyer quotation? Yes. A grower can reject a quotation if the rate, buyer, payment terms, logistics, or deal conditions are not suitable.",
          "Can I sell fruit offline after listing? Yes, unless you have already accepted a specific deal under platform terms. If fruit is sold offline, update or remove the listing.",
          "What is Phad? Phad is the trading space in mandi where commission agents coordinate trade between growers and buyers.",
          "Who is Ladani? Ladani is a bulk fruit buyer who purchases fruit in large quantity.",
          "What is Bilty? Bilty is a goods transport document used during movement of fruit consignments.",
          "What is Parcha? Parcha is a mandi sale slip or transaction record.",
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






