import { useState } from "react";
import { FiLock, FiUnlock } from "react-icons/fi";

const STORAGE_KEY = "efruitmandiTestingModeUnlocked";
const DEVELOPER_CODE_HASH =
  "b3850cdd016df86974359de831a5821772a7c879009d9d32b6e2ba301ccf319d";

const readUnlocked = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const rememberUnlocked = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Local storage can be unavailable in private browsing; allow this session.
  }
};

const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export default function TestingModeGate({ children }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [securityCode, setSecurityCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleUnlock = async (event) => {
    event.preventDefault();
    setError("");

    if (!securityCode.trim()) {
      setError("Enter the developers security code.");
      return;
    }

    if (!window.crypto?.subtle) {
      setError("Security check is unavailable in this browser.");
      return;
    }

    setChecking(true);

    try {
      const enteredHash = await sha256(securityCode.trim());

      if (enteredHash === DEVELOPER_CODE_HASH) {
        rememberUnlocked();
        setUnlocked(true);
        return;
      }

      setSecurityCode("");
      setError("Invalid security code.");
    } catch {
      setError("Unable to verify code. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  if (unlocked) return children;

  return (
    <main className="min-h-screen w-full bg-[#f2f7f0] px-5 py-8 text-gray-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col items-center justify-center">
        <div className="w-full rounded-lg border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <FiLock aria-hidden="true" size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-gray-950 sm:text-3xl">
                This feature is currently under scheduled rollout.
              </h1>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleUnlock}>
            <label className="block text-sm font-semibold text-gray-800" htmlFor="developer-security-code">
              Enter developers security code:
            </label>
            <input
              id="developer-security-code"
              type="password"
              value={securityCode}
              onChange={(event) => setSecurityCode(event.target.value)}
              className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              autoComplete="off"
              autoFocus
            />

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-emerald-500"
              disabled={checking}
            >
              <FiUnlock aria-hidden="true" size={18} />
              {checking ? "Unlocking..." : "Unlock"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

