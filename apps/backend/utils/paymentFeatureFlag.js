export const PAYMENT_UNAVAILABLE_MESSAGE =
  "Payment partner unavailable. You cannot buy this lot yet. We will be available in a few days.";

const normalizeBooleanFlag = (value = "") =>
  String(value || "").trim().toLowerCase() === "true";

export const isPaymentPartnerEnabled = () =>
  normalizeBooleanFlag(
    process.env.PAYMENT_PARTNER_ENABLED ??
      process.env.VITE_PAYMENT_PARTNER_ENABLED ??
      process.env.REACT_APP_PAYMENT_PARTNER_ENABLED ??
      "false"
  );

export const requirePaymentPartnerEnabled = (_req, res, next) => {
  if (isPaymentPartnerEnabled()) {
    next();
    return;
  }

  res.status(503).json({
    msg: PAYMENT_UNAVAILABLE_MESSAGE,
    code: "PAYMENT_PARTNER_DISABLED",
  });
};
