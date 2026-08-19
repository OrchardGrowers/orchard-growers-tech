import SequenceCounter from "../models/SequenceCounter.js";

const padSerial = (value) => String(value).padStart(6, "0");

export const getIndianFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `FY${startYear}-${endYearShort}`;
};

const nextSequence = async (key) => {
  const counter = await SequenceCounter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return counter.value;
};

export const generateBuyerInvoiceNo = async (date = new Date()) => {
  const financialYear = getIndianFinancialYear(date);
  const serial = await nextSequence(`buyer-invoice:${financialYear}`);
  return `EFM-BUYER-INV-${financialYear}-${padSerial(serial)}`;
};

export const generateCommissionInvoiceNo = async (date = new Date()) => {
  const financialYear = getIndianFinancialYear(date);
  const serial = await nextSequence(`commission-invoice:${financialYear}`);
  return `EFM-COMM-INV-${financialYear}-${padSerial(serial)}`;
};

export const generateCommissionReceiptNo = async (date = new Date()) => {
  const financialYear = getIndianFinancialYear(date);
  const serial = await nextSequence(`commission-receipt:${financialYear}`);
  return `EFM-COMM-RCPT-${financialYear}-${padSerial(serial)}`;
};

const generateTransactionDocumentNumber = async (type, prefix, date = new Date()) => {
  const year = date.getFullYear();
  const serial = await nextSequence(`transaction-document:${type}:${year}`);
  return `${prefix}-${year}-${padSerial(serial)}`;
};

export const generateLotChallanNo = (date = new Date()) =>
  generateTransactionDocumentNumber("lot-challan", "EFM-GLC", date);

export const generateSalesInvoiceNo = (date = new Date()) =>
  generateTransactionDocumentNumber("sales-invoice", "EFM-SI", date);

export const generateGrowerCommissionInvoiceNo = (date = new Date()) =>
  generateTransactionDocumentNumber("grower-commission", "EFM-CI-G", date);

export const generateBuyerCommissionInvoiceNo = (date = new Date()) =>
  generateTransactionDocumentNumber("buyer-commission", "EFM-CI-B", date);

export const generateBillDeskPaymentRef = async (date = new Date()) => {
  const yyyymmdd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const serial = await nextSequence(`billdesk-payment:${yyyymmdd}`);
  return `BD-ESCROW-EFM-${yyyymmdd}-${padSerial(serial)}`;
};
