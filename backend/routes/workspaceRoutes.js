import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import { requireWorkspace, requirePermission } from "../middlewares/requireWorkspace.js";
import {
  createOrgWorkspace,
  getWorkspace,
  listWorkspaces,
  listWorkspaceMembers,
  inviteWorkspaceMember,
  updateWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspace,
} from "../controllers/workspaceController.js";
import {
  bulkMoveDocuments,
  bulkPermanentDeleteDocuments,
  bulkRestoreDocuments,
  bulkTrashDocuments,
  createDocument,
  createDocumentVersion,
  getDocumentFile,
  getDocumentVersionFile,
  listDocumentVersions,
  listDocuments,
  moveDocument,
  permanentDeleteDocument,
  restoreDocument,
  revertDocumentVersion,
  trashDocument,
  updateDocumentDepartment,
  updateDocumentCategory,
} from "../controllers/documentController.js";
import { checkDocumentPermission } from "../middlewares/checkPermission.js";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "../controllers/folderController.js";
import {
  createChatSession,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  renameChatSession,
  sendChatMessage,
} from "../controllers/chatController.js";
import { searchDocuments } from "../controllers/searchController.js";
import uploadFile from "../middlewares/multer.js";
import {
  createPermission,
  listDocumentPermissions,
  deletePermission,
} from "../controllers/permissionController.js";
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from "../controllers/shareLinkController.js";
import {
  createAccessRequest,
  listAccessRequests,
  resolveAccessRequest,
} from "../controllers/accessRequestController.js";
import {
  createDepartment,
  listDepartments,
  updateDepartment,
  deleteDepartment,
  assignDepartmentMembers,
  removeDepartmentMember,
} from "../controllers/departmentController.js";
import {
  listAvailablePermissions,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/roleController.js";
import {
  getWorkspaceStorage,
  recalculateWorkspaceStorage,
} from "../controllers/storageController.js";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  resetDefaultCategories,
} from "../controllers/categoryController.js";
import { listAuditLogs } from "../controllers/auditController.js";

const router = express.Router();

router.use(isAuth);

// Workspaces
router.get("/", listWorkspaces);
router.post("/", createOrgWorkspace);

// Folders
router.get("/:workspaceId/folders", requireWorkspace, listFolders);
router.post("/:workspaceId/folders", requireWorkspace, createFolder);
router.patch("/:workspaceId/folders/:folderId", requireWorkspace, updateFolder);
router.delete("/:workspaceId/folders/:folderId", requireWorkspace, deleteFolder);

// Documents listing & creation
router.get("/:workspaceId/documents", requireWorkspace, listDocuments);
router.post(
  "/:workspaceId/documents",
  requireWorkspace,
  uploadFile,
  createDocument
);

// Bulk document operations (MUST precede parameterized :documentId routes)
router.post("/:workspaceId/documents/bulk-trash", requireWorkspace, bulkTrashDocuments);
router.post("/:workspaceId/documents/bulk-restore", requireWorkspace, bulkRestoreDocuments);
router.post("/:workspaceId/documents/bulk-delete", requireWorkspace, bulkPermanentDeleteDocuments);
router.post("/:workspaceId/documents/bulk-move", requireWorkspace, bulkMoveDocuments);

// Single document operations
router.get(
  "/:workspaceId/documents/:documentId/file",
  requireWorkspace,
  getDocumentFile
);
router.patch(
  "/:workspaceId/documents/:documentId/move",
  requireWorkspace,
  moveDocument
);
router.patch(
  "/:workspaceId/documents/:documentId/department",
  requireWorkspace,
  checkDocumentPermission("edit"),
  updateDocumentDepartment
);
router.patch(
  "/:workspaceId/documents/:documentId/category",
  requireWorkspace,
  checkDocumentPermission("edit"),
  updateDocumentCategory
);
router.patch(
  "/:workspaceId/documents/:documentId/trash",
  requireWorkspace,
  trashDocument
);
router.post(
  "/:workspaceId/documents/:documentId/restore",
  requireWorkspace,
  restoreDocument
);
router.delete(
  "/:workspaceId/documents/:documentId/permanent",
  requireWorkspace,
  permanentDeleteDocument
);

// Document Versioning
router.get(
  "/:workspaceId/documents/:documentId/versions",
  requireWorkspace,
  listDocumentVersions
);
router.post(
  "/:workspaceId/documents/:documentId/versions",
  requireWorkspace,
  uploadFile,
  createDocumentVersion
);
router.get(
  "/:workspaceId/documents/:documentId/versions/:versionId/file",
  requireWorkspace,
  getDocumentVersionFile
);
router.post(
  "/:workspaceId/documents/:documentId/versions/:versionId/revert",
  requireWorkspace,
  revertDocumentVersion
);

// Search & Chat
router.get("/:workspaceId/search", requireWorkspace, searchDocuments);
router.get("/:workspaceId/chat/sessions", requireWorkspace, listChatSessions);
router.post("/:workspaceId/chat/sessions", requireWorkspace, createChatSession);
router.get(
  "/:workspaceId/chat/sessions/:sessionId/messages",
  requireWorkspace,
  listChatMessages
);
router.patch(
  "/:workspaceId/chat/sessions/:sessionId",
  requireWorkspace,
  renameChatSession
);
router.delete(
  "/:workspaceId/chat/sessions/:sessionId",
  requireWorkspace,
  deleteChatSession
);
router.post("/:workspaceId/chat", requireWorkspace, sendChatMessage);

// Permissions (ACL)
router.post(
  "/:workspaceId/permissions",
  requireWorkspace,
  requirePermission("sharing.manage"),
  createPermission
);
router.get(
  "/:workspaceId/documents/:documentId/permissions",
  requireWorkspace,
  listDocumentPermissions
);
router.delete(
  "/:workspaceId/permissions/:grantId",
  requireWorkspace,
  requirePermission("sharing.manage"),
  deletePermission
);

// Share Links (authenticated management)
router.post(
  "/:workspaceId/documents/:documentId/links",
  requireWorkspace,
  requirePermission("sharing.manage"),
  createShareLink
);
router.get(
  "/:workspaceId/documents/:documentId/links",
  requireWorkspace,
  listShareLinks
);
router.delete(
  "/:workspaceId/links/:linkId",
  requireWorkspace,
  requirePermission("sharing.manage"),
  revokeShareLink
);

// Access Requests
router.post(
  "/:workspaceId/documents/:documentId/access-requests",
  requireWorkspace,
  createAccessRequest
);
router.get(
  "/:workspaceId/access-requests",
  requireWorkspace,
  requirePermission("sharing.manage"),
  listAccessRequests
);
router.patch(
  "/:workspaceId/access-requests/:requestId",
  requireWorkspace,
  requirePermission("sharing.manage"),
  resolveAccessRequest
);

// Workspace Members
router.get("/:workspaceId/members", requireWorkspace, listWorkspaceMembers);
router.post(
  "/:workspaceId/members",
  requireWorkspace,
  requirePermission("members.invite"),
  inviteWorkspaceMember
);
router.patch(
  "/:workspaceId/members/:memberId",
  requireWorkspace,
  updateWorkspaceMember
);
router.delete(
  "/:workspaceId/members/:memberId",
  requireWorkspace,
  requirePermission("roles.manage"),
  removeWorkspaceMember
);

// Departments
router.get("/:workspaceId/departments", requireWorkspace, listDepartments);
router.post(
  "/:workspaceId/departments",
  requireWorkspace,
  requirePermission("departments.manage"),
  createDepartment
);
router.patch(
  "/:workspaceId/departments/:departmentId",
  requireWorkspace,
  requirePermission("departments.manage"),
  updateDepartment
);
router.delete(
  "/:workspaceId/departments/:departmentId",
  requireWorkspace,
  requirePermission("departments.manage"),
  deleteDepartment
);
router.post(
  "/:workspaceId/departments/:departmentId/members",
  requireWorkspace,
  requirePermission("departments.manage"),
  assignDepartmentMembers
);
router.delete(
  "/:workspaceId/departments/:departmentId/members/:memberId",
  requireWorkspace,
  requirePermission("departments.manage"),
  removeDepartmentMember
);

// Roles & Permissions
router.get("/:workspaceId/roles/permissions", requireWorkspace, listAvailablePermissions);
router.get("/:workspaceId/roles", requireWorkspace, listRoles);
router.post(
  "/:workspaceId/roles",
  requireWorkspace,
  requirePermission("roles.manage"),
  createRole
);
router.patch(
  "/:workspaceId/roles/:roleId",
  requireWorkspace,
  requirePermission("roles.manage"),
  updateRole
);
router.delete(
  "/:workspaceId/roles/:roleId",
  requireWorkspace,
  requirePermission("roles.manage"),
  deleteRole
);

// Workspace detail & settings
router.get("/:workspaceId", requireWorkspace, getWorkspace);
router.patch(
  "/:workspaceId",
  requireWorkspace,
  requirePermission("roles.manage"),
  updateWorkspace
);

// Storage Usage & Quota (Phase 7)
router.get(
  "/:workspaceId/storage",
  requireWorkspace,
  requirePermission("storage.view"),
  getWorkspaceStorage
);
router.post(
  "/:workspaceId/storage/recalculate",
  requireWorkspace,
  requirePermission("roles.manage"),
  recalculateWorkspaceStorage
);

// AI Categories Taxonomy (Phase 8)
router.get("/:workspaceId/categories", requireWorkspace, listCategories);
router.post(
  "/:workspaceId/categories",
  requireWorkspace,
  requirePermission("roles.manage"),
  createCategory
);
router.patch(
  "/:workspaceId/categories/:categoryName",
  requireWorkspace,
  requirePermission("roles.manage"),
  updateCategory
);
router.delete(
  "/:workspaceId/categories/:categoryName",
  requireWorkspace,
  requirePermission("roles.manage"),
  deleteCategory
);
router.post(
  "/:workspaceId/categories/reset",
  requireWorkspace,
  requirePermission("roles.manage"),
  resetDefaultCategories
);

// Audit Trail (Phase 4 / Member D)
router.get(
  "/:workspaceId/audit",
  requireWorkspace,
  requirePermission("audit.view"),
  listAuditLogs
);

export default router;
