const fs = require("fs");

const file = "src/data/staticPages.js";
let content = fs.readFileSync(file, "utf8");

fs.writeFileSync(`${file}.grower-guide-phase4.bak`, content);

const marker = `      {
        title: "Grower FAQs",`;

const phase4 = `      {
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

`;

if (!content.includes(marker)) {
  throw new Error("Grower FAQs marker not found");
}

if (!content.includes("Apple Grower Guide")) {
  content = content.replace(marker, phase4 + marker);
} else {
  console.log("Grower Guide Phase 4 already exists. Skipping duplicate insert.");
}

fs.writeFileSync(file, content);
console.log("Grower Guide Phase 4 inserted successfully.");
console.log("Backup created:", `${file}.grower-guide-phase4.bak`);
