const fs = require("fs");

const file = "src/data/staticPages.js";
let content = fs.readFileSync(file, "utf8");

fs.writeFileSync(`${file}.buyer-guide-phase3.bak`, content);

const marker = `{
        title: "Buyer FAQs",`;

const phase3 = `
      {
        title: "Fruit Market Terminology Dictionary for Buyers",
        body: [
          "APMC means Agricultural Produce Market Committee. Many traditional fruit and vegetable mandis operate under local APMC market systems.",
          "Auction means a price discovery method. On eFruitMandi, auction, Boli, Bid, Quote, and Rate Discovery words are used only for market education and quotation understanding.",
          "Bilty (\\u092c\\u093f\\u0932\\u094d\\u091f\\u0940) means a transport document or consignment note used when fruit is dispatched from one location to another.",
          "Boli (\\u092c\\u094b\\u0932\\u0940) means the traditional price discovery process where buyers propose rates for fruit lots.",
          "Bulk Fruit Buyer means a buyer who purchases fruit in large quantity for resale, wholesale supply, retail chains, processing, or export.",
          "Challan means a transaction or dispatch document that may record buyer, seller, quantity, price, and movement details.",
          "Commission Agent means a mandi intermediary who coordinates between growers and buyers in traditional fruit markets.",
          "Fruit Grading means sorting fruit by size, colour, quality, maturity, appearance, damage, and market value.",
          "Fruit Lot means a listed quantity of fruit offered by a grower or supplier with details such as variety, grade, packing, quantity, and location.",
          "Fruit Packing means preparing fruit in cartons, crates, trays, or other packaging for safe transport and sale.",
          "Ladani (\\u0932\\u0926\\u093e\\u0928\\u0940) means a bulk fruit buyer or wholesale fruit trader.",
          "Parcha (\\u092a\\u0930\\u094d\\u091a\\u093e) means a mandi sale record or transaction slip used in fruit trade.",
          "Phad (\\u092b\\u0921\\u093c) means the trading space inside a fruit mandi where commission agents coordinate trade activity.",
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

`;

if (!content.includes(marker)) {
  throw new Error("Buyer FAQs marker not found");
}

if (!content.includes("Fruit Market Terminology Dictionary for Buyers")) {
  content = content.replace(marker, phase3 + marker);
} else {
  console.log("Phase 3 dictionary already exists. Skipping duplicate insert.");
}

fs.writeFileSync(file, content);
console.log("Buyer Guide Phase 3 inserted successfully.");
console.log("Backup created:", `${file}.buyer-guide-phase3.bak`);
