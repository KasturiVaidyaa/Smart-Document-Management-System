import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { Workspace } from "../models/Workspace.js";
import {
  getDownloadUrl,
  headObject,
  putObject,
  s3Bucket,
  s3Key,
} from "../services/s3.js";
import { enqueueProcessJob } from "../services/aiJobs.js";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const serializeDocument = (doc) => {
  const version =
    doc.currentVersionId && typeof doc.currentVersionId === "object"
      ? doc.currentVersionId
      : null;
  return {
    _id: doc._id,
    workspaceId: doc.workspaceId,
    name: doc.name,
    mimeType: doc.mimeType,
    extension: doc.extension,
    sizeBytes: doc.sizeBytes,
    versionCount: doc.versionCount,
    status: doc.status,
    summary: doc.summary,
    aiCategory: doc.aiCategory,
    aiKeywords: doc.aiKeywords,
    processing: version?.processing || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastAccessedAt: doc.lastAccessedAt,
  };
};

export const listDocuments = TryCatch(async (req, res) => {
  const documents = await Document.find({
    workspaceId: req.workspace._id,
    status: "active",
  })
    .populate("currentVersionId", "processing")
    .sort({ updatedAt: -1 })
    .limit(100);

  res.json({ documents: documents.map(serializeDocument) });
});

export const createDocument = TryCatch(async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "File is required" });
  }
  if (file.size > MAX_FILE_BYTES) {
    return res.status(400).json({ message: "File must be 25MB or smaller" });
  }

  const quota = req.workspace.storageQuotaBytes || 0;
  const used = req.workspace.storageUsedBytes || 0;
  if (quota && used + file.size > quota) {
    return res.status(400).json({ message: "Workspace storage quota exceeded" });
  }

  const originalName = file.originalname || "untitled";
  const extension = originalName.includes(".")
    ? originalName.split(".").pop().toLowerCase()
    : "";

  const document = await Document.create({
    workspaceId: req.workspace._id,
    folderId: null,
    name: originalName,
    mimeType: file.mimetype,
    extension,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  const versionNumber = 1;
  const key = s3Key({
    workspaceId: req.workspace._id,
    documentId: document._id,
    versionNumber,
    filename: originalName,
  });

  try {
    await putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    let etag;
    try {
      const head = await headObject(key);
      etag = head.ETag;
    } catch {
      etag = undefined;
    }

    const version = await DocumentVersion.create({
      documentId: document._id,
      workspaceId: req.workspace._id,
      versionNumber,
      s3Bucket,
      s3Key: key,
      s3ETag: etag,
      sizeBytes: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user._id,
      processing: {
        extract: "pending",
        embed: "pending",
        classify: "pending",
      },
    });

    document.currentVersionId = version._id;
    document.versionCount = 1;
    document.sizeBytes = file.size;
    await document.save();

    await Workspace.updateOne(
      { _id: req.workspace._id },
      { $inc: { storageUsedBytes: file.size } }
    );

    enqueueProcessJob({
      workspace: req.workspace,
      document,
      version,
    }).catch((err) => console.error("Failed to enqueue AI job:", err.message));
  } catch (error) {
    await Document.deleteOne({ _id: document._id });
    const message =
      error.name === "AccessDenied" || error.Code === "AccessDenied"
        ? "S3 access denied. Check IAM permissions on this bucket."
        : error.message;
    return res.status(error.statusCode || 500).json({ message });
  }

  res.status(201).json({
    message: "Uploaded",
    document: serializeDocument(document),
  });
});

export const getDocumentFile = TryCatch(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    workspaceId: req.workspace._id,
    status: "active",
  });

  if (!document || !document.currentVersionId) {
    return res.status(404).json({ message: "Document not found" });
  }

  const version = await DocumentVersion.findById(document.currentVersionId);
  if (!version?.s3Key) {
    return res.status(404).json({ message: "File not found" });
  }

  document.lastAccessedAt = new Date();
  await document.save();

  const url = await getDownloadUrl(version.s3Key, { filename: document.name });
  res.json({
    url,
    name: document.name,
    mimeType: document.mimeType || version.mimeType,
    sizeBytes: document.sizeBytes,
  });
});
