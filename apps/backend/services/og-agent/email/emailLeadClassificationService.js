const groups = {
  GROWER: ["orchard", "farmer", "grower", "producer", "orchard owner", "farm owner", "fruit production", "harvest", "बागवान", "फल उत्पादक"],
  BUYER: ["trader", "wholesaler", "distributor", "procurement", "purchase", "bulk buyer", "fruit merchant", "commission agent", "retailer", "importer", "exporter", "mandi buyer", "buying quantity", "weekly requirement"],
  INVESTOR: ["investor", "investment", "funding", "venture capital", "angel network", "term sheet"],
  LOGISTICS: ["logistics", "transport", "freight", "cold chain", "warehouse", "reefer"],
  CANDIDATE: ["resume", "curriculum vitae", "job application", "apply for", "experience", "designation"],
};

const matchesFor = (text, indicators) => indicators.filter((indicator) => text.includes(indicator));

export const classifyEmailLead = ({ text, subject = "", targetTypes = [] }) => {
  const input = `${subject}\n${text}`.toLowerCase();
  const matches = Object.fromEntries(Object.entries(groups).map(([type, indicators]) => [type, matchesFor(input, indicators)]));
  const growerScore = matches.GROWER.length;
  const buyerScore = matches.BUYER.length;
  let leadType = "UNCERTAIN";
  if (growerScore && buyerScore) leadType = "BOTH";
  else if (growerScore) leadType = "GROWER";
  else if (buyerScore) leadType = "BUYER";
  else if (matches.INVESTOR.length) leadType = "INVESTOR";
  else if (matches.LOGISTICS.length) leadType = "LOGISTICS";
  else if (matches.CANDIDATE.length) leadType = "CANDIDATE";
  else if (targetTypes.includes("OTHER_BUSINESS_CONTACTS")) leadType = "OTHER";

  const evidence = leadType === "BOTH" ? [...matches.GROWER, ...matches.BUYER] : matches[leadType] || [];
  const confidence = leadType === "UNCERTAIN" ? 35 : Math.min(96, 58 + evidence.length * 9);
  return {
    leadType,
    confidence,
    explanation: leadType === "UNCERTAIN"
      ? "No sufficiently strong contextual grower, buyer, candidate, investor, or logistics indicators were found. Manual verification required."
      : `${leadType.replace(/_/g, " ")} classification confidence is ${confidence}% because the synchronized email context mentions: ${evidence.slice(0, 5).join(", ") || "relevant business context"}.`,
    indicators: evidence,
  };
};
