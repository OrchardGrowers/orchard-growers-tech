import { useEffect, useMemo, useState } from "react";
import { FaDownload, FaFileInvoice, FaPrint } from "react-icons/fa";
import API from "../services/api";
import BackHomeButton from "../components/BackHomeButton";
import { isGrowerAccount } from "../utils/auth";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getDocumentType = (order = {}) =>
  String(order.paymentMethod || "").toUpperCase() === "COD" ? "Chalan" : "Invoice";

const COMPLETED_PAYMENT_STATUSES = new Set(["ESCROW", "PAID", "RELEASED"]);
const COMPLETED_DELIVERY_STATUSES = new Set(["DELIVERED"]);

const isCompletedDocumentOrder = (order = {}) =>
  COMPLETED_PAYMENT_STATUSES.has(String(order.paymentStatus || "").toUpperCase()) ||
  COMPLETED_DELIVERY_STATUSES.has(String(order.deliveryStatus || "").toUpperCase());

const getOrderAmount = (order = {}, growerView = false) =>
  growerView
    ? order.sellerReceivable || order.growerPayout || order.auctionPrice || 0
    : order.finalPrice || order.totalAmount || order.auctionPrice || 0;

const getCommissionAmount = (order = {}) =>
  order.commissionTotalAmount || order.commissionTaxableAmount || order.platformCommission || order.dealBreakdown?.platformServiceFee || 0;

const buildDocumentHtml = (order = {}, growerView = false) => {
  const documentType = getDocumentType(order);
  const rows = order.items?.length
    ? order.items
    : [{ title: order.product?.title || "Fruit lot", quantity: 1, lineTotal: getOrderAmount(order, growerView) }];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${documentType} ${order.invoiceNumber || "-"}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
    .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #15803d; padding-bottom: 14px; }
    h1 { margin: 0; color: #166534; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
    th { background: #ecfdf5; }
    .total { margin-top: 18px; font-size: 20px; font-weight: 800; text-align: right; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>eFruitMandi ${documentType}</h1>
      <p><strong>Document No:</strong> ${order.invoiceNumber || "-"}</p>
      <p><strong>Date:</strong> ${formatDate(order.invoiceDate || order.createdAt)}</p>
    </div>
    <div>
      <p><strong>Buyer:</strong> ${order.customer?.name || order.buyer?.businessName || order.buyer?.name || "-"}</p>
      <p><strong>Grower:</strong> ${order.grower?.orchardName || order.grower?.name || "-"}</p>
      <p><strong>Status:</strong> ${order.paymentStatus || "-"} / ${order.deliveryStatus || "-"}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (item) =>
            `<tr><td>${item.title || "Fruit lot"}</td><td>${item.quantity || 1}</td><td>${formatCurrency(item.lineTotal || item.unitPrice || 0)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
  <p class="total">${growerView ? "Seller Receivable" : "Total Payable"}: ${formatCurrency(getOrderAmount(order, growerView))}</p>
</body>
</html>`;
};

const buildCommissionDocumentHtml = (order = {}, type = "invoice") => {
  const isReceipt = type === "receipt";
  const documentNo = isReceipt ? order.commissionReceiptNumber : order.commissionInvoiceNumber;
  const documentDate = isReceipt ? order.commissionReceiptDate : order.commissionInvoiceDate;
  const title = isReceipt ? "Commission Payment Receipt" : "Commission Invoice";
  const taxableAmount = order.commissionTaxableAmount || order.platformCommission || 0;
  const gstAmount = order.commissionGstAmount || 0;
  const totalAmount = getCommissionAmount(order);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} ${documentNo || order._id}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
    .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #15803d; padding-bottom: 14px; }
    h1 { margin: 0; color: #166534; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
    th { background: #ecfdf5; }
    .total { margin-top: 18px; font-size: 20px; font-weight: 800; text-align: right; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>eFruitMandi ${title}</h1>
      <p><strong>Document No:</strong> ${documentNo || "-"}</p>
      <p><strong>Date:</strong> ${formatDate(documentDate || order.createdAt)}</p>
      <p><strong>Fruit Lot Invoice:</strong> ${order.invoiceNumber || order._id || "-"}</p>
    </div>
    <div>
      <p><strong>Buyer:</strong> ${order.customer?.name || order.buyer?.businessName || order.buyer?.name || "-"}</p>
      <p><strong>Payment Ref:</strong> ${order.paymentReference || "-"}</p>
      <p><strong>Status:</strong> ${order.paymentStatus || "-"}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead>
    <tbody>
      <tr>
        <td>eFruitMandi platform service fee / commission</td>
        <td>${formatCurrency(taxableAmount)}</td>
        <td>${formatCurrency(gstAmount)}</td>
        <td>${formatCurrency(totalAmount)}</td>
      </tr>
    </tbody>
  </table>
  <p class="total">${isReceipt ? "Amount Received" : "Commission Payable"}: ${formatCurrency(totalAmount)}</p>
</body>
</html>`;
};

const downloadDocument = (order, growerView) => {
  const type = getDocumentType(order).toLowerCase();
  const html = buildDocumentHtml(order, growerView);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${type}-${order.invoiceNumber || order._id || Date.now()}.html`.replace(/[^\w.-]+/g, "-");
  link.click();
  URL.revokeObjectURL(url);
};

const downloadCommissionDocument = (order, type) => {
  const html = buildCommissionDocumentHtml(order, type);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const documentNo = type === "receipt" ? order.commissionReceiptNumber : order.commissionInvoiceNumber;
  link.href = url;
  link.download = `${type}-${documentNo || order._id || Date.now()}.html`.replace(/[^\w.-]+/g, "-");
  link.click();
  URL.revokeObjectURL(url);
};

const printDocument = (order, growerView) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;
  printWindow.document.write(buildDocumentHtml(order, growerView));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const printCommissionDocument = (order, type) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;
  printWindow.document.write(buildCommissionDocumentHtml(order, type));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export default function InvoicesChalan() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const growerView = isGrowerAccount();

  useEffect(() => {
    API.get("/orders")
      .then((res) => setOrders(res.data || []))
      .catch((err) => setMessage(err.response?.data?.msg || "Could not load invoices and chalan."));
  }, []);

  const documents = useMemo(
    () => orders.filter((order) => isCompletedDocumentOrder(order) && order.invoiceNumber),
    [orders]
  );

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">
            Documents
          </p>
          <h1 className="text-2xl font-black text-gray-950">Invoices / Chalan</h1>
        </div>
        <BackHomeButton />
      </div>

      {message && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {message}
        </p>
      )}

      {!documents.length && !message && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 text-sm font-bold text-gray-600">
          No invoice or chalan documents are available yet.
        </section>
      )}

      <div className="space-y-3">
        {documents.map((order) => (
          <article key={order._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-extrabold text-green-800">
                  <FaFileInvoice />
                  {getDocumentType(order)}
                </p>
                <h2 className="mt-2 text-base font-extrabold text-gray-950">
                  {order.invoiceNumber}
                </h2>
                <p className="mt-1 text-xs font-bold text-gray-500">
                  {formatDate(order.invoiceDate || order.createdAt)} - {order.paymentStatus || "PENDING"} / {order.deliveryStatus || "PENDING"}
                </p>
                {!growerView && order.commissionInvoiceNumber && (
                  <div className="mt-2 space-y-1 text-xs font-bold text-gray-600">
                    <p>Commission Invoice: {order.commissionInvoiceNumber}</p>
                    <p>Commission Receipt: {order.commissionReceiptNumber || "Pending"}</p>
                  </div>
                )}
              </div>
              <p className="text-lg font-black text-green-800">
                {formatCurrency(getOrderAmount(order, growerView))}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadDocument(order, growerView)}
                className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-green-800"
              >
                <FaDownload />
                Download {getDocumentType(order)}
              </button>
              <button
                type="button"
                onClick={() => printDocument(order, growerView)}
                className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-200"
              >
                <FaPrint />
                Print
              </button>
              {!growerView && order.commissionInvoiceNumber && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadCommissionDocument(order, "invoice")}
                    className="inline-flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs font-extrabold text-green-800 ring-1 ring-green-100"
                  >
                    <FaDownload />
                    Commission Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCommissionDocument(order, "receipt")}
                    className="inline-flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs font-extrabold text-green-800 ring-1 ring-green-100"
                  >
                    <FaDownload />
                    Commission Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => printCommissionDocument(order, "receipt")}
                    className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-200"
                  >
                    <FaPrint />
                    Print Receipt
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
