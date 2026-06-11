export const PAYMENT_UNAVAILABLE_MESSAGE =
  "Payment partner unavailable. You cannot buy this lot yet. We will be available in a few days.";

const rawPaymentFlag =
  process.env.VITE_PAYMENT_PARTNER_ENABLED ??
  process.env.REACT_APP_PAYMENT_PARTNER_ENABLED ??
  "false";

export const PAYMENT_PARTNER_ENABLED =
  String(rawPaymentFlag).trim().toLowerCase() === "true";

const disabledPaymentPathPatterns = [
  /^\/?billdesk(?:\/|$)/i,
  /^\/?payments\/cashfree(?:\/|$)/i,
  /^\/?cashfree(?:\/|$)/i,
  /^\/?payment(?:\/|$)/i,
  /^\/?checkout(?:\/|$)/i,
  /^\/?orders\/checkout(?:\/|$)/i,
  /^\/?settlement(?:\/|$)/i,
  /^\/?escrow(?:\/|$)/i,
  /^\/?delivery\/(?:generate-settlement-otp|confirm-settlement)(?:\/|$)/i,
  /^\/?quotes\/[^/]+\/accept(?:\/|$)/i,
];

export const isPaymentPartnerDisabledPath = (url = "") => {
  if (PAYMENT_PARTNER_ENABLED) return false;

  const path = String(url)
    .replace(/^https?:\/\/[^/]+\/api\/?/i, "")
    .replace(/^\/api\/?/i, "");

  return disabledPaymentPathPatterns.some((pattern) => pattern.test(path));
};

export const createPaymentUnavailableError = () => {
  const error = new Error(PAYMENT_UNAVAILABLE_MESSAGE);
  error.response = {
    status: 503,
    data: {
      msg: PAYMENT_UNAVAILABLE_MESSAGE,
      code: "PAYMENT_PARTNER_DISABLED",
    },
  };
  return error;
};
