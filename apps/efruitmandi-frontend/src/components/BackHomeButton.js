import { useNavigate } from "react-router-dom";
import { FaHome } from "react-icons/fa";

export default function BackHomeButton({ className = "" }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-green-200 bg-white px-4 py-2 text-xs font-extrabold text-green-800 shadow-sm hover:border-green-600 hover:bg-green-50 ${className}`}
    >
      <FaHome />
      Back to Home
    </button>
  );
}
