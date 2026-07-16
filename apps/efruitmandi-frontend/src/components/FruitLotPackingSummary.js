import {
  CUSTOM_OPTION_CODE,
  getPackingSpecification,
  getPackingTypeLabel,
} from "../config/packingSpecifications";
import {
  formatAppleDiameterRange,
  getSizeLabel,
  isAppleFruitValue,
} from "../config/appleGrading";
import { calculatePackingTotals } from "../utils/packingCalculations";

const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const formatNumber = (value, maximumFractionDigits = 2) =>
  Number(value).toLocaleString("en-IN", { maximumFractionDigits });

const getPackageTerms = (packingType = "") => ({
  Crate: { singular: "Crate", plural: "Crates" },
  "Loose Crate": { singular: "Crate", plural: "Crates" },
  "Loose Carton": { singular: "Carton", plural: "Cartons" },
  "Loose Wooden Box": { singular: "Wooden Box", plural: "Wooden Boxes" },
  "Tray Packed Carton": { singular: "Carton", plural: "Cartons" },
}[packingType] || { singular: "Package", plural: "Packages" });

const getOptionLabel = (options = [], code = "", customValue = "") => {
  if (!code) return "";
  if (code === CUSTOM_OPTION_CODE) return String(customValue || "").trim();
  return options.find((option) => option.code === code)?.label || "";
};

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-[9px] font-extrabold text-gray-500">{label}</p>
      <p className="mt-1 text-xs font-extrabold text-black">{value}</p>
    </div>
  );
}

export default function FruitLotPackingSummary({ product = {} }) {
  const rows = Array.isArray(product.packingBreakdown) ? product.packingBreakdown : [];
  if (!isAppleFruitValue(product.fruitName) || !rows.length) return null;

  const packingType = String(product.packingType || "").trim();
  const specification = getPackingSpecification(packingType);
  const terms = getPackageTerms(packingType);
  const calculated = calculatePackingTotals(rows, packingType);
  const isGraded = rows.some((row) => Boolean(row?.size));
  const hasDiameterData = rows.some((row) => positiveNumber(row?.diameterMinMm));
  const isTrayPacked = packingType === "Tray Packed Carton";
  const savedSummary = product.packingSummary || {};
  const totalPackages = positiveNumber(savedSummary.totalPackages) || calculated.totalPackages || positiveNumber(product.quantity);
  const totalWeightKg = positiveNumber(savedSummary.totalWeightKg) || calculated.totalWeightKg || positiveNumber(product.totalWeightKg);
  const allPiecesReliable = isGraded && calculated.rows.every((row) => row.totalPieces !== null);
  const totalPieces = positiveNumber(savedSummary.totalPieces) || (allPiecesReliable ? calculated.totalPieces : 0);
  const averageFruitWeightGrams =
    positiveNumber(savedSummary.averageFruitWeightGrams) ||
    (totalPieces > 0 && totalWeightKg > 0 ? (totalWeightKg * 1000) / totalPieces : 0);

  const getTypeLabel = (row) => getOptionLabel(
    specification?.typeOptions,
    row.packageTypeCode,
    row.customPackageTypeSpecification
  );
  const getPackageSizeLabel = (row) => getOptionLabel(
    specification?.sizeOptions,
    row.packageSizeCode,
    row.customPackageSizeSpecification
  );

  if (!isGraded) {
    const row = rows[0] || {};
    return (
      <section className="section mt-3 rounded-md border border-green-200 bg-green-50 p-3">
        <h2 className="text-sm font-extrabold text-black">Packing Summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Detail label="Packing" value={getPackingTypeLabel(packingType)} />
          <Detail label={`Number of ${terms.plural}`} value={positiveNumber(row.packageCount) ? formatNumber(row.packageCount, 0) : ""} />
          <Detail label={specification?.typeLabel} value={getTypeLabel(row)} />
          <Detail label={specification?.sizeLabel} value={getPackageSizeLabel(row)} />
          <Detail label={`Capacity per ${terms.singular}`} value={positiveNumber(row.weightPerPackageKg) ? `${formatNumber(row.weightPerPackageKg)} kg` : ""} />
          <Detail label="Total Net Weight" value={totalWeightKg ? `${formatNumber(totalWeightKg)} kg` : ""} />
        </div>
      </section>
    );
  }

  return (
    <section className="section mt-3 rounded-md border border-green-200 bg-white p-3">
      <h2 className="text-sm font-extrabold text-black">Size-wise Packing Details</h2>
      <p className="mt-1 text-xs font-bold text-gray-600">Packing: {getPackingTypeLabel(packingType)}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-[10px]">
          <thead className="bg-green-50 text-gray-600">
            <tr>
              <th className="px-2 py-2">Size</th>
              {hasDiameterData && <th className="px-2 py-2">Diameter Range</th>}
              <th className="px-2 py-2">Number of {terms.plural}</th>
              <th className="px-2 py-2">Package Specification</th>
              <th className="px-2 py-2">Package Capacity</th>
              {!isTrayPacked && <th className="px-2 py-2">Pieces per {terms.singular}</th>}
              {isTrayPacked && <th className="px-2 py-2">Trays per Carton</th>}
              {isTrayPacked && <th className="px-2 py-2">Pieces per Tray</th>}
              {isTrayPacked && <th className="px-2 py-2">Pieces per Carton</th>}
              <th className="px-2 py-2">Total Pieces</th>
              <th className="px-2 py-2">Total Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowTotals = calculated.rows[index] || {};
              const specificationText = [getTypeLabel(row), getPackageSizeLabel(row)].filter(Boolean).join(" · ");
              return (
                <tr key={`${row.size || "size"}-${index}`} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-extrabold">{getSizeLabel(row.size) || "Not set"}</td>
                  {hasDiameterData && <td className="px-2 py-2">{formatAppleDiameterRange(row) || "—"}</td>}
                  <td className="px-2 py-2">{positiveNumber(row.packageCount) ? formatNumber(row.packageCount, 0) : "—"}</td>
                  <td className="px-2 py-2">{specificationText || "—"}</td>
                  <td className="px-2 py-2">{positiveNumber(row.weightPerPackageKg) ? `${formatNumber(row.weightPerPackageKg)} kg` : "—"}</td>
                  {!isTrayPacked && <td className="px-2 py-2">{positiveNumber(row.piecesPerPackage) ? formatNumber(row.piecesPerPackage, 0) : "—"}</td>}
                  {isTrayPacked && <td className="px-2 py-2">{positiveNumber(row.traysPerPackage) ? formatNumber(row.traysPerPackage, 0) : "—"}</td>}
                  {isTrayPacked && <td className="px-2 py-2">{positiveNumber(row.piecesPerTray) ? formatNumber(row.piecesPerTray, 0) : "—"}</td>}
                  {isTrayPacked && <td className="px-2 py-2">{positiveNumber(rowTotals.piecesPerPackage) ? formatNumber(rowTotals.piecesPerPackage, 0) : "—"}</td>}
                  <td className="px-2 py-2">{positiveNumber(rowTotals.totalPieces) ? formatNumber(rowTotals.totalPieces, 0) : "—"}</td>
                  <td className="px-2 py-2">{positiveNumber(rowTotals.totalWeightKg) ? `${formatNumber(rowTotals.totalWeightKg)} kg` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Detail label="Total Packages" value={totalPackages ? formatNumber(totalPackages, 0) : ""} />
        <Detail label="Total Fruit Pieces" value={totalPieces ? formatNumber(totalPieces, 0) : ""} />
        <Detail label="Total Net Weight" value={totalWeightKg ? `${formatNumber(totalWeightKg)} kg` : ""} />
        <Detail label="Average Fruit Weight" value={averageFruitWeightGrams ? `${formatNumber(averageFruitWeightGrams)} g` : ""} />
      </div>
    </section>
  );
}
