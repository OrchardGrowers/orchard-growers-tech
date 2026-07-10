const fs = require("fs");

const file = "src/data/staticPages.js";
const original = fs.readFileSync(file, "utf8");
const newline = original.includes("\r\n") ? "\r\n" : "\n";

const sectionTitle = 'title: "Packing Checkpoints for Buyers",';
const replacementBody = [
  "Packing should be checked before finalizing any fruit lot because it directly affects fruit safety, transport loss, resale value, and buyer satisfaction. Even good quality fruit can lose value if it is packed in weak cartons, overloaded crates, poor trays, or unsuitable transport packing.",
  "Packing checklist: confirm packing type, carton or crate strength, tray usage, fruit layering, ventilation, padding, box weight, grade marking, lot label, branding where applicable, and whether the packing is suitable for the agreed destination market.",
  "Transport Requirements: buyers should confirm whether the fruit needs normal transport, covered vehicle, refrigerated vehicle, cold chain movement, quick dispatch, extra ventilation, careful stacking, or special handling during loading and unloading.",
  "Fruit-specific packing needs may differ for apple, mango, pear, pomegranate, grapes, plum, persimmon, peach, cherry, citrus, and kiwi. Buyers should not assume one packing method is suitable for every fruit, every grade, or every transport distance.",
  "Buyer Note: ask for clear packing photos or videos before dispatch, confirm the final packed quantity and weight, and keep packing details recorded with the quotation, invoice, challan, bilty, or delivery confirmation.",
];

const findMatching = (source, openIndex, openChar, closeChar) => {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const titleIndex = original.indexOf(sectionTitle);
if (titleIndex === -1) {
  throw new Error('"Packing Checkpoints for Buyers" section not found');
}

const sectionStart = original.lastIndexOf("{", titleIndex);
const sectionEnd = sectionStart === -1 ? -1 : findMatching(original, sectionStart, "{", "}");
if (sectionStart === -1 || sectionEnd === -1) {
  throw new Error('"Packing Checkpoints for Buyers" section boundaries not found');
}

const bodyIndex = original.indexOf("body:", titleIndex);
if (bodyIndex === -1 || bodyIndex > sectionEnd) {
  throw new Error('"Packing Checkpoints for Buyers" body array not found');
}

const bodyArrayStart = original.indexOf("[", bodyIndex);
const bodyArrayEnd =
  bodyArrayStart === -1 ? -1 : findMatching(original, bodyArrayStart, "[", "]");
if (bodyArrayStart === -1 || bodyArrayEnd === -1 || bodyArrayEnd > sectionEnd) {
  throw new Error('"Packing Checkpoints for Buyers" body array boundaries not found');
}

const lineStart = original.lastIndexOf(newline, bodyIndex) + newline.length;
const bodyIndent = original.slice(lineStart, bodyIndex).match(/^[ \t]*/)?.[0] || "";
const currentBody = original.slice(bodyArrayStart + 1, bodyArrayEnd);
const itemIndent = currentBody.match(/\r?\n([ \t]*)["']/)?.[1] || `${bodyIndent}  `;
const bodyContent =
  newline +
  replacementBody
    .map((item, index) => `${itemIndent}${JSON.stringify(item)}${index < replacementBody.length - 1 ? "," : ""}`)
    .join(newline) +
  newline +
  bodyIndent;

const updated =
  original.slice(0, bodyArrayStart + 1) +
  bodyContent +
  original.slice(bodyArrayEnd);

fs.writeFileSync(file, updated);

console.log('"Packing Checkpoints for Buyers" section content updated successfully.');
