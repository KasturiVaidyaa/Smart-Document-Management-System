import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import { requireWorkspace } from "../middlewares/requireWorkspace.js";
import {
  createOrgWorkspace,
  getWorkspace,
  listWorkspaces,
} from "../controllers/workspaceController.js";
import {
  createDocument,
  getDocumentFile,
  listDocuments,
} from "../controllers/documentController.js";
import {
  createChatSession,
  listChatMessages,
  listChatSessions,
  sendChatMessage,
  renameChatSession,
  deleteChatSession,
} from "../controllers/chatController.js";
import { searchDocuments } from "../controllers/searchController.js";
import uploadFile from "../middlewares/multer.js";

const router = express.Router();

router.use(isAuth);
router.get("/", listWorkspaces);
router.post("/", createOrgWorkspace);
router.get("/:workspaceId/documents", requireWorkspace, listDocuments);
router.post(
  "/:workspaceId/documents",
  requireWorkspace,
  uploadFile,
  createDocument
);
router.get(
  "/:workspaceId/search",
  requireWorkspace,
  searchDocuments
);
router.get(
  "/:workspaceId/chat/sessions",
  requireWorkspace,
  listChatSessions
);
router.post(
  "/:workspaceId/chat/sessions",
  requireWorkspace,
  createChatSession
);
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
router.get(
  "/:workspaceId/documents/:documentId/file",
  requireWorkspace,
  getDocumentFile
);
router.get("/:workspaceId", requireWorkspace, getWorkspace);

export default router;
