import express from "express";
import {
  createProduct,
  deleteProduct,
  generateSku,
  getNextLotNo,
  getProductById,
  getProducts,
} from "../controllers/productController.js";

import protect, { authorize, optionalProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// CREATE PRODUCT WITH IMAGE
router.post(
  "/",
  protect,
  authorize("grower"),
  upload.any(),
  createProduct
);

router.get("/", optionalProtect, getProducts);
router.get("/generate-sku", protect, generateSku);
router.get("/next-lot-no", protect, authorize("grower"), getNextLotNo);
router.get("/:id", optionalProtect, getProductById);
router.delete("/:id", protect, authorize("grower"), deleteProduct);

export default router;
