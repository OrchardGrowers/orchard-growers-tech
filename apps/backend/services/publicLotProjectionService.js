const fields = (values) => Object.freeze(values).join(" ");

export const PUBLIC_LOT_SEARCH_SELECT = fields([
  "title", "fruitName", "variety", "description", "location", "lotNo",
  "quantity", "status", "images", "imageObjects", "gradeLots", "createdBy", "createdAt",
]);

export const PUBLIC_PROFILE_MARKET_LOT_SELECT = fields([
  "_id", "title", "fruitName", "variety", "quality", "gradeLots", "quantity", "unit",
  "finalPrice", "finalDealValue", "location", "images", "imageObjects", "status", "active",
  "auctionEndTime", "createdAt", "updatedAt", "createdBy", "createdSource", "inventoryType",
]);
