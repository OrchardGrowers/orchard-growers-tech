import { useState } from "react";
import { Link } from "react-router-dom";
import { hasEFruitPrivacyConsent, rememberEFruitPrivacyConsent } from "../utils/privacyConsent";

export default function PrivacyConsentNotice() {
  const [accepted, setAccepted] = useState(() => hasEFruitPrivacyConsent());
  const [checked, setChecked] = useState(false);

  if (accepted) return null;

  const saveConsent = () => {
    if (!checked) return;
    rememberEFruitPrivacyConsent();
    setAccepted(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-20 z-[88] mx-auto max-w-lg rounded-lg border border-green-200 bg-white p-4 text-gray-900 shadow-2xl md:bottom-5">
      <p className="text-sm font-extrabold text-green-900">Privacy and service improvement consent</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-gray-600">
        With your permission, eFruitMandi may use search patterns, browsing behavior inside eFruitMandi, location,
        camera, and microphone signals to improve buyer, grower, logistics, and marketplace services. Sensitive data is
        not collected silently.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs font-bold text-gray-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          I agree to optional service improvement analytics and permission-based tracking.{" "}
          <Link to="/privacy-policy" className="text-green-700 underline">
            Privacy Policy
          </Link>
        </span>
      </label>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!checked}
          onClick={saveConsent}
          className="rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Allow
        </button>
      </div>
    </div>
  );
}
