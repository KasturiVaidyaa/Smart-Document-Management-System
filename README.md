# Smart Cloud DMS

Secure cloud platform for storing, organizing, searching, and sharing documents with access control.

**Stack:** React (Vite) talks only to Express. RAG/document intelligence will run on a private FastAPI service. MongoDB Atlas Search + Vector Search (no Elasticsearch). Files live in S3 in Phase 2.

Keep using `backend/` and `frontend/` in this repo. The FastAPI RAG service is `ragDMS-main/` (not the old `ai/` stub). Architecture lives in `archm.md`; build order in `plan.md`.

## Phase 1 (current)

- JWT cookie auth: register, login, logout, me
- Signup creates a **personal workspace** + owner membership in one transaction
- List workspaces + create an organization (seeds Owner/Admin/Manager/Employee roles)
- Workspace membership middleware for `/api/workspaces/:workspaceId`
- React login/register + workspace switcher

## Phase 2 (started)

- Upload files through Express into S3 (max 25MB)
- List documents per workspace
- Open/preview via short-lived S3 GET URLs (images and PDFs inline)

Required extra env: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` (or `S3_BUCKET_NAME`), `S3_ENV_PREFIX`.

IAM on the bucket needs `s3:PutObject`, `s3:GetObject`, and `s3:HeadObject`. Public-read is not required.

## Prerequisites

- Node.js 18+
- MongoDB (Atlas, or `docker compose up -d` for local)

## Environment

Copy [`.env.example`](.env.example) to `.env` in the **repo root**. Copy [`frontend/.env.example`](frontend/.env.example) to `frontend/.env`.

Required to run Phase 1: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`.

## Run

```bash
npm install
cd frontend && npm install && cd ..

npm run dev          # Express on http://localhost:5005
cd frontend && npm run dev   # Vite on http://localhost:5173
```

AI service (`ragDMS-main`) — React never talks to FastAPI. Express sends `X-Internal-Token` and `allowedDocumentIds`. Use the same port as `AI_SERVICE_URL` in the root `.env` (currently `8100`):

```bash
cd ragDMS-main
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

If Atlas Vector Search is not set up, RAG uses cosine similarity over stored embeddings.

## Auth API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | Creates user + personal workspace; sets httpOnly cookie |
| POST | `/api/auth/login` | |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | JWT required |
| POST | `/api/auth/forgot` | Optional email OTP |
| POST | `/api/auth/reset-password/:token` | |
| GET | `/api/workspaces` | Memberships for current user |
| POST | `/api/workspaces` | Create organization |
| GET | `/api/workspaces/:workspaceId` | Membership check |
| GET | `/api/workspaces/:workspaceId/documents` | List files |
| POST | `/api/workspaces/:workspaceId/documents` | Multipart field `file` |
| GET | `/api/workspaces/:workspaceId/documents/:documentId/file` | Presigned view URL |
| GET | `/api/workspaces/:workspaceId/search?q=` | Filename + semantic search |
| GET | `/api/workspaces/:workspaceId/chat/sessions` | Chat sessions |
| POST | `/api/workspaces/:workspaceId/chat` | RAG question |

Existing `users` documents from the old role1–4 template are incompatible (they used `password` instead of `passwordHash`). Use a fresh DB name (`smart_cloud_dms`) or drop the old collection.
