# Smart Cloud DMS — Task List (What's Left to Build / Enhance)

> Based on the codebase audit: models exist for many features but routes, controllers, services, and frontend UI are missing. Below is everything remaining, organized by feature area.

---

## ✅ Already Built (Do Not Reassign)

| Feature | Backend | Frontend | AI (ragDMS) |
|---|---|---|---|
| JWT Auth (register, login, logout, me) | ✅ | ✅ | — |
| Forgot/Reset password | ✅ | ✅ | — |
| Personal workspace auto-creation | ✅ | ✅ | — |
| Create org workspace + seed roles | ✅ | ✅ | — |
| Workspace switcher + list | ✅ | ✅ | — |
| File upload to S3 (max 25MB) | ✅ | ✅ | — |
| List documents per workspace | ✅ | ✅ | — |
| Open/preview via presigned S3 URL | ✅ | ✅ | — |
| RAG chat (embed + vector search + LLM) | ✅ | ✅ | ✅ |
| Chat sessions (create, list, messages) | ✅ | ✅ | — |
| Semantic search (filename + vector) | ✅ | ✅ | ✅ |
| PDF/DOCX/PPTX/TXT parsing | — | — | ✅ |
| OCR fallback (Gemini Vision) | — | — | ✅ |
| AI categorization + keywords + summary | — | — | ✅ |
| Conversational chat handling | — | — | ✅ |

---

## 🔴 Priority 1 — Core Features (Models exist, no routes/controllers)

### 1. Folder Management
> Model: Folder.js — has `workspaceId`, `parentId`, `name`, `path`, `inheritAcl`

- `[ ]` **Backend**: Create `folderController.js` with CRUD:
  - `POST /api/workspaces/:workspaceId/folders` — create folder
  - `GET /api/workspaces/:workspaceId/folders` — list folders (tree or flat)
  - `PATCH /api/workspaces/:workspaceId/folders/:folderId` — rename/move folder
  - `DELETE /api/workspaces/:workspaceId/folders/:folderId` — delete (+ cascade docs)
- `[ ]` **Backend**: Update `documentController.js` to support `folderId` when uploading
- `[ ]` **Backend**: Add folder routes to `workspaceRoutes.js`
- `[ ]` **Frontend**: Folder tree sidebar or breadcrumb navigation in Documents page
- `[ ]` **Frontend**: Create folder modal/dialog
- `[ ]` **Frontend**: Move document to folder (drag-drop or dropdown)

### 2. Document Versioning
> Model: DocumentVersion.js — has `versionNumber`, `changeNote`, `processing` states

- `[ ]` **Backend**: Upload new version endpoint
  - `POST /api/workspaces/:workspaceId/documents/:documentId/versions` — upload new version
- `[ ]` **Backend**: List versions endpoint
  - `GET /api/workspaces/:workspaceId/documents/:documentId/versions`
- `[ ]` **Backend**: View specific version file
  - `GET /api/workspaces/:workspaceId/documents/:documentId/versions/:versionId/file`
- `[ ]` **Backend**: Revert to a previous version
- `[ ]` **Frontend**: Version history panel/modal in document detail view
- `[ ]` **Frontend**: "Upload new version" button on document card
- `[ ]` **Frontend**: Side-by-side or diff view for text documents

### 3. Document Operations (Delete, Trash, Restore)
> Model: Document.js — has `status: active | trash | deleted`

- `[ ]` **Backend**: Soft-delete (move to trash)
  - `DELETE /api/workspaces/:workspaceId/documents/:documentId` → sets status=trash
- `[ ]` **Backend**: Restore from trash
  - `POST /api/workspaces/:workspaceId/documents/:documentId/restore`
- `[ ]` **Backend**: Permanent delete (remove from S3 + DB)
- `[ ]` **Backend**: List trash endpoint with filter
- `[ ]` **Frontend**: Trash page/section
- `[ ]` **Frontend**: Delete confirmation modal
- `[ ]` **Frontend**: Restore button in trash view
- `[ ]` **Frontend**: Bulk select + bulk delete

---

## 🟡 Priority 2 — Access Control & Sharing (Models exist, no implementation)

### 4. Granular Permissions (ACL)
> Model: PermissionGrant.js — supports user/role/department/workspace principals with actions: view, edit, download, share, delete

- `[ ]` **Backend**: Create `permissionController.js`
  - `POST /api/workspaces/:workspaceId/permissions` — grant permission
  - `GET /api/workspaces/:workspaceId/documents/:documentId/permissions` — list grants
  - `DELETE /api/workspaces/:workspaceId/permissions/:grantId` — revoke
- `[ ]` **Backend**: Create `checkPermission` middleware that evaluates ACL before document actions
- `[ ]` **Backend**: Support `expiresAt` for time-limited access + TTL cleanup job
- `[ ]` **Backend**: Folder ACL inheritance (use `inheritAcl` flag)
- `[ ]` **Frontend**: "Share with..." modal on documents showing permission grants
- `[ ]` **Frontend**: Permission editor (select users/roles, pick actions, set expiry)

### 5. Share Links (Public/Password-Protected)
> Model: ShareLink.js — has `tokenHash`, `passwordHash`, `actions`, `expiresAt`, `maxViews`

- `[ ]` **Backend**: Create `shareLinkController.js`
  - `POST /api/workspaces/:workspaceId/documents/:documentId/links` — create share link
  - `GET /api/share/:token` — public access (no auth needed, check password if set)
  - `DELETE /api/workspaces/:workspaceId/links/:linkId` — revoke link
- `[ ]` **Backend**: View count tracking + max views enforcement
- `[ ]` **Backend**: Password verification flow
- `[ ]` **Frontend**: "Get link" button on document → generates copyable URL
- `[ ]` **Frontend**: Password input page for protected links
- `[ ]` **Frontend**: Share link management panel (list active links, revoke)

### 6. Access Requests
> Model: AccessRequest.js — has `requesterId`, `status: pending | approved | denied`

- `[ ]` **Backend**: Request access flow
  - `POST /api/workspaces/:workspaceId/documents/:documentId/access-requests`
  - `GET /api/workspaces/:workspaceId/access-requests` — list for admins
  - `PATCH /api/workspaces/:workspaceId/access-requests/:requestId` — approve/deny
- `[ ]` **Backend**: Auto-create PermissionGrant on approval
- `[ ]` **Frontend**: "Request access" button when user lacks permission
- `[ ]` **Frontend**: Admin panel to approve/deny requests

---

## 🟠 Priority 3 — Workspace Admin & Organization

### 7. Workspace Member Management
> Model: WorkspaceMember.js

- `[ ]` **Backend**: Member management endpoints
  - `GET /api/workspaces/:workspaceId/members` — list members
  - `POST /api/workspaces/:workspaceId/members` — invite member (by email)
  - `PATCH /api/workspaces/:workspaceId/members/:memberId` — change role
  - `DELETE /api/workspaces/:workspaceId/members/:memberId` — remove member
- `[ ]` **Frontend**: Members page with invite form
- `[ ]` **Frontend**: Role assignment dropdown per member

### 8. Department Management
> Model: Department.js

- `[ ]` **Backend**: CRUD endpoints for departments
  - `POST /api/workspaces/:workspaceId/departments`
  - `GET /api/workspaces/:workspaceId/departments`
  - `PATCH/DELETE` endpoints
- `[ ]` **Backend**: Assign members to departments
- `[ ]` **Frontend**: Department management page
- `[ ]` **Frontend**: Department-based document filtering

### 9. Role Management
> Model: Role.js — system roles exist (Owner, Admin, Manager, Employee)

- `[ ]` **Backend**: Custom role CRUD (non-system roles)
  - `POST /api/workspaces/:workspaceId/roles`
  - `GET /api/workspaces/:workspaceId/roles`
  - `PATCH/DELETE` for custom roles
- `[ ]` **Backend**: Permission matrix endpoint (which role can do what)
- `[ ]` **Frontend**: Role management page with permission toggles

### 10. Workspace Settings
- `[ ]` **Backend**: Update workspace name/settings
  - `PATCH /api/workspaces/:workspaceId`
- `[ ]` **Backend**: Storage usage tracking (per workspace quota)
- `[ ]` **Backend**: Category management (custom categories for AI classification)
- `[ ]` **Frontend**: Workspace settings page
- `[ ]` **Frontend**: Storage usage bar/chart

---

## 🔵 Priority 4 — Notifications & Audit

### 11. Notifications
> Model: Notification.js — types: shared, permission_changed, new_version, access_expiring, link_expiring, access_requested, access_expired

- `[ ]` **Backend**: Notification service — emit notifications on key events
- `[ ]` **Backend**: Notification endpoints
  - `GET /api/notifications` — list user notifications
  - `PATCH /api/notifications/:id/read` — mark as read
  - `POST /api/notifications/read-all`
- `[ ]` **Backend**: (Optional) WebSocket/SSE for real-time notifications
- `[ ]` **Frontend**: Notification bell icon with unread count badge
- `[ ]` **Frontend**: Notification dropdown/panel

### 12. Audit Trail
> Model: AuditEvent.js — has `action`, `resourceType`, `metadata`

- `[ ]` **Backend**: Audit logging service — log events (upload, delete, share, view, permission change)
- `[ ]` **Backend**: Audit query endpoint (admin only)
  - `GET /api/workspaces/:workspaceId/audit` — with filters by action, actor, date range
- `[ ]` **Frontend**: Audit log page (admin only) with filterable table
- `[ ]` **Frontend**: Per-document activity timeline

---

## 🟣 Priority 5 — AI/RAG Enhancements

### 13. Document Intelligence UI
- `[ ]` **Frontend**: Display AI summary, category, keywords on document detail/card
- `[ ]` **Frontend**: Show processing status (pending → running → ready/failed)
- `[ ]` **Frontend**: Re-process document button (trigger re-extraction)
- `[ ]` **Frontend**: Tag/category filter in document list

### 14. Search Enhancements
- `[ ]` **Frontend**: Search results page with highlighted snippets
- `[ ]` **Frontend**: Faceted search (filter by category, date, file type, tags)
- `[ ]` **Backend**: Full-text search with MongoDB Atlas Search index
- `[ ]` **Backend**: Tag-based search + AI category filtering

### 15. Chat UX Improvements
- `[ ]` **Frontend**: Markdown rendering in chat responses (bullets, tables, code blocks)
- `[ ]` **Frontend**: Clickable source citations → jump to document/page
- `[ ]` **Frontend**: Multi-document selection for scoped chat
- `[ ]` **Frontend**: Chat session rename/delete

---

## ⚪ Priority 6 — Polish & Deployment

### 16. Frontend Polish
- `[ ]` Document preview improvements (in-app PDF viewer, image gallery)
- `[ ]` Responsive mobile layout
- `[ ]` Dark/light theme toggle
- `[ ]` Keyboard shortcuts
- `[ ]` Drag-and-drop file upload
- `[ ]` Loading skeletons instead of spinners
- `[ ]` Error boundary + toast notification system

### 17. Backend Hardening
- `[ ]` Rate limiting on auth endpoints
- `[ ]` Input validation with Joi/Zod schemas
- `[ ]` File type validation (whitelist extensions)
- `[ ]` Storage quota enforcement per workspace
- `[ ]` CORS configuration (replace wildcard `*`)
- `[ ]` Scheduled cleanup: expired share links, expired permissions, orphaned S3 files

### 18. DevOps & Deployment
- `[ ]` Complete `docker-compose.yml` (Express + FastAPI + Mongo)
- `[ ]` Environment variable documentation (update `.env.example` files)
- `[ ]` CI/CD pipeline (lint, test, build, deploy)
- `[ ]` Atlas Vector Search index setup documentation
- `[ ]` Production build + static file serving config

---

## Summary by Member Assignment

| Area | Estimated Tasks | Suggested Assignee |
|---|---|---|
| Folder Management + Doc Ops | 14 tasks | Member A |
| Permissions + Sharing + Access Requests | 16 tasks | Member B |
| Workspace Admin (Members, Roles, Depts) | 14 tasks | Member C |
| Notifications + Audit | 10 tasks | Member D |
| AI/RAG Enhancements + Search | 10 tasks | Member E |
| Frontend Polish + DevOps | 13 tasks | All / Member F |