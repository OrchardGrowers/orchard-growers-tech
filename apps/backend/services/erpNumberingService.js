import SequenceCounter from "../models/SequenceCounter.js";

const padSerial = (value) => String(value).padStart(6, "0");

const ERP_PREFIX_BY_TYPE = {
  LOT: "LOT",
  OFFER: "OFR",
  COUNTER_OFFER: "CTR",
  DEAL: "DEAL",
  PAYMENT: "PAY",
  ESCROW: "ESC",
  SETTLEMENT: "SET",
  SALE_BILL: "SB",
  CHALLAN: "CHL",
  COMMISSION: "COM",
  VERIFICATION: "OGV",
  DEBIT_NOTE: "DN",
  CREDIT_NOTE: "CN",
  REFUND: "RFND",
  LEDGER: "LED",
  DOCUMENT: "DOC",
};

const getCalendarYear = (date = new Date()) => String(date.getFullYear());

const nextSequence = async (key) => {
  const counter = await SequenceCounter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return counter.value;
};

export const generateErpNumber = async (type, date = new Date()) => {
  const normalizedType = String(type || "").trim().toUpperCase();
  const prefix = ERP_PREFIX_BY_TYPE[normalizedType] || ERP_PREFIX_BY_TYPE.DOCUMENT;
  const year = getCalendarYear(date);
  const serial = await nextSequence(`erp:${prefix}:${year}`);
  return `${prefix}-${year}-${padSerial(serial)}`;
};

export const getErpNumberPrefix = (type) =>
  ERP_PREFIX_BY_TYPE[String(type || "").trim().toUpperCase()] || ERP_PREFIX_BY_TYPE.DOCUMENT;
