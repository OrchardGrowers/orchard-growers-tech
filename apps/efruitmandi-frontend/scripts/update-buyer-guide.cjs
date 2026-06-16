const fs = require("fs");

const file = "src/data/staticPages.js";
const original = fs.readFileSync(file, "utf8");

fs.writeFileSync(`${file}.buyer-guide.full.bak`, original);

const start = original.indexOf("  buyerGuide: page({");
const end = original.indexOf("  growerGuide: page({", start);

if (start === -1 || end === -1) {
  throw new Error("buyerGuide or growerGuide block not found");
}

const buyerGuide = `  buyerGuide: page({
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
          "Phad or ??? means the designated trading place inside a fruit mandi or APMC mandi where a commission agent manages trading activity between growers and buyers. In many mandis, fruit lots are displayed, discussed, quoted, or auctioned from the Phad.",
          "Boli or ???? means the traditional price discovery process where buyers propose rates for a grower's produce. In English, it is often called auction, bidding, quote, quotation, or rate discovery.",
          "Ladani or ????? means a bulk fruit buyer. A Ladani usually buys fruit in large quantity and supplies it to other mandis, wholesalers, retailers, supermarkets, processing units, or export markets.",
          "Commission Agent means the middle person or mandi agent who helps connect growers and buyers, manages Phad activity, coordinates Boli, prepares records, and supports settlement in traditional mandi systems.",
          "Grower means the fruit producer, orchard owner, farmer, or supplier who grows fruits such as apple, mango, pear, plum, persimmon, pomegranate, grapes, citrus, peach, cherry, kiwi, or other produce.",
          "Parcha or ????? is a mandi transaction slip or sale record. It may include fruit quantity, grade, rate, buyer name, seller name, commission, charges, and other trade details. In some regions, it is also called challan.",
          "Bilty or ?????? is a transport document or consignment note used when goods are moved from one place to another. It helps track loaded goods, transport details, destination, and delivery record.",
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
  }),`;

const updated = original.slice(0, start) + buyerGuide + "\n\n" + original.slice(end);

fs.writeFileSync(file, updated);

console.log("Buyer Guide replaced successfully.");
console.log("Backup created:", `${file}.buyer-guide.full.bak`);
