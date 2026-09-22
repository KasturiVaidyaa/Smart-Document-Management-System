import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import { requireWorkspace, requirePermission } from "../middlewares/requireWorkspace.js";
import { listAuditLogs } from "../controllers/auditController.js";

const router = express.Router({ mergeParams: true });

router.use(isAuth);

/**
 * GET /api/workspaces/:workspaceId/audit
 * Scoped strictly to requested workspace, requires "audit.view" permission or workspace owner.
 */
router.get(
  "/:workspaceId/audit",
  requireWorkspace,
  requirePermission("audit.view"),
  listAuditLogs
);

export default router;
