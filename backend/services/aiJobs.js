import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { Workspace } from "../models/Workspace.js";
import { AiJob } from "../models/AiJob.js";
import { isProcessable, processDocumentJob } from "./aiService.js";

/**
 * Returns ALL active document IDs in a workspace.
 * Used as the base allowlist for RAG — downstream callers narrow it further.
 */
export async function allowedDocumentIds(workspaceId) {
  const docs = await Document.find({
    workspaceId,
    status: "active",
  }).select("_id");
  return docs.map((d) => String(d._id));
}

/**
 * Returns active document IDs inside a specific folder (recursive sub-folders).
 * @param {string|ObjectId} workspaceId
 * @param {string|ObjectId} folderId  — the root folder to scope to
 */
export async function folderDocumentIds(workspaceId, folderId) {
  // Collect all folder IDs in the subtree (BFS)
  const { Folder } = await import("../models/Folder.js");
  const visited = new Set([String(folderId)]);
  const queue = [String(folderId)];

  while (queue.length) {
    const current = queue.shift();
    const children = await Folder.find({
      workspaceId,
      parentId: current,
    }).select("_id");
    for (const child of children) {
      const id = String(child._id);
      if (!visited.has(id)) {
        visited.add(id);
        queue.push(id);
      }
    }
  }

  const docs = await Document.find({
    workspaceId,
    folderId: { $in: Array.from(visited) },
    status: "active",
  }).select("_id");

  return docs.map((d) => String(d._id));
}

/**
 * Resolves the effective allowedDocumentIds for a chat request.
 *
 * Priority:
 *  1. scope === "document"  → [session.documentId]
 *  2. scope === "folder"    → all docs in session.folderId (recursive)
 *  3. scope === "multi"     → session.documentIds (pre-saved)
 *  4. req.body.documentIds  → caller-supplied override (used when starting fresh)
 *  5. req.body.folderId     → caller-supplied folder (used when starting fresh)
 *  6. "workspace"           → all docs in workspace
 *
 * All resolved IDs are intersected with the workspace allowlist (active docs only).
 */
export async function resolveAllowedIds({ workspaceId, session, body }) {
  const base = await allowedDocumentIds(workspaceId);
  const baseSet = new Set(base);

  const intersect = (ids) =>
    ids.map(String).filter((id) => baseSet.has(id));

  // Single-document scope (session-saved)
  if (session.scope === "document" && session.documentId) {
    return intersect([session.documentId]);
  }

  // Folder scope (session-saved)
  if (session.scope === "folder" && session.folderId) {
    const ids = await folderDocumentIds(workspaceId, session.folderId);
    return intersect(ids);
  }

  // Multi-doc scope (session-saved)
  if (session.scope === "multi" && session.documentIds?.length) {
    return intersect(session.documentIds);
  }

  // Caller-supplied documentIds override (fresh/unsaved scope)
  if (body?.documentIds?.length) {
    return intersect(body.documentIds);
  }

  // Caller-supplied folderId override (fresh/unsaved folder chat)
  if (body?.folderId) {
    const ids = await folderDocumentIds(workspaceId, body.folderId);
    return intersect(ids);
  }

  // Workspace-wide: return full allowlist
  return base;
}

// ─── Job management (unchanged) ───────────────────────────────────────────────

export async function enqueueProcessJob({ workspace, document, version }) {
  if (!isProcessable(document.extension)) {
    return null;
  }

  const job = await AiJob.create({
    workspaceId: workspace._id,
    documentId: document._id,
    versionId: version._id,
    type: "process",
    status: "queued",
  });

  setImmediate(() => {
    runProcessJob({ workspace, document, version, job }).catch((err) => {
      console.error("AI process job failed:", err.message);
    });
  });

  return job;
}

async function runProcessJob({ workspace, document, version, job }) {
  job.status = "running";
  await job.save();

  try {
    const result = await processDocumentJob({
      workspaceId: String(workspace._id),
      documentId: String(document._id),
      versionId: String(version._id),
      s3Key: version.s3Key,
      categories: workspace.settings?.categories || [],
    });

    if (result?.status === "failed") {
      job.status = "failed";
      job.error = "AI service returned failed";
      await job.save();
      return;
    }

    job.status = "ready";
    job.error = undefined;
    await job.save();
  } catch (error) {
    job.status = "failed";
    job.error = error.response?.data?.detail || error.message;
    await job.save();
  }
}

export async function requeueStuckJobs() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const stuck = await AiJob.find({
    status: "running",
    updatedAt: { $lt: cutoff },
  }).limit(20);

  for (const job of stuck) {
    job.status = "queued";
    await job.save();
    const [workspace, document, version] = await Promise.all([
      Workspace.findById(job.workspaceId),
      Document.findById(job.documentId),
      DocumentVersion.findById(job.versionId),
    ]);
    if (!workspace || !document || !version?.s3Key) continue;
    runProcessJob({ workspace, document, version, job }).catch((err) => {
      console.error("AI requeue failed:", err.message);
    });
  }
  return stuck.length;
}
