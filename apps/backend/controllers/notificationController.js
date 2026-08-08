import UserNotification from "../models/UserNotification.js";
import { getVerificationFeedback } from "../services/verificationFeedbackService.js";

const clampLimit = (value, fallback = 50) => Math.min(Math.max(Number(value) || fallback, 1), 100);

export const getMyNotifications = async (req, res) => {
  const query = { user: req.user.id };
  if (String(req.query.unreadOnly || "").toLowerCase() === "true") query.readAt = null;
  const notifications = await UserNotification.find(query)
    .sort({ createdAt: -1 })
    .limit(clampLimit(req.query.limit))
    .lean();
  const unreadCount = await UserNotification.countDocuments({ user: req.user.id, readAt: null });
  res.json({ success: true, notifications, unreadCount });
};

export const markMyNotificationRead = async (req, res) => {
  const notification = await UserNotification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) return res.status(404).json({ msg: "Notification not found" });
  return res.json({ success: true, notification });
};

export const markAllMyNotificationsRead = async (req, res) => {
  await UserNotification.updateMany(
    { user: req.user.id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ success: true });
};

export const getMyVerificationFeedback = async (req, res) => {
  const feedback = await getVerificationFeedback({
    userId: req.user.id,
    section: req.query.section,
    roleType: req.query.roleType || req.query.role || "",
    includeHistory: String(req.query.includeHistory || "true").toLowerCase() !== "false",
  });
  res.json({ success: true, ...feedback });
};

export const getUserVerificationFeedbackByAdmin = async (req, res) => {
  const feedback = await getVerificationFeedback({
    userId: req.params.id,
    section: req.query.section,
    roleType: req.query.roleType || req.query.role || "",
    includeHistory: true,
  });
  res.json({ success: true, ...feedback });
};
