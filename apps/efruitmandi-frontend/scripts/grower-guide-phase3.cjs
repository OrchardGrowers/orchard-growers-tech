const fs = require("fs");

const file = "src/data/staticPages.js";
let content = fs.readFileSync(file,"utf8");

fs.writeFileSync(`${file}.grower-guide-phase3.bak`, content);

const marker = `{
        title: "Grower FAQs",`;

const phase3 = `
      {
        title: "Understanding Traditional Fruit Mandi System for Growers",
        body: [
          "India's fruit trade has traditionally operated through fruit mandis, wholesale markets, APMC mandis, commission agents, traders, Ladanis, transporters, and fruit growers.",
          "Understanding how traditional fruit mandis work helps growers make better decisions regarding fruit grading, packing, quotations, logistics, and buyer selection.",
          "Traditional fruit trade uses terminology such as Phad (फड़), Boli (बोली), Ladani (लदानी), Commission Agent, Parcha (पर्चा), Bilty (बिल्टी), Challan, grading, packing, loading, unloading, and rate discovery.",
          "eFruitMandi preserves traditional fruit market knowledge while helping growers use modern digital tools for visibility and trade communication."
        ],
      },
      {
        title: "Role of Ladani from a Grower Perspective",
        body: [
          "A Ladani (लदानी) is usually a bulk fruit buyer who purchases fruit in large quantities and supplies it to wholesale markets, retailers, processors, exporters, and other trade channels.",
          "Understanding Ladani requirements can help growers improve grading, packing, consistency, and logistics planning.",
          "Many successful fruit growers build long-term relationships with reliable Ladanis and wholesale buyers."
        ],
      },
      {
        title: "Role of Fruit Commission Agents",
        body: [
          "Fruit and vegetable commission agents have traditionally played an important role in fruit mandis by coordinating communication between growers and buyers.",
          "Commission agents often manage Phad activity, market communication, documentation, and transaction coordination in traditional market systems.",
          "Understanding how commission agents operate helps growers evaluate different marketing options."
        ],
      },
      {
        title: "Fruit Market Terminology Dictionary for Growers",
        body: [
          "Phad (फड़) means the trading space inside a fruit mandi where commercial discussions and trade coordination take place.",
          "Boli (बोली) means the traditional rate discovery process where buyers propose rates for available fruit.",
          "Ladani (लदानी) means a bulk fruit buyer or wholesale fruit trader.",
          "Parcha (पर्चा) means a mandi transaction slip or sale record.",
          "Bilty (बिल्टी) means a transport document or consignment note used during movement of fruit consignments.",
          "Commission Agent means a market intermediary who coordinates trade activity between growers and buyers.",
          "Fruit Grading means classification of fruit according to quality, size, colour, appearance, and market suitability.",
          "Fruit Packing means preparing fruit for transport, storage, wholesale trade, retail sale, or export."
        ],
      },
      {
        title: "Grower Best Practices for Better Market Results",
        bullets: [
          "Maintain accurate fruit grading records.",
          "Use clear and recent fruit photos.",
          "Describe packing type honestly.",
          "Mention realistic quantity and availability.",
          "Keep harvest timing updated.",
          "Maintain bilty, challan, parcha, invoice, and payment records.",
          "Communicate clearly with buyers and logistics partners.",
          "Understand the difference between quotation and final agreement."
        ],
      },
      {
        title: "Grower Case Studies and Practical Examples",
        body: [
          "Example 1: An apple grower improves buyer response by adding clear grading, carton details, variety information, and orchard photos.",
          "Example 2: A mango grower receives better quotations after improving fruit packing and dispatch planning.",
          "Example 3: A pear grower reduces disputes by clearly documenting grade percentage, packing condition, and transport details before dispatch.",
          "Example 4: A grower builds long-term relationships with wholesale buyers by maintaining consistent quality and transparent communication."
        ],
      },

`;

if (!content.includes(marker)) {
  throw new Error("Grower FAQs marker not found");
}

if (!content.includes("Understanding Traditional Fruit Mandi System for Growers")) {
  content = content.replace(marker, phase3 + marker);
}

fs.writeFileSync(file, content);

console.log("Grower Guide Phase 3 inserted successfully.");
console.log("Backup created:", `${file}.grower-guide-phase3.bak`);
