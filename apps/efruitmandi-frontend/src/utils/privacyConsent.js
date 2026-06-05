const PRIVACY_CONSENT_KEY = "efruitmandiPrivacyConsent";

export const hasEFruitPrivacyConsent = () => {
  try {
    return window.localStorage.getItem(PRIVACY_CONSENT_KEY) === "true";
  } catch {
    return false;
  }
};

export const rememberEFruitPrivacyConsent = () => {
  try {
    window.localStorage.setItem(PRIVACY_CONSENT_KEY, "true");
  } catch {
    // Ignore private browsing storage failures.
  }
};

export const privacyConsentKey = PRIVACY_CONSENT_KEY;
