export default function StatusBadge({ status }) {
  const color =
    status === "ACTIVE"
      ? "bg-green-500"
      : status === "ENDED"
      ? "bg-red-500"
      : "bg-gray-500";

  return (
    <span className={`${color} text-white px-2 py-1 rounded text-sm`}>
      {status}
    </span>
  );
}