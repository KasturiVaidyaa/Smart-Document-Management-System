import express from "express";
import {
  resolveShareLink,
  accessShareLinkFile,
} from "../controllers/shareLinkController.js";

const router = express.Router();

// Public routes — no authentication required
router.get("/:token", resolveShareLink);
router.post("/:token/file", accessShareLinkFile);

export default router;
