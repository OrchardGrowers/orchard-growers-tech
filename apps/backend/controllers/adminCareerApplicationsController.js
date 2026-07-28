import mongoose from "mongoose";
import CareerApplication, {
  CAREER_APPLICATION_STATUSES,
  CAREER_EXPERIENCE_RANGES,
  CAREER_FIELDS_OF_WORK,
} from "../models/CareerApplication.js";
import { syncCareerMailbox } from "../services/careerMailboxSyncService.js";

const EXPORT_MAX_RECORDS = 10000;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nonEmpty = (field) => ({ [field]: { $exists: true, $nin: ["", null] } });
const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setHours(23, 59, 59, 999);
  return date;
};
const isTrue = (value) => String(value || "").toLowerCase() === "true";

const buildCareerFilter = (query = {}) => {
  const filter = {};
  const clauses = [];
  const status = String(query.status || "").trim().toUpperCase();
  const fieldOfWork = String(query.fieldOfWork || "").trim().toUpperCase();
  const experienceRange = String(query.experienceRange || "").trim().toUpperCase();
  if (status && CAREER_APPLICATION_STATUSES.includes(status)) filter.status = status;
  if (fieldOfWork && CAREER_FIELDS_OF_WORK.includes(fieldOfWork)) filter.fieldOfWork = fieldOfWork;
  if (experienceRange && CAREER_EXPERIENCE_RANGES.includes(experienceRange)) {
    filter.experienceRange = experienceRange;
  }

  const state = String(query.state || "").trim().slice(0, 100);
  const qualification = String(query.qualification || "").trim().slice(0, 200);
  if (state) filter.state = new RegExp(`^${escapeRegex(state)}$`, "i");
  if (qualification) filter.qualification = new RegExp(escapeRegex(qualification), "i");

  const from = parseDate(query.dateFrom || query.from);
  const to = parseDate(query.dateTo || query.to, true);
  if (from || to) {
    filter.receivedAt = {};
    if (from) filter.receivedAt.$gte = from;
    if (to) filter.receivedAt.$lte = to;
  }

  const search = String(query.search || query.q || "").trim().slice(0, 200);
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    clauses.push({
      $or: [
        { candidateName: expression },
        { applicantName: expression },
        { senderName: expression },
        { email: expression },
        { senderEmail: expression },
        { replyToEmail: expression },
        { contactNumber: expression },
        { alternateContactNumber: expression },
        { extractedPhoneNumbers: expression },
        { extractedEmails: expression },
        { address: expression },
        { city: expression },
        { district: expression },
        { state: expression },
        { qualification: expression },
        { workExperienceText: expression },
        { currentCompany: expression },
        { currentDesignation: expression },
        { skills: expression },
        { fieldOfWork: expression },
        { subject: expression },
        { emailSubject: expression },
      ],
    });
  }

  if (isTrue(query.hasEmail)) {
    clauses.push({ $or: [nonEmpty("email"), nonEmpty("replyToEmail"), nonEmpty("senderEmail")] });
  }
  if (isTrue(query.hasContact)) {
    clauses.push({ $or: [nonEmpty("contactNumber"), nonEmpty("normalizedContactNumber")] });
  }
  if (isTrue(query.hasAddress)) clauses.push(nonEmpty("address"));
  if (isTrue(query.hasExperience)) {
    clauses.push({ $or: [nonEmpty("workExperienceText"), { experienceYears: { $ne: null } }] });
  }
  if (isTrue(query.hasResume)) {
    clauses.push({
      $or: [
        nonEmpty("resumeFileName"),
        { attachments: { $elemMatch: { filename: /\.(?:pdf|doc|docx|rtf|txt)$/i } } },
      ],
    });
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
};

const serializeSafeCandidate = (application) => ({
  _id: String(application._id),
  candidateName: application.candidateName || application.applicantName || application.senderName || "Unknown Applicant",
  email: application.email || application.replyToEmail || application.senderEmail || "",
  contactNumber: application.contactNumber || "",
  normalizedContactNumber: application.normalizedContactNumber || application.contactNumber || "",
  alternateContactNumber: application.alternateContactNumber || application.extractedPhoneNumbers?.[1] || "",
  address: application.address || "",
  city: application.city || "",
  district: application.district || "",
  state: application.state || "",
  postalCode: application.postalCode || "",
  qualification: application.qualification || "",
  workExperienceText: application.workExperienceText || "",
  experienceYears: application.experienceYears ?? null,
  experienceRange: application.experienceRange || "UNKNOWN",
  currentCompany: application.currentCompany || "",
  currentDesignation: application.currentDesignation || "",
  skills: application.skills || [],
  fieldOfWork: application.fieldOfWork || "UNKNOWN",
  appliedDate: application.receivedAt || application.emailDate || application.createdAt,
  emailSubject: application.emailSubject || application.subject || "",
  emailFrom: application.emailFrom || application.senderEmail || "",
  messageId: application.messageId || "",
  status: application.status || "NEW",
  notes: application.notes || "",
  tags: application.tags || [],
  resumeFileName: application.resumeFileName || "",
  resumeContentType: application.resumeContentType || "",
  resumeSize: application.resumeSize || 0,
});

export const syncCareerApplications = async (req, res) => {
  try {
    const requestedMode = req.query.all ?? req.body?.all;
    const syncAll = requestedMode === undefined || String(requestedMode).toLowerCase() !== "false";
    const requestedStart = Number.parseInt(req.query.startSequence || req.body?.startSequence, 10);
    const startSequence = Number.isInteger(requestedStart) && requestedStart > 0 ? requestedStart : undefined;
    const summary = await syncCareerMailbox({ importedBy: req.user?.id, syncAll, startSequence });
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
  const filter = buildCareerFilter(req.query);
  const allowedSorts = new Set(["receivedAt", "emailDate", "createdAt", "candidateName", "applicantName", "status"]);
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

export const exportCareerApplications = async (req, res) => {
  const scope = String(req.query.scope || "filters").trim().toLowerCase();
  let filter = scope === "all" ? {} : buildCareerFilter(req.query);
  if (scope === "selected" || scope === "page") {
    const ids = String(req.query.ids || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length || ids.length > EXPORT_MAX_RECORDS || ids.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ msg: "A valid bounded candidate ID selection is required." });
    }
    filter = { _id: { $in: [...new Set(ids)] } };
  }

  const matchedCount = await CareerApplication.countDocuments(filter);
  if (matchedCount > EXPORT_MAX_RECORDS) {
    return res.status(413).json({
      msg: `Export matches ${matchedCount} candidates. Narrow the filters to ${EXPORT_MAX_RECORDS} or fewer.`,
      matchedCount,
      maximum: EXPORT_MAX_RECORDS,
    });
  }

  const applications = await CareerApplication.find(filter)
    .select([
      "candidateName", "applicantName", "senderName", "email", "senderEmail", "replyToEmail",
      "contactNumber", "normalizedContactNumber", "alternateContactNumber", "extractedPhoneNumbers",
      "address", "city", "district", "state", "postalCode", "qualification", "workExperienceText",
      "experienceYears", "experienceRange", "currentCompany", "currentDesignation", "skills",
      "fieldOfWork", "receivedAt", "emailDate", "createdAt", "emailSubject", "subject", "emailFrom",
      "messageId", "status", "notes", "tags", "resumeFileName", "resumeContentType", "resumeSize",
    ].join(" "))
    .sort({ receivedAt: -1, _id: -1 })
    .limit(EXPORT_MAX_RECORDS)
    .lean();

  return res.json({
    success: true,
    matchedCount,
    returnedCount: applications.length,
    records: applications.map(serializeSafeCandidate),
  });
};

const countValues = async (field) =>
  CareerApplication.aggregate([
    { $match: { [field]: { $exists: true, $nin: ["", null] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 500 },
  ]).then((values) => values.map((item) => ({ value: item._id, count: item.count })));

export const getCareerApplicationFilterOptions = async (_req, res) => {
  const [states, qualifications, fieldsOfWork, experienceRanges, statuses] = await Promise.all([
    countValues("state"),
    countValues("qualification"),
    countValues("fieldOfWork"),
    countValues("experienceRange"),
    countValues("status"),
  ]);
  res.json({ states, qualifications, fieldsOfWork, experienceRanges, statuses });
};

export const getCareerApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ msg: "Invalid career application id." });
  }
  const application = await CareerApplication.findById(req.params.id).lean();
  if (!application) return res.status(404).json({ msg: "Career application not found." });
  return res.json({ application });
};
