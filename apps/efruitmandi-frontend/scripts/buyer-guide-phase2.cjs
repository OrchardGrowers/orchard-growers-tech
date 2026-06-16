const fs = require("fs");

const file = "src/data/staticPages.js";
let content = fs.readFileSync(file,"utf8");

const marker = `{
        title: "Buyer FAQs",`;

const phase2 = `
      {
        title: "Understanding Traditional Fruit Mandi System",
        body: [
          "India's fruit trade has traditionally operated through fruit mandis, wholesale markets, APMC mandis, commission agents, traders, Ladanis, transporters, and fruit growers.",
          "Understanding how fruit mandis work helps buyers evaluate quotations, compare fruit lots, understand market behaviour, and communicate effectively with growers, commission agents, and logistics partners.",
          "Traditional fruit trade uses terminology such as Phad (???), Boli (????), Ladani (?????), Commission Agent, Parcha (?????), Bilty (??????), Challan, grading, packing, loading, unloading, and rate discovery.",
          "eFruitMandi preserves practical fruit mandi knowledge while helping buyers and growers use modern digital tools."
        ],
      },
      {
        title: "Role of Ladani in Fruit Trade",
        body: [
          "Ladani (?????) is a bulk fruit buyer who purchases fruit in large quantity and redistributes it to wholesalers, retailers, supermarkets, exporters, processors, cold stores, and other markets.",
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

`;

content = content.replace(marker, phase2 + marker);

fs.writeFileSync(file, content);

console.log("Buyer Guide Phase 2 inserted successfully.");
