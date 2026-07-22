const truthyEnv = (value = "") => ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());

export const BUSINESS_MAIL_SENDER_PROFILE_KEYS = Object.freeze({
  EFRUITMANDI_NO_REPLY: "EFRUITMANDI_NO_REPLY",
  ORCHARD_NO_REPLY: "ORCHARD_NO_REPLY",
  EFRUITMANDI_CAREER: "EFRUITMANDI_CAREER",
  ORCHARD_CAREER: "ORCHARD_CAREER",
  ADMINHO_ORCHARD: "ADMINHO_ORCHARD",
  SALES_ORCHARD: "SALES_ORCHARD",
  SUPPORT_EFRUITMANDI: "SUPPORT_EFRUITMANDI",
});

const PROFILE_DEFINITIONS = Object.freeze({
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.EFRUITMANDI_NO_REPLY]: {
    envPrefix: "BUSINESS_MAIL_EFRUITMANDI_NO_REPLY",
    defaultName: "eFruitMandi",
    defaultEmail: "no-reply@efruitmandi.live",
    fallbackReplyToEnv: "EFRUITMANDI_SUPPORT_EMAIL",
    replyCapable: false,
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.ORCHARD_NO_REPLY]: {
    envPrefix: "BUSINESS_MAIL_ORCHARD_NO_REPLY",
    defaultName: "Orchard Growers",
    defaultEmail: "no-reply@orchardgrowers.in",
    fallbackReplyToEnv: "ORCHARD_SUPPORT_EMAIL",
    replyCapable: false,
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.EFRUITMANDI_CAREER]: {
    envPrefix: "BUSINESS_MAIL_EFRUITMANDI_CAREER",
    defaultName: "eFruitMandi Careers",
    defaultEmail: "career@efruitmandi.live",
    replyCapable: true,
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.ORCHARD_CAREER]: {
    envPrefix: "BUSINESS_MAIL_ORCHARD_CAREER",
    defaultName: "Orchard Growers Careers",
    defaultEmail: "career@orchardgrowers.in",
    replyCapable: true,
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.ADMINHO_ORCHARD]: {
    envPrefix: "BUSINESS_MAIL_ADMINHO_ORCHARD",
    defaultName: "Orchard Growers Administration",
    defaultEmail: "adminho@orchardgrowers.in",
    replyCapable: true,
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.SALES_ORCHARD]: {
    envPrefix: "BUSINESS_MAIL_SALES_ORCHARD",
    defaultName: "Orchard Growers Sales",
    defaultEmail: "sales@orchardgrowers.in",
    replyCapable: true,
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.SUPPORT_EFRUITMANDI]: {
    envPrefix: "BUSINESS_MAIL_SUPPORT_EFRUITMANDI",
    defaultName: "eFruitMandi Support",
    defaultEmail: "support@efruitmandi.live",
    replyCapable: true,
  },
});

const readProfile = (key, definition) => {
  const email = String(process.env[`${definition.envPrefix}_EMAIL`] || definition.defaultEmail).trim().toLowerCase();
  const name = String(process.env[`${definition.envPrefix}_NAME`] || definition.defaultName).trim();
  const configuredReplyTo = String(process.env[`${definition.envPrefix}_REPLY_TO`] || "").trim().toLowerCase();
  const fallbackReplyTo = definition.fallbackReplyToEnv
    ? String(process.env[definition.fallbackReplyToEnv] || "").trim().toLowerCase()
    : "";
  const replyToEmail = configuredReplyTo || (definition.replyCapable ? email : fallbackReplyTo);

  return {
    key,
    enabled: truthyEnv(process.env[`${definition.envPrefix}_ENABLED`]),
    sender: { name, email },
    replyTo: replyToEmail ? { email: replyToEmail } : null,
    replyCapable: definition.replyCapable,
  };
};

export const getBusinessMailSenderProfile = (key = "") => {
  const normalizedKey = String(key || "").trim().toUpperCase();
  const definition = PROFILE_DEFINITIONS[normalizedKey];
  return definition ? readProfile(normalizedKey, definition) : null;
};

export const listBusinessMailSenderProfiles = () =>
  Object.entries(PROFILE_DEFINITIONS).map(([key, definition]) => readProfile(key, definition));
