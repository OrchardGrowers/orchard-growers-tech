import { useEffect } from "react";

let audioContext;

const getAudioContext = () => {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audioContext = new AudioContext();
  }

  return audioContext;
};

const playClickSound = () => {
  const context = getAudioContext();
  if (!context) return;

  const playTone = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(620, now);
    oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.055);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.085);
  };

  if (context.state === "suspended") {
    context.resume().then(playTone).catch(() => undefined);
    return;
  }

  playTone();
};

export default function AppFeedback() {
  useEffect(() => {
    let active = true;
    let feedbackQueued = false;

    const handlePointerDown = (event) => {
      if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactive = target.closest(
        "button, a, input, select, textarea, [role='button']"
      );
      if (
        !interactive ||
        interactive.matches(":disabled, [aria-disabled='true']") ||
        feedbackQueued
      ) {
        return;
      }

      feedbackQueued = true;
      queueMicrotask(() => {
        feedbackQueued = false;
        if (!active) return;
        playClickSound();
      });
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });

    return () => {
      active = false;
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return null;
}
