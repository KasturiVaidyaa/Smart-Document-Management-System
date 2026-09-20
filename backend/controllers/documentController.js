import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { DocumentChunk } from "../models/DocumentChunk.js";
import { Folder } from "../models/Folder.js";
import { Workspace } from "../models/Workspace.js";
import {
  copyObject,
  deleteObject,
  getDownloadUrl,
  headObject,
  putObject,
  s3Bucket,
  s3Key,
} from "../services/s3.js";
import { enqueueProcessJob } from "../services/aiJobs.js";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const serializeDocument = (doc) => {
  const version =
    doc.currentVersionId && typeof doc.currentVersionId === "object"
      ? doc.currentVersionId
      : null;
  return {
    _id: doc._id,
    workspaceId: doc.workspaceId,
    folderId: doc.folderId || null,
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
  const { folderId, status } = req.query;
  const filter = {
    workspaceId: req.workspace._id,
    status: status ? status : "active",
  };

  if (folderId !== undefined) {
    if (folderId === "root" || folderId === "null" || folderId === "") {
      filter.folderId = null;
    } else if (folderId !== "all" && mongoose.Types.ObjectId.isValid(folderId)) {
      filter.folderId = folderId;
    }
  }

  const documents = await Document.find(filter)
    .populate("currentVersionId", "processing")
    .sort({ updatedAt: -1 })
    .limit(200);

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

  let assignedFolderId = null;
  const rawFolderId = req.body.folderId;
  if (rawFolderId && rawFolderId !== "root" && rawFolderId !== "null" && rawFolderId !== "undefined") {
    if (!mongoose.Types.ObjectId.isValid(rawFolderId)) {
      return res.status(400).json({ message: "Invalid folder id" });
    }
    const folder = await Folder.findOne({
      _id: rawFolderId,
      workspaceId: req.workspace._id,
    });
    if (!folder) {
      return res.status(404).json({ message: "Specified folder not found in this workspace" });
    }
    assignedFolderId = folder._id;
  }

  const originalName = file.originalname || "untitled";
  const extension = originalName.includes(".")
    ? originalName.split(".").pop().toLowerCase()
    : "";

  const document = await Document.create({
    workspaceId: req.workspace._id,
    folderId: assignedFolderId,
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

export const moveDocument = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  const { folderId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  let targetFolderId = null;
  if (folderId && folderId !== "root" && folderId !== "null") {
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ message: "Invalid target folder id" });
    }
    const folder = await Folder.findOne({
      _id: folderId,
      workspaceId: req.workspace._id,
    });
    if (!folder) {
      return res.status(404).json({ message: "Target folder not found in this workspace" });
    }
    targetFolderId = folder._id;
  }

  document.folderId = targetFolderId;
  document.updatedBy = req.user._id;
  await document.save();

  res.json({
    message: "Document moved",
    document: serializeDocument(document),
  });
});

export const trashDocument = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
    status: "active",
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found or already in trash" });
  }

  document.status = "trash";
  document.updatedBy = req.user._id;
  await document.save();

  res.json({
    message: "Document moved to trash",
    document: serializeDocument(document),
  });
});

export const restoreDocument = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
    status: "trash",
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found in trash" });
  }

  if (document.folderId) {
    const folderExists = await Folder.findOne({
      _id: document.folderId,
      workspaceId: req.workspace._id,
    });
    if (!folderExists) {
      document.folderId = null;
    }
  }

  document.status = "active";
  document.updatedBy = req.user._id;
  await document.save();

  res.json({
    message: "Document restored",
    document: serializeDocument(document),
  });
});

export const permanentDeleteDocument = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  const versions = await DocumentVersion.find({
    documentId: document._id,
    workspaceId: req.workspace._id,
  });

  for (const v of versions) {
    if (v.s3Key) {
      try {
        await deleteObject(v.s3Key);
      } catch (err) {
        if (err.name === "NoSuchKey" || err.Code === "NoSuchKey" || err.name === "NotFound") {
          // Object is already gone from S3
          continue;
        }
        console.error("Failed to delete S3 key:", v.s3Key, err.message);
        const isAccessDenied =
          err.name === "AccessDenied" ||
          err.Code === "AccessDenied" ||
          err.message?.includes("AccessDenied") ||
          err.message?.includes("s3:DeleteObject");

        if (isAccessDenied) {
          return res.status(403).json({
            message:
              "Cannot permanently delete document: AWS S3 rejected deletion because your IAM user is missing the 's3:DeleteObject' permission. Please add 's3:DeleteObject' to your AWS IAM policy to allow file removal from S3.",
            error: err.message,
          });
        }

        return res.status(500).json({
          message: `Failed to delete file from S3 bucket: ${err.message}`,
        });
      }
    }
  }

  const totalBytes = versions.reduce((sum, v) => sum + (v.sizeBytes || 0), 0);

  await DocumentVersion.deleteMany({ documentId: document._id });
  await DocumentChunk.deleteMany({ documentId: document._id });
  await Document.deleteOne({ _id: document._id });

  if (totalBytes > 0) {
    await Workspace.updateOne(
      { _id: req.workspace._id },
      { $inc: { storageUsedBytes: -totalBytes } }
    );
  }

  res.json({
    message: "Document and all S3 files permanently deleted",
    freedBytes: totalBytes,
  });
});

export const bulkTrashDocuments = TryCatch(async (req, res) => {
  const { documentIds } = req.body;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ message: "documentIds array is required" });
  }

  const validIds = documentIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const result = await Document.updateMany(
    {
      _id: { $in: validIds },
      workspaceId: req.workspace._id,
      status: "active",
    },
    {
      status: "trash",
      updatedBy: req.user._id,
    }
  );

  res.json({
    message: `${result.modifiedCount} documents moved to trash`,
    modifiedCount: result.modifiedCount,
  });
});

export const bulkRestoreDocuments = TryCatch(async (req, res) => {
  const { documentIds } = req.body;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ message: "documentIds array is required" });
  }

  const validIds = documentIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const docs = await Document.find({
    _id: { $in: validIds },
    workspaceId: req.workspace._id,
    status: "trash",
  });

  let restoredCount = 0;
  for (const doc of docs) {
    if (doc.folderId) {
      const folderExists = await Folder.findOne({
        _id: doc.folderId,
        workspaceId: req.workspace._id,
      });
      if (!folderExists) {
        doc.folderId = null;
      }
    }
    doc.status = "active";
    doc.updatedBy = req.user._id;
    await doc.save();
    restoredCount++;
  }

  res.json({
    message: `${restoredCount} documents restored`,
    restoredCount,
  });
});

export const bulkPermanentDeleteDocuments = TryCatch(async (req, res) => {
  const { documentIds } = req.body;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ message: "documentIds array is required" });
  }

  const validIds = documentIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const versions = await DocumentVersion.find({
    documentId: { $in: validIds },
    workspaceId: req.workspace._id,
  });

  for (const v of versions) {
    if (v.s3Key) {
      try {
        await deleteObject(v.s3Key);
      } catch (err) {
        if (err.name === "NoSuchKey" || err.Code === "NoSuchKey" || err.name === "NotFound") {
          continue;
        }
        console.error("Failed to delete S3 key:", v.s3Key, err.message);
        const isAccessDenied =
          err.name === "AccessDenied" ||
          err.Code === "AccessDenied" ||
          err.message?.includes("AccessDenied") ||
          err.message?.includes("s3:DeleteObject");

        if (isAccessDenied) {
          return res.status(403).json({
            message:
              "Cannot permanently delete documents: AWS S3 rejected deletion because your IAM user is missing the 's3:DeleteObject' permission. Please add 's3:DeleteObject' to your AWS IAM policy to allow file removal from S3.",
            error: err.message,
          });
        }

        return res.status(500).json({
          message: `Failed to delete files from S3 bucket: ${err.message}`,
        });
      }
    }
  }

  const totalBytes = versions.reduce((sum, v) => sum + (v.sizeBytes || 0), 0);

  await DocumentVersion.deleteMany({ documentId: { $in: validIds } });
  await DocumentChunk.deleteMany({ documentId: { $in: validIds } });
  const result = await Document.deleteMany({
    _id: { $in: validIds },
    workspaceId: req.workspace._id,
  });

  if (totalBytes > 0) {
    await Workspace.updateOne(
      { _id: req.workspace._id },
      { $inc: { storageUsedBytes: -totalBytes } }
    );
  }

  res.json({
    message: `${result.deletedCount} documents and their S3 version files permanently deleted`,
    deletedCount: result.deletedCount,
    freedBytes: totalBytes,
  });
});

export const bulkMoveDocuments = TryCatch(async (req, res) => {
  const { documentIds, folderId } = req.body;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ message: "documentIds array is required" });
  }

  let targetFolderId = null;
  if (folderId && folderId !== "root" && folderId !== "null") {
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ message: "Invalid target folder id" });
    }
    const folder = await Folder.findOne({
      _id: folderId,
      workspaceId: req.workspace._id,
    });
    if (!folder) {
      return res.status(404).json({ message: "Target folder not found in this workspace" });
    }
    targetFolderId = folder._id;
  }

  const validIds = documentIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const result = await Document.updateMany(
    {
      _id: { $in: validIds },
      workspaceId: req.workspace._id,
    },
    {
      folderId: targetFolderId,
      updatedBy: req.user._id,
    }
  );

  res.json({
    message: `${result.modifiedCount} documents moved`,
    modifiedCount: result.modifiedCount,
  });
});

export const createDocumentVersion = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  const file = req.file;

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  if (!file) {
    return res.status(400).json({ message: "File is required for new version" });
  }

  if (file.size > MAX_FILE_BYTES) {
    return res.status(400).json({ message: "File must be 25MB or smaller" });
  }

  const quota = req.workspace.storageQuotaBytes || 0;
  const used = req.workspace.storageUsedBytes || 0;
  if (quota && used + file.size > quota) {
    return res.status(400).json({ message: "Workspace storage quota exceeded" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
    status: { $ne: "deleted" },
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found in this workspace" });
  }

  const lastVersion = await DocumentVersion.findOne({
    documentId: document._id,
  }).sort({ versionNumber: -1 });

  const nextVersionNumber = (lastVersion?.versionNumber || document.versionCount || 0) + 1;
  const originalName = file.originalname || document.name;
  const key = s3Key({
    workspaceId: req.workspace._id,
    documentId: document._id,
    versionNumber: nextVersionNumber,
    filename: originalName,
  });

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
    versionNumber: nextVersionNumber,
    s3Bucket,
    s3Key: key,
    s3ETag: etag,
    sizeBytes: file.size,
    mimeType: file.mimetype,
    uploadedBy: req.user._id,
    changeNote: req.body.changeNote?.trim() || "",
    processing: {
      extract: "pending",
      embed: "pending",
      classify: "pending",
    },
  });

  document.currentVersionId = version._id;
  document.versionCount = nextVersionNumber;
  document.sizeBytes = file.size;
  document.mimeType = file.mimetype;
  document.updatedBy = req.user._id;
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

  res.status(201).json({
    message: `Version ${nextVersionNumber} uploaded successfully`,
    version,
    document: serializeDocument(document),
  });
});

export const listDocumentVersions = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  const versions = await DocumentVersion.find({
    documentId: document._id,
    workspaceId: req.workspace._id,
  })
    .populate("uploadedBy", "name email")
    .sort({ versionNumber: -1 });

  res.json({
    versions,
    currentVersionId: document.currentVersionId,
  });
});

export const getDocumentVersionFile = TryCatch(async (req, res) => {
  const { documentId, versionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(versionId)) {
    return res.status(400).json({ message: "Invalid document or version id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  const version = await DocumentVersion.findOne({
    _id: versionId,
    documentId: document._id,
    workspaceId: req.workspace._id,
  });

  if (!version?.s3Key) {
    return res.status(404).json({ message: "Version file not found in storage" });
  }

  const url = await getDownloadUrl(version.s3Key, {
    filename: `v${version.versionNumber}_${document.name}`,
  });

  res.json({
    url,
    name: document.name,
    mimeType: version.mimeType || document.mimeType,
    sizeBytes: version.sizeBytes,
    versionNumber: version.versionNumber,
  });
});

export const revertDocumentVersion = TryCatch(async (req, res) => {
  const { documentId, versionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(versionId)) {
    return res.status(400).json({ message: "Invalid document or version id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
    status: { $ne: "deleted" },
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  const targetVersion = await DocumentVersion.findOne({
    _id: versionId,
    documentId: document._id,
    workspaceId: req.workspace._id,
  });

  if (!targetVersion || !targetVersion.s3Key) {
    return res.status(404).json({ message: "Target version not found" });
  }

  if (String(document.currentVersionId) === String(targetVersion._id)) {
    return res.status(400).json({ message: "This version is already the current version" });
  }

  const lastVersion = await DocumentVersion.findOne({
    documentId: document._id,
  }).sort({ versionNumber: -1 });

  const nextVersionNumber = (lastVersion?.versionNumber || document.versionCount || 0) + 1;
  const newKey = s3Key({
    workspaceId: req.workspace._id,
    documentId: document._id,
    versionNumber: nextVersionNumber,
    filename: document.name,
  });

  await copyObject({
    sourceKey: targetVersion.s3Key,
    targetKey: newKey,
  });

  const newVersion = await DocumentVersion.create({
    documentId: document._id,
    workspaceId: req.workspace._id,
    versionNumber: nextVersionNumber,
    s3Bucket,
    s3Key: newKey,
    s3ETag: targetVersion.s3ETag,
    sizeBytes: targetVersion.sizeBytes,
    mimeType: targetVersion.mimeType,
    uploadedBy: req.user._id,
    changeNote:
      req.body.changeNote?.trim() ||
      `Reverted to version ${targetVersion.versionNumber}`,
    processing: {
      extract: targetVersion.processing?.extract || "pending",
      embed: targetVersion.processing?.embed || "pending",
      classify: targetVersion.processing?.classify || "pending",
    },
  });

  document.currentVersionId = newVersion._id;
  document.versionCount = nextVersionNumber;
  document.sizeBytes = targetVersion.sizeBytes;
  document.mimeType = targetVersion.mimeType;
  document.updatedBy = req.user._id;
  await document.save();

  if (targetVersion.sizeBytes > 0) {
    await Workspace.updateOne(
      { _id: req.workspace._id },
      { $inc: { storageUsedBytes: targetVersion.sizeBytes } }
    );
  }

  enqueueProcessJob({
    workspace: req.workspace,
    document,
    version: newVersion,
  }).catch((err) => console.error("Failed to enqueue AI job on revert:", err.message));

  res.json({
    message: `Reverted to version ${targetVersion.versionNumber}`,
    document: serializeDocument(document),
    version: newVersion,
  });
});
