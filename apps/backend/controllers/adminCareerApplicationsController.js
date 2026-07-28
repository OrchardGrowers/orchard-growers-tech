import mongoose from "mongoose";
import CareerApplication, { CAREER_APPLICATION_STATUSES } from "../models/CareerApplication.js";
import { syncCareerMailbox } from "../services/careerMailboxSyncService.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const syncCareerApplications = async (req, res) => {
  try {
    const summary = await syncCareerMailbox({ importedBy: req.user?.id });
    res.json({ message: "Career mailbox sync completed.", summary });
  } catch (error) {
    res.status(error?.statusCode || 500).json({
      msg: error?.statusCode ? error.message : "Career mailbox sync failed.",
    });
  }
};

export const listCareerApplications = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = {};
  const status = String(req.query.status || "").trim().toUpperCase();
  if (status && CAREER_APPLICATION_STATUSES.includes(status)) filter.status = status;

  const from = parseDate(req.query.dateFrom || req.query.from);
  const to = parseDate(req.query.dateTo || req.query.to);
  if (from || to) {
    filter.receivedAt = {};
    if (from) filter.receivedAt.$gte = from;
    if (to) filter.receivedAt.$lte = to;
  }

  const search = String(req.query.search || req.query.q || "").trim().slice(0, 200);
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { applicantName: expression },
      { senderName: expression },
      { senderEmail: expression },
      { replyToEmail: expression },
      { subject: expression },
      { contactNumber: expression },
      { extractedPhoneNumbers: expression },
      { extractedEmails: expression },
    ];
  }

  const allowedSorts = new Set(["receivedAt", "emailDate", "createdAt", "applicantName", "status"]);
  const requestedSort = req.query.sort || req.query.sortBy;
  const sortBy = allowedSorts.has(requestedSort) ? requestedSort : "receivedAt";
  const sortOrder = String(req.query.order || req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  const [applications, total] = await Promise.all([
    CareerApplication.find(filter)
      .select("-textBody")
      .sort({ [sortBy]: sortOrder, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CareerApplication.countDocuments(filter),
  ]);

  res.json({
    applications,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
};

export const getCareerApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ msg: "Invalid career application id." });
  }
  const application = await CareerApplication.findById(req.params.id).lean();
  if (!application) return res.status(404).json({ msg: "Career application not found." });
  return res.json({ application });
};
