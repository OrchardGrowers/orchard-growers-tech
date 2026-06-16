const fs = require("fs");

const file = "src/data/staticPages.js";

const facilitatorText = "eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing.";
let text = fs.readFileSync(file, "utf8");

const longAbout = `eFruitMandi is a digital fruit marketplace facilitation platform operated by Orchard Growers Private Limited. The platform has been created for India's fresh fruit ecosystem, including fruit growers, orchard owners, buyers, commission agents, traders, logistics partners, packers, and future export-linked participants.

The company is based in Himachal Pradesh, a region where fruit cultivation is not just an agricultural activity but a way of life for thousands of families. eFruitMandi has been built from practical field experience, not only from a software idea. Its foundation comes from more than 14 years of practical fruit industry experience in orchard management, fruit production, grading, packing, post-harvest handling, and horticulture operations.

Along with this practical experience, the platform is backed by more than 5 years of focused research on the sale and purchase of fruits and vegetables. This research includes mandi systems, commission agent networks, buyer behavior, grower challenges, trader practices, logistics issues, price discovery, payment risks, supply chain gaps, and digital marketplace opportunities.

eFruitMandi is designed to help growers present fruit lots in a structured way, buyers discover available fruit consignments, and logistics partners support movement where required. The platform focuses on listings, quotations, deal records, KYC, payment references, delivery support, dispute records, and trust-building features like OG Verified and Trusted Badge.

Orchard Growers Private Limited created eFruitMandi with a long-term vision to modernize fruit trade without disconnecting it from real-world mandi practices. The platform does not claim to replace every existing relationship in the fruit industry. Instead, it creates a digital layer where information can be recorded, verified, compared, and managed more clearly.

In India's fruit trade, growers often face challenges such as limited buyer reach, uncertain price discovery, dependence on local networks, transport delays, payment risk, quality disputes, and lack of digital records. Buyers also face challenges in finding reliable growers, verifying quality, understanding packing standards, and coordinating logistics. eFruitMandi has been developed to reduce these gaps through a structured marketplace process.

The platform supports multiple fruit categories, including apple, mango, pear, plum, persimmon, pomegranate, grapes, and other seasonal fruits. The goal is to build an all-India digital fruit mandi network where fruit growers and buyers can connect before physical movement of produce begins.

eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing. Final commercial decisions remain between growers and buyers. The platform helps organize the process, document important activity, and support transparency.

The company believes that Indian fruit growers need better access to buyers, better documentation, stronger trust systems, and practical technology that works for real agricultural conditions. eFruitMandi has therefore been built around simple user flows, mobile-first access, PWA functionality, KYC verification, listing tools, quotation systems, and support processes.

The long-term objective is to create a trusted national fruit marketplace where growers can list produce before going to mandi, buyers can review lots before committing, logistics partners can coordinate movement, and support teams can review records when disputes arise.

eFruitMandi also supports the idea that technology should not remove human negotiation from fruit trade. Fruit quality, grade, packing, timing, and market demand can vary widely. Therefore, the platform keeps direct grower-buyer decision-making at the center while improving the information available to both sides.

Orchard Growers Private Limited is committed to building eFruitMandi as a serious AgriTech platform for India. The company aims to support growers, buyers, logistics providers, commission agents, exporters, and related stakeholders through digital tools that are practical, transparent, and field-informed.`;

const longStory = `The story of eFruitMandi begins in the orchards and fruit-growing regions of Himachal Pradesh. It did not begin as a simple app idea or a generic marketplace concept. It grew from years of direct observation, practical fruit industry experience, and continuous study of how fruits and vegetables are actually sold, purchased, transported, negotiated, and settled in Indian markets.

The founder's background includes more than 14 years of practical experience in the fruit industry, including orchard management, fruit production, grading, packing, post-harvest handling, and horticulture operations. This experience created a close understanding of what fruit growers face during every season: weather uncertainty, harvesting pressure, packing decisions, labour availability, transport timing, buyer negotiation, price fluctuation, and payment concerns.

Over time, it became clear that many growers produce good quality fruit but do not always receive the best market access or transparent price information. Many growers still depend on limited buyer networks or traditional mandi channels. These systems have their own importance, but they also create challenges when information is incomplete, records are weak, and communication happens informally.

Alongside field experience, more than 5 years were spent studying fruit and vegetable sale and purchase systems. This included observing mandi behavior, commission agent roles, buyer requirements, trader networks, logistics arrangements, price discovery methods, payment cycles, and quality disputes. The study showed that the problem was not only price. The bigger issue was lack of structured information, verified trust, transparent records, and reliable digital coordination.

eFruitMandi was created to address these practical challenges. The goal was not to build a platform that ignores existing mandi culture. Instead, the goal was to create a digital fruit marketplace layer that can support growers, buyers, commission agents, logistics partners, and exporters with better records and wider visibility.

Fresh fruit is different from many other products. It is perishable, grade-sensitive, season-dependent, region-specific, and highly affected by time. A delay of one or two days can change value. Poor packing can affect quality. Weak communication can create disputes. Missing records can make payment settlement difficult. eFruitMandi was built with these realities in mind.

The platform therefore focuses on fruit lot listings, grade-wise information, packing details, location, media, quotations, deal records, KYC, support references, logistics coordination, and dispute documentation. These are not random features. They are based on real problems seen in fruit trade.

The vision behind eFruitMandi is also national. Although the platform has strong roots in Himachal Pradesh and orchard-growing regions, it is not limited to apples or one state. India has a large fruit economy, including mango, pear, plum, persimmon, pomegranate, grapes, citrus, banana, and many other fruits. eFruitMandi aims to serve the wider fruit industry across India.

The story is also about trust. In agricultural trade, trust is everything. Buyers want confidence in growers and produce. Growers want confidence in buyers and payments. Logistics partners need clear routes and settlement references. eFruitMandi uses KYC, OG Verified, Trusted Badge, structured records, and support processes to strengthen that trust.

The company understands that digital adoption in agriculture takes time. Many users are comfortable with phone calls, WhatsApp, local agents, and personal relationships. eFruitMandi does not reject those practices. Instead, it gives them a more organized digital backbone so that important information is not lost.

The long-term journey of eFruitMandi is to move from local fruit listing support to a wider digital fruit market network. The platform can support pre-mandi price discovery, buyer discovery, grower onboarding, logistics coordination, verified profiles, market communication, and eventually stronger export-linked opportunities.

This story is still developing. eFruitMandi is being built step by step, with learning from growers, buyers, market participants, and real operational feedback. The aim is not only to launch a website, but to build a trusted digital institution for India's fruit trade ecosystem.`;

const longVision = `The vision of eFruitMandi is to support a transparent, trusted, and efficient digital fruit marketplace for India. The platform aims to help growers, buyers, logistics partners, commission agents, traders, exporters, and other fruit industry stakeholders connect through better information, stronger documentation, and practical digital tools.

India's fruit industry has huge potential. The country produces many categories of fruits across different climatic zones, including apples in hill states, mangoes in many regions, pears, plums, persimmons, pomegranates, grapes, citrus fruits, and other seasonal produce. Despite this strength, many growers still face market access limitations, weak price discovery, payment uncertainty, and fragmented buyer networks.

eFruitMandi's vision is to reduce these gaps by creating a marketplace where fruit lots can be listed before physical movement, buyers can review produce information in a structured format, logistics partners can support movement, and support teams can review records when required.

The mission of eFruitMandi is practical. The platform is not built around theory alone. It is built on more than 14 years of fruit industry experience and more than 5 years of research on the sale and purchase of fruits and vegetables. This combination of field knowledge and market study helps the platform focus on real needs.

The first mission is to empower growers. Growers should be able to present their fruit lots with grade, quantity, packing, location, images, videos, and other important details. They should not remain dependent only on limited local networks. A grower should have a digital identity, KYC record, and marketplace presence.

The second mission is to support buyers. Buyers need reliable information before making quotations or finalizing deals. eFruitMandi helps buyers review listings, understand available fruit lots, communicate interest, and create documented quotation records.

The third mission is to improve trust. Trust is central to fruit trade. KYC, OG Verified, Trusted Badge, support records, dispute references, and clear platform policies help build confidence between participants.

The fourth mission is to support logistics coordination. Fruit movement requires timing, route clarity, vehicle coordination, labour, loading, unloading, and settlement references. eFruitMandi supports logistics details where applicable so that delivery records are clearer.

The fifth mission is to create transparent records. In many fruit transactions, disputes arise because important details were not recorded properly. eFruitMandi supports structured records for listings, quotations, deals, payments, delivery, and support issues.

The sixth mission is to help modernize fruit marketing in India. Digital tools can make the system more efficient, but they must be simple enough for real users. eFruitMandi is therefore built as a mobile-first, practical platform with PWA functionality and future mobile app direction.

The seventh mission is to support all-India expansion. The platform is not limited to one fruit or one region. It aims to become useful for fruit growers and buyers across states, markets, and fruit categories.

The eighth mission is to support future export readiness. Indian fruits have domestic and export potential, but export-linked trade requires stronger quality, packing, traceability, documentation, and verified participants. eFruitMandi can gradually support this direction.

The platform's operating principle is clear: eFruitMandi is a marketplace facilitation platform. It does not directly own, buy, sell, transport, grade, or insure fruit unless separately stated in writing. Final deal decisions remain between grower and buyer. The platform supports information, records, trust, and process clarity.

The long-term vision is to make eFruitMandi a trusted digital fruit mandi network where growers can list before going to mandi, buyers can discover produce before committing capital, logistics partners can coordinate movement, and market participants can work with more confidence.`;

const longWhy = `eFruitMandi is needed because India's fruit trade is large, valuable, and full of opportunity, but still faces many practical challenges. Growers produce fruit with hard work over many months, but when the selling season arrives, they often face limited buyer reach, uncertain rates, transport pressure, quality disputes, and payment concerns.

The platform is different because it has been designed from real fruit industry experience. It is backed by more than 14 years of practical experience in orchard management, fruit production, grading, packing, post-harvest handling, and horticulture operations. It is also supported by more than 5 years of research on sale and purchase systems of fruits and vegetables.

Many digital platforms fail because they do not understand ground realities. Fruit trade is not like selling a fixed factory product. Fruit quality changes by grade, size, color, maturity, packing, season, weather, transport time, and market demand. eFruitMandi is designed with this complexity in mind.

For growers, eFruitMandi provides a way to create structured fruit lot listings. A grower can present fruit details, quantity, grade, packing, location, photos, videos, and other information. This creates better visibility and helps buyers review produce before direct communication or quotation.

For buyers, eFruitMandi provides organized access to fruit listings. Instead of depending only on scattered calls or informal references, buyers can review available lots, compare details, and share quotations through a documented platform process.

For logistics partners, the platform supports delivery-related records where they are appointed through the grower or seller side. Fruit transport needs clarity because delay, route confusion, or poor coordination can damage value.

For commission agents and market-linked participants, eFruitMandi can become a digital communication layer. The platform does not need to remove existing mandi systems. It can make them more transparent, searchable, and documented.

One major reason to choose eFruitMandi is trust. The platform includes KYC and optional OG Verified / Trusted Badge features. These systems help build confidence between growers and buyers. In future, verified profiles can become important for serious fruit trade and export-linked opportunities.

Another reason is documentation. In traditional systems, many discussions happen verbally. When disputes arise, users may not have clear records. eFruitMandi supports listing records, quotation records, deal references, payment references, delivery details, and support history.

Another reason is price discovery. Before going to mandi or finalizing a deal, growers need better market communication. eFruitMandi can help growers understand buyer interest and possible market demand. The platform does not promise any fixed sale or price, but it improves information flow.

Another reason is scalability. India needs a fruit marketplace that can work across states and categories. eFruitMandi is not only for apple growers. It is designed for apples, mangoes, pears, plums, persimmons, pomegranates, grapes, and other fruits across India.

Another reason is future readiness. The fruit industry is moving toward digital payments, verified sellers, traceability, quality documentation, logistics tracking, and online buyer discovery. eFruitMandi is being built in that direction with PWA functionality, future mobile app plans, KYC, support systems, and structured marketplace workflows.

eFruitMandi is also important because it is founder-led with real industry understanding. The platform is not only a technical product. It is connected to orchard experience, grower problems, mandi observations, buyer behavior, and supply chain realities.

The platform also respects human decision-making. Fruit trade depends on negotiation, inspection, timing, and trust. eFruitMandi does not remove these elements. It helps users manage them better.

In simple terms, eFruitMandi is needed because growers need better reach, buyers need better information, logistics needs coordination, and the fruit industry needs stronger digital trust.`;

const longContact = `eFruitMandi support is available for growers, buyers, logistics partners, and marketplace users who need help with account access, registration, KYC, fruit listings, quotations, deal records, payment references, delivery coordination, support requests, or dispute-related information.

Users can contact eFruitMandi through the official email, phone, WhatsApp number, and website details provided on this page. While contacting support, users should provide their registered name, registered mobile number or email address, platform role, and the relevant listing, quotation, deal, payment, delivery, KYC, or support reference.

For grower support, users may contact eFruitMandi for help with profile creation, KYC submission, fruit lot listing, grade information, packing details, media upload, quotation review, OG Verified process, Trusted Badge information, and support records.

For buyer support, users may contact eFruitMandi for help with account registration, KYC, listing review, quotation submission, deal references, payment process questions, buyer verification, and support escalation.

For logistics partner support, users may contact eFruitMandi regarding delivery details, vehicle information, route references, settlement references, and delivery-related support where logistics coordination is applicable.

For payment or settlement support, users should share clear reference details, screenshots, transaction information, and deal references. eFruitMandi can review platform records and guide the next step based on available information and applicable policies.

For disputes, users should share complete details, including photos, videos, screenshots, call details, listing information, quotation references, delivery information, and payment details. Fruit quality, grade, rate, and consignment matters are generally between grower and buyer, but eFruitMandi can review platform records and assist with support information where possible.

For urgent safety, unlawful detention, threat, fraud, or serious legal matters, users should contact local authorities first. eFruitMandi support can assist with platform records but does not replace law enforcement, courts, or legal authorities.

Official support should be contacted only through verified eFruitMandi channels. Users should avoid sharing OTP, passwords, bank credentials, or sensitive documents with unauthorized persons.`;

const makePage = (key, route, eyebrow, title, description, intro, sections) => `
  ${key}: page({
    route: "${route}",
    eyebrow: "${eyebrow}",
    title: "${title}",
    description:
      "${description}",
    intro:
      "${intro}",
    sections: ${JSON.stringify(sections, null, 6)},
  }),`;

const replacements = {
  about: makePage("about", "/about", "Company", "About Us",
    "Learn about eFruitMandi, a digital fruit marketplace facilitation platform by Orchard Growers Private Limited for growers, buyers, logistics partners, traders, and fruit industry stakeholders in India.",
    "eFruitMandi is built to support India's fruit trade with structured listings, quotations, KYC, OG Verified trust systems, logistics records, and digital marketplace tools.",
    [
      { title: "About eFruitMandi", body: longAbout.split("\n\n") },
      { title: "Business details", bullets: [`Company: ${'${business.company}'}`, `Platform: ${'${business.platform}'}`, `Domain: ${'${business.domain}'}`, `Registered address: ${'${business.address}'}`, `Legal jurisdiction: ${'${business.jurisdiction}'}`] },
      { title: "Important marketplace note", body: [facilitatorText] },
    ]
  ),
  story: makePage("story", "/our-story", "Company", "Our Story",
    "Read the story behind eFruitMandi, created from orchard experience, fruit industry research, mandi observations, and the need for a trusted digital fruit marketplace in India.",
    "eFruitMandi was created from practical fruit industry experience and years of research on fruit and vegetable sale, purchase, mandi systems, buyer networks, and supply chain gaps.",
    [
      { title: "How eFruitMandi started", body: longStory.split("\n\n") },
      { title: "Marketplace facilitation approach", body: [facilitatorText] },
    ]
  ),
  visionMission: makePage("visionMission", "/vision-mission", "Company", "Vision & Mission",
    "The eFruitMandi vision and mission for transparent, trusted, digital, and efficient fruit marketplace operations across India.",
    "Our vision and mission are centered on grower empowerment, buyer trust, logistics clarity, market transparency, documentation, KYC, OG Verified trust systems, and practical technology.",
    [
      { title: "Vision and mission", body: longVision.split("\n\n") },
      { title: "Core operating principles", bullets: ["The platform does not promise any sale, rate, profit, or final outcome.", "Final deal decisions are between grower and buyer.", "Fruit is perishable, so policies depend on consignment status and operational confirmation.", "KYC and OG Verified are trust-building tools, not absolute guarantees."] },
    ]
  ),
  why: makePage("why", "/why-efruitmandi", "Company", "Why eFruitMandi",
    "Understand why eFruitMandi is useful for fruit growers, buyers, logistics partners, commission agents, traders, exporters, and India's fruit supply chain.",
    "eFruitMandi is designed for practical fruit trade realities where growers need wider reach, buyers need reliable information, logistics needs coordination, and all parties need better trust records.",
    [
      { title: "Why choose eFruitMandi", body: longWhy.split("\n\n") },
      { title: "Useful for", bullets: ["Fruit growers and orchard owners", "Fruit buyers and bulk purchasers", "Commission agents and mandi-linked participants", "Fruit traders and exporters", "Logistics partners and delivery coordinators", "Packing, grading, and support service providers"] },
      { title: "Important marketplace note", body: [facilitatorText] },
    ]
  ),
  contact: makePage("contact", "/contact", "Support", "Contact Us",
    "Contact eFruitMandi support for account, KYC, listing, quotation, payment, delivery, dispute, OG Verified, or marketplace help.",
    "Use the official contact details below for eFruitMandi support requests, marketplace questions, payment follow-up, KYC help, OG Verified support, or reporting a problem.",
    [
      { title: "Contact eFruitMandi", body: longContact.split("\n\n") },
      { title: "Support channels", bullets: [`Email: ${'${business.email}'}`, `Phone and WhatsApp: ${'${business.phone}'}`, `Website: ${'${business.domain}'}`, `Registered address: ${'${business.address}'}`] },
      { title: "What to include", bullets: ["Your registered name and phone number or email.", "Your role: Grower, Buyer, or Logistics Partner.", "Relevant listing, quotation, deal, payment, delivery, or KYC reference.", "Clear screenshots, photos, documents, or delivery details where available."] },
    ]
  ),
};

function replacePageBlock(source, key, replacement) {
  const start = source.indexOf(`  ${key}: page({`);
  if (start === -1) throw new Error(`Start not found for ${key}`);

  let i = start;
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;

    if (depth === 0 && source.slice(i, i + 2) === "),") {
      return source.slice(0, start) + replacement + source.slice(i + 2);
    }
  }

  throw new Error(`End not found for ${key}`);
}

for (const [key, block] of Object.entries(replacements)) {
  text = replacePageBlock(text, key, block);
}

fs.writeFileSync(file, text);
console.log("Company pages expanded successfully.");





