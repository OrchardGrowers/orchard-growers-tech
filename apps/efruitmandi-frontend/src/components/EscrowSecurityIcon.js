import { FiLock, FiShield } from "react-icons/fi";

export default function EscrowSecurityIcon({ className = "" }) {
  return (
    <span
      role="img"
      aria-label="Escrow security"
      className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center text-white lg:h-9 lg:w-9 ${className}`}
    >
      <FiShield aria-hidden="true" className="h-full w-full stroke-[2.2]" />
      <FiLock
        aria-hidden="true"
        className="absolute left-1/2 top-[46%] h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 stroke-[2.5]"
      />
    </span>
  );
}
