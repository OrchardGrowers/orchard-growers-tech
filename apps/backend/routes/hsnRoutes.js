import express from "express";
import { searchHsn } from "../controllers/hsnController.js";

const router = express.Router();

router.get("/search", searchHsn);

export default router;
