export function getEfruitMandiProducts(products) {
  return (Array.isArray(products) ? products : []).filter(
    (product) => product?.createdSource !== "admin-panel"
  );
}
