import PDFDocument from "pdfkit";

const GREEN = "#166534";
const LIGHT_GREEN = "#ecfdf5";
const DARK = "#111827";
const MUTED = "#4b5563";

const formatMoney = (value) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const valueText = (value) => {
  if (value === undefined || value === null || value === "") return "Not available";
  return String(value);
};

const ensureSpace = (doc, needed = 60) => {
  if (doc.y + needed <= doc.page.height - 55) return;
  doc.addPage();
};

const sectionTitle = (doc, title) => {
  ensureSpace(doc, 42);
  doc.moveDown(0.6);
  const top = doc.y;
  doc
    .roundedRect(45, top, 505, 24, 4)
    .fill(LIGHT_GREEN);
  doc
    .fillColor(GREEN)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(title, 54, top + 7, { width: 487 });
  doc.y = top + 31;
};

const fieldRows = (doc, rows) => {
  for (const [label, value] of rows.filter(([, item]) => item !== undefined && item !== null && item !== "")) {
    ensureSpace(doc, 26);
    const top = doc.y;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text(label, 52, top, { width: 160 });
    doc.fillColor(DARK).font("Helvetica").fontSize(9).text(valueText(value), 215, top, { width: 330 });
    doc.y = Math.max(doc.y, top + 18);
  }
};

const partyRows = (party = {}) => [
  ["Name", party.name],
  ["Business / Orchard", party.businessName],
  ["User ID", party.userId],
  ["Address", party.address],
  ["Village", party.village],
  ["District", party.district],
  ["State", party.state],
  ["PIN Code", party.pinCode],
  ["Mobile", party.phone],
  ["Email", party.email],
  ["KYC Status", party.kycStatus],
  ["PAN", party.maskedPan],
  ["GSTIN", party.gstNumber],
];

const addHeader = (doc, record, snapshot) => {
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(20).text("eFruitMandi.live", 45, 42);
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("Orchard Growers Private Limited", 45, 67);
  doc
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(snapshot.documentTitle || record.documentType, 45, 95, { align: "center", width: 505 });
  doc.moveTo(45, 124).lineTo(550, 124).strokeColor(GREEN).lineWidth(1.5).stroke();
  doc.y = 140;
  fieldRows(doc, [
    ["Document Number", record.documentNumber],
    ["Document Date", formatDate(record.finalizedAt || record.createdAt)],
    ["Status", record.status],
  ]);
};

const addLotChallan = (doc, record, snapshot) => {
  sectionTitle(doc, "Grower Details");
  fieldRows(doc, partyRows(snapshot.grower));
  sectionTitle(doc, "Lot Details");
  const lot = snapshot.lot || {};
  const offerWindow = lot.offerWindowStart || lot.offerWindowEnd
    ? [formatDateTime(lot.offerWindowStart), formatDateTime(lot.offerWindowEnd)]
        .filter(Boolean)
        .join(" to ")
    : "";
  fieldRows(doc, [
    ["Lot ID", lot.lotId],
    ["Lot Number", lot.lotNumber],
    ["Listing Date / Time", formatDateTime(lot.listingDate)],
    ["Listing Status", lot.status],
    ["Listing Type", lot.listingType],
    ["Offer / Deal Window", offerWindow],
    ["Fruit", lot.fruit],
    ["Variety", lot.variety],
    ["Quality / Grade", lot.grade],
    ["Size / Count", lot.sizeCount],
    ["Quantity / Boxes", `${valueText(lot.quantity)} / ${valueText(lot.boxes)}`],
    ["Approximate Weight", lot.approximateWeightKg ? `${lot.approximateWeightKg} kg` : ""],
    ["Weight Per Box", lot.weightPerBoxKg ? `${lot.weightPerBoxKg} kg` : ""],
    ["Packing Type", lot.packingType],
    ["Pickup Location", lot.location],
    ["Expected Rate", lot.baseRate ? `${formatMoney(lot.baseRate)} ${lot.unit || ""}` : ""],
    ["Estimated Lot Value", lot.estimatedValue ? formatMoney(lot.estimatedValue) : ""],
    ["Quality Description", lot.qualityDescription],
    ["Listing Photo References", lot.photoCount ? `${lot.photoCount} photo(s) retained with the lot` : ""],
  ]);
  sectionTitle(doc, "Grower Declaration");
  doc.fillColor(DARK).font("Helvetica").fontSize(9).text(snapshot.declaration || "", 52, doc.y, { width: 490 });
  doc.moveDown();
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text(snapshot.disclaimer || "", 52, doc.y, { width: 490 });
};

const addSalesInvoice = (doc, record, snapshot) => {
  sectionTitle(doc, "Transaction Reference");
  fieldRows(doc, [
    ["Deal / Order ID", snapshot.deal?.orderId],
    ["Lot ID", snapshot.deal?.lotId],
    ["Quote ID", snapshot.deal?.quoteId],
    ["Completion Date", formatDate(snapshot.deal?.completedAt)],
    ["Delivery / Receipt Date", formatDate(snapshot.deal?.deliveryDate)],
    ["Payment Reference", snapshot.deal?.paymentReference],
  ]);
  sectionTitle(doc, "Seller / Grower");
  fieldRows(doc, partyRows(snapshot.seller));
  sectionTitle(doc, "Buyer");
  fieldRows(doc, partyRows(snapshot.buyer));
  sectionTitle(doc, "Final Fruit Transaction");
  const financial = snapshot.financial || {};
  fieldRows(doc, [
    ["Fruit", snapshot.lot?.fruit],
    ["Variety", snapshot.lot?.variety],
    ["Grade", snapshot.lot?.grade],
    ["Final Quantity", financial.finalQuantity],
    ["Final Accepted Weight", financial.finalWeightKg ? `${financial.finalWeightKg} kg` : ""],
    ["Final Rate", financial.finalRate ? formatMoney(financial.finalRate) : ""],
    ["Unit", snapshot.lot?.unit],
    ["Gross Fruit Sale Value", formatMoney(financial.grossFruitSaleAmount)],
  ]);
  ensureSpace(doc, 70);
  const totalTop = doc.y + 8;
  doc
    .roundedRect(330, totalTop, 215, 48, 4)
    .fill(LIGHT_GREEN);
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text("TOTAL SALES INVOICE VALUE", 342, totalTop + 8, { width: 190, align: "right" });
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(16).text(formatMoney(snapshot.totalFruitSaleValue), 342, totalTop + 23, { width: 190, align: "right" });
  doc.y = totalTop + 66;
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text(
    "This invoice records the full final fruit sale value. Platform service charges, if applicable, are documented separately.",
    52,
    doc.y,
    { width: 490 }
  );
};

const addCommissionInvoice = (doc, record, snapshot) => {
  const recipient = snapshot.commissionParty === "BUYER" ? snapshot.buyer : snapshot.seller;
  sectionTitle(doc, "Issued By");
  fieldRows(doc, [
    ["Legal Entity", snapshot.platform?.legalEntity],
    ["Platform", snapshot.platform?.name],
  ]);
  sectionTitle(doc, `Bill To - ${snapshot.commissionParty || record.recipientRole}`);
  fieldRows(doc, partyRows(recipient));
  sectionTitle(doc, "Service Charge Details");
  fieldRows(doc, [
    ["Deal / Order ID", snapshot.deal?.orderId],
    ["Lot ID", snapshot.deal?.lotId],
    ["Final Fruit Transaction Reference", formatMoney(snapshot.financial?.grossFruitSaleAmount)],
    ["Platform Service / Commission Rate", `${Number(snapshot.commissionRate || 0)}%`],
    ["Service / Commission Amount", formatMoney(snapshot.commissionAmount)],
    ["Configured Tax", formatMoney(record.taxAmount)],
  ]);
  ensureSpace(doc, 70);
  const totalTop = doc.y + 8;
  doc.roundedRect(330, totalTop, 215, 48, 4).fill(LIGHT_GREEN);
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text("TOTAL SERVICE INVOICE VALUE", 342, totalTop + 8, { width: 190, align: "right" });
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(16).text(formatMoney(record.totalAmount), 342, totalTop + 23, { width: 190, align: "right" });
  doc.y = totalTop + 66;
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text(
    "This service invoice is separate from the fruit sales invoice and does not reduce the gross fruit sale value shown there.",
    52,
    doc.y,
    { width: 490 }
  );
};

export const createTransactionDocumentPdf = (recordValue) => {
  const record = recordValue?.toObject ? recordValue.toObject() : recordValue;
  const snapshot = record.snapshot || {};
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 42, right: 45, bottom: 50, left: 45 },
    info: {
      Title: `${snapshot.documentTitle || record.documentType} ${record.documentNumber}`,
      Author: "Orchard Growers Private Limited",
      Subject: "eFruitMandi transaction document",
    },
  });

  addHeader(doc, record, snapshot);
  if (record.documentType === "LOT_CHALLAN") addLotChallan(doc, record, snapshot);
  else if (record.documentType === "SALES_INVOICE") addSalesInvoice(doc, record, snapshot);
  else addCommissionInvoice(doc, record, snapshot);

  ensureSpace(doc, 35);
  doc.moveDown(1.5);
  doc.fillColor(MUTED).font("Helvetica").fontSize(7).text(
    `System-generated by eFruitMandi.live | ${record.documentNumber}`,
    45,
    doc.y,
    { width: 505, align: "center" }
  );
  doc.end();
  return doc;
};
