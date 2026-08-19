import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  downloadTransactionDocumentPdf,
  getTransactionDocument,
  listMyTransactionDocuments,
} from "../controllers/transactionDocumentController.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

router.get("/", protect, wrapAsync(listMyTransactionDocuments));
router.get("/:id", protect, wrapAsync(getTransactionDocument));
router.get("/:id/pdf", protect, wrapAsync(downloadTransactionDocumentPdf));

export default router;

