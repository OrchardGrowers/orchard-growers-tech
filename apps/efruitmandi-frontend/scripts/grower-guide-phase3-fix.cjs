const fs = require("fs");

const file = "src/data/staticPages.js";
let content = fs.readFileSync(file, "utf8");

const marker = 'title: "Grower FAQs"';

const phase3 = `
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

`;

const faqPos = content.indexOf(marker);

if (faqPos === -1) {
  throw new Error("Grower FAQs title not found");
}

content =
  content.slice(0, faqPos - 8) +
  phase3 +
  content.slice(faqPos - 8);

fs.writeFileSync(file, content);

console.log("Grower Guide Phase 3 inserted successfully.");
