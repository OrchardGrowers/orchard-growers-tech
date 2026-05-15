export default function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
    >
      {children}
    </button>
  );
}