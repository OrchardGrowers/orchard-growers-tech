import { useEffect, useState } from "react";

const getRemainingSeconds = (cooldownUntil) =>
  Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

export default function useOtpVerificationCooldown() {
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingSeconds(0);
      return undefined;
    }

    const updateRemaining = () => {
      const remaining = getRemainingSeconds(cooldownUntil);
      setRemainingSeconds(remaining);
      if (!remaining) setCooldownUntil(0);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const startCooldown = (seconds = 60) => {
    setCooldownUntil(Date.now() + seconds * 1000);
  };

  const resetCooldown = () => {
    setCooldownUntil(0);
    setRemainingSeconds(0);
  };

  return {
    cooldownUntil,
    remainingSeconds,
    isLocked: remainingSeconds > 0,
    startCooldown,
    resetCooldown,
  };
}
