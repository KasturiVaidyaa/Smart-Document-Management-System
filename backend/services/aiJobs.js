import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { Workspace } from "../models/Workspace.js";
import { AiJob } from "../models/AiJob.js";
import { isProcessable, processDocumentJob } from "./aiService.js";

export async function allowedDocumentIds(workspaceId) {
  const docs = await Document.find({
    workspaceId,
    status: "active",
  }).select("_id");
  return docs.map((d) => String(d._id));
}

export async function enqueueProcessJob({
  workspace,
  document,
  version,
}) {
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
