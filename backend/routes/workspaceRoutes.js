import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import { requireWorkspace } from "../middlewares/requireWorkspace.js";
import {
  createOrgWorkspace,
  getWorkspace,
  listWorkspaces,
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
} from "../controllers/documentController.js";
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

// Workspace detail
router.get("/:workspaceId", requireWorkspace, getWorkspace);

export default router;
