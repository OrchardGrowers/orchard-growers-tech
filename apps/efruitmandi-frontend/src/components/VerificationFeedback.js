import { Link } from "react-router-dom";

const STATUS_LABELS = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  CHANGES_REQUIRED: "Changes Required",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export default function VerificationFeedback({ feedback, loading = false, error = "", showAction = false }) {
  if (loading) {
    return <div className="mt-3 h-24 animate-pulse rounded-lg bg-amber-50" aria-label="Loading verification feedback" />;
  }
  if (error) {
    return <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</p>;
  }
  if (!feedback?.remark) return null;

  const updatedAt = feedback.updatedAt || feedback.createdAt;

  return (
    <section className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3" aria-label="Verification feedback">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-amber-950">Verification Feedback</p>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-amber-900">
          {STATUS_LABELS[feedback.status] || String(feedback.status || "").replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-2 text-xs font-extrabold text-amber-900">Admin Remark:</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-5 text-amber-900">{feedback.remark}</p>
      {updatedAt && (
        <p className="mt-2 text-[11px] font-bold text-amber-700">
          Updated: {new Date(updatedAt).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      )}
      {showAction && feedback.actionUrl && (
        <Link
          to={feedback.actionUrl}
          className="mt-3 inline-flex rounded-full bg-green-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-green-800"
        >
          Review section
        </Link>
      )}
    </section>
  );
}
