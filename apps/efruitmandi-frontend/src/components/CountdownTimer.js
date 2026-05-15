import { useEffect, useState } from "react";

export default function CountdownTimer({ endTime }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const diff = new Date(endTime) - new Date();

      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(interval);
      } else {
        setTimeLeft({
          h: Math.floor(diff / (1000 * 60 * 60)),
          m: Math.floor((diff / 1000 / 60) % 60),
          s: Math.floor((diff / 1000) % 60),
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (!timeLeft) {
    return <p className="text-red-500 font-bold">Deal Ended</p>;
  }

  return (
    <p className="text-sm text-gray-600">
      ⏱ {timeLeft.h}h {timeLeft.m}m {timeLeft.s}s
    </p>
  );
}
