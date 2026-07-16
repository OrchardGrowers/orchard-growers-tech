const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const roundToTwoDecimals = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const calculatePackingTotals = (packingBreakdown = [], packingType = "") => {
  const trayPacked = packingType === "Tray Packed Carton";
  const rows = (Array.isArray(packingBreakdown) ? packingBreakdown : []).map((row) => {
    const totalPackages = positiveNumber(row.packageCount);
    const packageCapacityKg = positiveNumber(row.weightPerPackageKg);
    const piecesPerPackage = trayPacked
      ? positiveNumber(row.traysPerPackage) * positiveNumber(row.piecesPerTray)
      : positiveNumber(row.piecesPerPackage);
    const hasCalculablePieces = Boolean(row.size) && piecesPerPackage > 0;

    return {
      totalPackages,
      piecesPerPackage: hasCalculablePieces ? piecesPerPackage : null,
      totalPieces: hasCalculablePieces ? totalPackages * piecesPerPackage : null,
      totalWeightKg: roundToTwoDecimals(totalPackages * packageCapacityKg),
    };
  });

  const totalPackages = rows.reduce((total, row) => total + row.totalPackages, 0);
  const calculablePieceRows = rows.filter((row) => row.totalPieces !== null);
  const totalPieces = calculablePieceRows.length
    ? calculablePieceRows.reduce((total, row) => total + row.totalPieces, 0)
    : null;
  const totalWeightKg = roundToTwoDecimals(
    rows.reduce((total, row) => total + row.totalWeightKg, 0)
  );
  const averageFruitWeightGrams =
    totalWeightKg > 0 && totalPieces > 0
      ? roundToTwoDecimals((totalWeightKg * 1000) / totalPieces)
      : null;

  return {
    totalPackages,
    totalPieces,
    totalWeightKg,
    averageFruitWeightGrams,
    rows,
  };
};
