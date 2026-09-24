import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { DocumentChunk } from "../models/DocumentChunk.js";
import { Folder } from "../models/Folder.js";
import { Workspace } from "../models/Workspace.js";
import { Department } from "../models/Department.js";
import { PermissionGrant } from "../models/PermissionGrant.js";
import { DEFAULT_CATEGORIES } from "../constants/permissions.js";
import { AiJob } from "../models/AiJob.js";
import { hasDocumentPermission } from "../middlewares/checkPermission.js";
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
import { logAuditEvent } from "../services/auditService.js";
import { notifyUsers } from "../services/notificationService.js";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function resolveMimeType(filename = "", mimeType = "") {
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    txt: "text/plain",
    html: "text/html",
    json: "application/json",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] || mimeType || "application/octet-stream";
}

async function notifyNewVersion({ workspaceId, document, versionNumber, actor }) {
  try {
    const grants = await PermissionGrant.find({
      workspaceId,
      resourceType: "document",
      resourceId: document._id,
      principalType: "user",
    }).select("principalId");

    const userIds = grants
      .map((g) => g.principalId?.toString())
      .filter((id) => id && id !== actor._id?.toString());

    if (document.createdBy && document.createdBy.toString() !== actor._id?.toString()) {
      userIds.push(document.createdBy.toString());
    }

    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length > 0) {
      await notifyUsers({
        userIds: uniqueUserIds,
        workspaceId,
        type: "new_version",
        payload: {
          documentId: document._id,
          documentName: document.name,
          versionNumber,
          uploadedBy: actor.name || actor.email || "A collaborator",
        },
      });
    }
  } catch (err) {
    console.error("notifyNewVersion failed:", err.message);
  }
}

export const serializeDocument = (doc) => {
  const version =
    doc.currentVersionId && typeof doc.currentVersionId === "object"
      ? doc.currentVersionId
      : null;
  return {
    _id: doc._id,
    workspaceId: doc.workspaceId,
    folderId: doc.folderId || null,
    departmentId: doc.departmentId || null,
    name: doc.name,
    mimeType: doc.mimeType,
    extension: doc.extension,
    sizeBytes: doc.sizeBytes,
    versionCount: doc.versionCount,
    status: doc.status,
    category: doc.category || null,
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
  const { folderId, status, departmentId, category } = req.query;
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

  // Department filter: secondary filter within authorized workspace boundary
  if (departmentId !== undefined && departmentId !== "" && departmentId !== "all") {
    if (departmentId === "unassigned" || departmentId === "null") {
      filter.departmentId = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      const dept = await Department.findOne({
        _id: departmentId,
        workspaceId: req.workspace._id,
      });
      if (!dept) {
        return res.status(400).json({ message: "Department not found in this workspace" });
      }
      filter.departmentId = dept._id;
    }
  }

  // Category filter: secondary filter within authorized workspace boundary
  if (category !== undefined && category !== "" && category !== "all") {
    if (category === "unassigned" || category === "null" || category === "none") {
      filter.category = null;
    } else {
      const validCategories = req.workspace.settings?.categories || DEFAULT_CATEGORIES;
      const matched = validCategories.find(
        (c) => c.toLowerCase() === String(category).trim().toLowerCase()
      );
      if (!matched) {
        return res.status(400).json({ message: "Category not found in this workspace taxonomy" });
      }
      filter.category = matched;
    }
  }

  const documents = await Document.find(filter)
    .populate("currentVersionId", "processing")
    .sort({ updatedAt: -1 })
    .limit(200);

  // Enforce existing document authorization:
  // Workspace owners, users with "sharing.manage", and personal workspace owners bypass ACL.
  // For other users in organization workspaces, only return documents they are authorized to view.
  let authorizedDocs = documents;
  if (
    !req.authz?.isOwner &&
    !req.authz?.permissions?.includes("sharing.manage") &&
    req.workspace.type !== "personal"
  ) {
    const authChecks = await Promise.all(
      documents.map(async (doc) => {
        const canView = await hasDocumentPermission({
          userId: req.user._id,
          workspaceId: req.workspace._id,
          documentId: doc._id,
          action: "view",
          membership: req.membership,
          workspace: req.workspace,
        });
        return canView ? doc : null;
      })
    );
    authorizedDocs = authChecks.filter(Boolean);
  }

  res.json({ documents: authorizedDocs.map(serializeDocument) });
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

  let assignedDepartmentId = null;
  const rawDeptId = req.body.departmentId;
  if (
    rawDeptId &&
    rawDeptId !== "null" &&
    rawDeptId !== "none" &&
    rawDeptId !== "undefined" &&
    rawDeptId !== "unassigned" &&
    rawDeptId !== "all"
  ) {
    if (!mongoose.Types.ObjectId.isValid(rawDeptId)) {
      return res.status(400).json({ message: "Invalid department id" });
    }
    const dept = await Department.findOne({
      _id: rawDeptId,
      workspaceId: req.workspace._id,
    });
    if (!dept) {
      return res.status(400).json({ message: "Specified department not found in this workspace" });
    }
    assignedDepartmentId = dept._id;
  }

  let assignedCategory = null;
  const rawCategory = req.body.category;
  if (
    rawCategory !== undefined &&
    rawCategory !== null &&
    rawCategory !== "" &&
    rawCategory !== "null" &&
    rawCategory !== "none" &&
    rawCategory !== "unassigned"
  ) {
    if (typeof rawCategory !== "string") {
      return res.status(400).json({ message: "Category must be a string" });
    }
    const validCategories = req.workspace.settings?.categories || DEFAULT_CATEGORIES;
    const matchedCategory = validCategories.find(
      (c) => c.toLowerCase() === rawCategory.trim().toLowerCase()
    );
    if (!matchedCategory) {
      return res.status(400).json({ message: "Specified category not found in this workspace taxonomy" });
    }
    assignedCategory = matchedCategory;
  }

  const originalName = file.originalname || "untitled";
  const extension = originalName.includes(".")
    ? originalName.split(".").pop().toLowerCase()
    : "";
  const resolvedMime = resolveMimeType(originalName, file.mimetype);

  // Check if a document with the same filename already exists in the same folder and workspace
  const existingDoc = await Document.findOne({
    workspaceId: req.workspace._id,
    folderId: assignedFolderId,
    name: originalName,
    status: "active",
  });

  if (existingDoc) {
    // AUTOMATIC VERSIONING: Document with same filename exists in same folder -> create next version
    const lastVersion = await DocumentVersion.findOne({
      documentId: existingDoc._id,
    }).sort({ versionNumber: -1 });

    const nextVersionNumber = (lastVersion?.versionNumber || existingDoc.versionCount || 0) + 1;
    const key = s3Key({
      workspaceId: req.workspace._id,
      documentId: existingDoc._id,
      versionNumber: nextVersionNumber,
      filename: originalName,
    });

    try {
      await putObject({
        key,
        body: file.buffer,
        contentType: resolvedMime,
      });

      let etag;
      try {
        const head = await headObject(key);
        etag = head.ETag;
      } catch {
        etag = undefined;
      }

      const version = await DocumentVersion.create({
        documentId: existingDoc._id,
        workspaceId: req.workspace._id,
        versionNumber: nextVersionNumber,
        filename: originalName,
        s3Bucket,
        s3Key: key,
        s3ETag: etag,
        sizeBytes: file.size,
        mimeType: resolvedMime,
        uploadedBy: req.user._id,
        changeNote: `Uploaded version ${nextVersionNumber}`,
        processing: {
          extract: "pending",
          embed: "pending",
          classify: "pending",
        },
      });

      existingDoc.currentVersionId = version._id;
      existingDoc.versionCount = nextVersionNumber;
      existingDoc.sizeBytes = file.size;
      existingDoc.mimeType = resolvedMime;
      existingDoc.extension = extension;
      existingDoc.status = "active";
      if (assignedDepartmentId) {
        existingDoc.departmentId = assignedDepartmentId;
      }
      if (assignedCategory) {
        existingDoc.category = assignedCategory;
      }
      existingDoc.updatedBy = req.user._id;
      await existingDoc.save();

      await Workspace.updateOne(
        { _id: req.workspace._id },
        { $inc: { storageUsedBytes: file.size } }
      );

      enqueueProcessJob({
        workspace: req.workspace,
        document: existingDoc,
        version,
      }).catch((err) => console.error("Failed to enqueue AI job:", err.message));

      logAuditEvent({
        workspaceId: req.workspace._id,
        actor: req.user,
        action: "document.version_create",
        resourceType: "document",
        resourceId: existingDoc._id,
        metadata: {
          name: existingDoc.name,
          versionNumber: nextVersionNumber,
          sizeBytes: file.size,
          changeNote: `Uploaded version ${nextVersionNumber}`,
        },
      });

      notifyNewVersion({
        workspaceId: req.workspace._id,
        document: existingDoc,
        versionNumber: nextVersionNumber,
        actor: req.user,
      });

      return res.status(200).json({
        message: `Version ${nextVersionNumber} uploaded for ${originalName}`,
        document: serializeDocument(existingDoc),
        version,
        isNewVersion: true,
      });
    } catch (error) {
      const message =
        error.name === "AccessDenied" || error.Code === "AccessDenied"
          ? "S3 access denied. Check IAM permissions on this bucket."
          : error.message;
      return res.status(error.statusCode || 500).json({ message });
    }
  }

  // New document creation
  const document = await Document.create({
    workspaceId: req.workspace._id,
    folderId: assignedFolderId,
    departmentId: assignedDepartmentId,
    category: assignedCategory,
    name: originalName,
    mimeType: resolvedMime,
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
      contentType: resolvedMime,
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
      filename: originalName,
      s3Bucket,
      s3Key: key,
      s3ETag: etag,
      sizeBytes: file.size,
      mimeType: resolvedMime,
      uploadedBy: req.user._id,
      changeNote: "Initial upload",
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

    logAuditEvent({
      workspaceId: req.workspace._id,
      actor: req.user,
      action: "document.upload",
      resourceType: "document",
      resourceId: document._id,
      metadata: {
        name: document.name,
        sizeBytes: document.sizeBytes,
        mimeType: document.mimeType,
        extension: document.extension,
        folderId: document.folderId,
      },
    });
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

  const disposition = req.query.disposition === "attachment" ? "attachment" : "inline";
  const filename = version.filename || document.name;
  const resolvedMime = resolveMimeType(
    filename,
    version.mimeType || document.mimeType
  );

  const url = await getDownloadUrl(version.s3Key, {
    filename,
    contentType: resolvedMime,
    disposition,
  });

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.view",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: filename,
      disposition,
      sizeBytes: version.sizeBytes || document.sizeBytes,
    },
  });

  res.json({
    url,
    name: filename,
    mimeType: resolvedMime,
    sizeBytes: version.sizeBytes || document.sizeBytes,
    disposition,
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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.move",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: document.name,
      targetFolderId,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.trash",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: document.name,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.restore",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: document.name,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.delete",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: document.name,
      freedBytes: totalBytes,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.trash",
    resourceType: "document",
    metadata: {
      count: result.modifiedCount,
      documentIds: validIds,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.restore",
    resourceType: "document",
    metadata: {
      count: restoredCount,
      documentIds: validIds,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.delete",
    resourceType: "document",
    metadata: {
      count: result.deletedCount,
      documentIds: validIds,
      freedBytes: totalBytes,
    },
  });

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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.move",
    resourceType: "document",
    metadata: {
      count: result.modifiedCount,
      documentIds: validIds,
      targetFolderId,
    },
  });

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
  const resolvedMime = resolveMimeType(originalName, file.mimetype);
  const key = s3Key({
    workspaceId: req.workspace._id,
    documentId: document._id,
    versionNumber: nextVersionNumber,
    filename: originalName,
  });

  await putObject({
    key,
    body: file.buffer,
    contentType: resolvedMime,
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
    filename: originalName,
    s3Bucket,
    s3Key: key,
    s3ETag: etag,
    sizeBytes: file.size,
    mimeType: resolvedMime,
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
  document.mimeType = resolvedMime;
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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.version_create",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: document.name,
      versionNumber: nextVersionNumber,
      sizeBytes: file.size,
      changeNote: req.body.changeNote?.trim() || "",
    },
  });

  notifyNewVersion({
    workspaceId: req.workspace._id,
    document,
    versionNumber: nextVersionNumber,
    actor: req.user,
  });

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

  const disposition = req.query.disposition === "attachment" ? "attachment" : "inline";
  const versionName = version.filename || document.name;
  const resolvedMime = resolveMimeType(versionName, version.mimeType || document.mimeType);

  const url = await getDownloadUrl(version.s3Key, {
    filename: versionName,
    contentType: resolvedMime,
    disposition,
  });

  res.json({
    url,
    name: versionName,
    mimeType: resolvedMime,
    sizeBytes: version.sizeBytes,
    versionNumber: version.versionNumber,
    disposition,
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
  const targetFilename = targetVersion.filename || document.name;
  const newKey = s3Key({
    workspaceId: req.workspace._id,
    documentId: document._id,
    versionNumber: nextVersionNumber,
    filename: targetFilename,
  });

  await copyObject({
    sourceKey: targetVersion.s3Key,
    targetKey: newKey,
  });

  const newVersion = await DocumentVersion.create({
    documentId: document._id,
    workspaceId: req.workspace._id,
    versionNumber: nextVersionNumber,
    filename: targetFilename,
    s3Bucket,
    s3Key: newKey,
    s3ETag: targetVersion.s3ETag,
    sizeBytes: targetVersion.sizeBytes,
    mimeType: targetVersion.mimeType,
    uploadedBy: req.user._id,
    changeNote:
      req.body.changeNote?.trim() ||
      `Reverted to version ${targetVersion.versionNumber} (${targetFilename})`,
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

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.version_revert",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      name: document.name,
      revertedToVersion: targetVersion.versionNumber,
      newVersionNumber: nextVersionNumber,
    },
  });

  notifyNewVersion({
    workspaceId: req.workspace._id,
    document,
    versionNumber: nextVersionNumber,
    actor: req.user,
  });

  res.json({
    message: `Reverted to version ${targetVersion.versionNumber}`,
    document: serializeDocument(document),
    version: newVersion,
  });
});

/**
 * PATCH /api/workspaces/:workspaceId/documents/:documentId/department
 *
 * Update or clear a document's department assignment.
 * Protected by checkDocumentPermission("edit") middleware (or workspace ownership).
 *
 * Body: { departmentId: "<id>" | null }
 */
export const updateDocumentDepartment = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  const { departmentId } = req.body;

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

  let validatedDeptId = null;
  if (
    departmentId !== undefined &&
    departmentId !== null &&
    departmentId !== "" &&
    departmentId !== "null" &&
    departmentId !== "none" &&
    departmentId !== "unassigned"
  ) {
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ message: "Invalid department id" });
    }
    const dept = await Department.findOne({
      _id: departmentId,
      workspaceId: req.workspace._id,
    });
    if (!dept) {
      return res.status(400).json({ message: "Department not found in this workspace" });
    }
    validatedDeptId = dept._id;
  }

  document.departmentId = validatedDeptId;
  document.updatedBy = req.user._id;
  await document.save();

  res.json({
    message: "Document department updated successfully",
    document: serializeDocument(document),
  });
});

/**
 * PATCH /api/workspaces/:workspaceId/documents/:documentId/category
 *
 * Assign, update, or clear a document's classification category.
 * Protected by checkDocumentPermission("edit") middleware (or workspace ownership).
 *
 * Body: { category: "<name>" | null }
 */
export const updateDocumentCategory = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  const { category } = req.body;

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

  let validatedCategory = null;
  if (
    category !== undefined &&
    category !== null &&
    category !== "" &&
    category !== "null" &&
    category !== "none" &&
    category !== "unassigned"
  ) {
    if (typeof category !== "string") {
      return res.status(400).json({ message: "Category must be a string" });
    }
    const validCategories =
      req.workspace.settings?.categories || DEFAULT_CATEGORIES;
    const matched = validCategories.find(
      (c) => c.toLowerCase() === category.trim().toLowerCase()
    );
    if (!matched) {
      return res.status(400).json({
        message: "Specified category not found in this workspace taxonomy",
      });
    }
    validatedCategory = matched;
  }

  document.category = validatedCategory;
  document.updatedBy = req.user._id;
  await document.save();

  res.json({
    message: "Document category updated successfully",
    document: serializeDocument(document),
  });
});

/**
 * POST /api/workspaces/:workspaceId/documents/:documentId/reprocess
 *
 * Re-triggers AI processing for the current version of a document.
 * Resets processing state on the DocumentVersion and re-enqueues the AI job.
 * Clears stale aiCategory, aiKeywords, summary so fresh results will populate.
 */
export const reprocessDocument = TryCatch(async (req, res) => {
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
    return res.status(404).json({ message: "Document not found" });
  }

  if (!document.currentVersionId) {
    return res.status(400).json({ message: "Document has no current version to reprocess" });
  }

  const version = await DocumentVersion.findById(document.currentVersionId);
  if (!version?.s3Key) {
    return res.status(400).json({ message: "No processable file found for this document" });
  }

  // Reset processing state on the version
  version.processing = { extract: "pending", embed: "pending", classify: "pending" };
  await version.save();

  // Clear stale AI fields from document so UI shows pending state
  document.aiCategory = undefined;
  document.aiKeywords = [];
  document.summary = undefined;
  document.updatedBy = req.user._id;
  await document.save();

  // Re-enqueue the AI job using the existing pipeline
  const { enqueueProcessJob } = await import("../services/aiJobs.js");
  enqueueProcessJob({
    workspace: req.workspace,
    document,
    version,
  }).catch((err) => console.error("Failed to enqueue reprocess AI job:", err.message));

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "document.reprocess",
    resourceType: "document",
    resourceId: document._id,
    metadata: { name: document.name },
  });

  // Reload to get fresh populated processing state
  const refreshed = await Document.findById(document._id).populate("currentVersionId", "processing");
  res.json({
    message: "Reprocessing started",
    document: serializeDocument(refreshed),
  });
});

/**
 * GET /api/workspaces/:workspaceId/documents/:documentId/ai-status
 *
 * Returns the latest AiJob record for a document so the frontend
 * can poll for real-time processing status (queued | running | ready | failed).
 */
export const getDocumentAiStatus = TryCatch(async (req, res) => {
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

  const latestJob = await AiJob.findOne({ documentId: document._id })
    .sort({ createdAt: -1 })
    .lean();

  // Also fetch current version processing sub-state
  let versionProcessing = null;
  if (document.currentVersionId) {
    const version = await DocumentVersion.findById(document.currentVersionId)
      .select("processing")
      .lean();
    versionProcessing = version?.processing || null;
  }

  res.json({
    jobStatus: latestJob?.status || null,
    jobError: latestJob?.error || null,
    jobUpdatedAt: latestJob?.updatedAt || null,
    versionProcessing,
    aiCategory: document.aiCategory || null,
    aiKeywords: document.aiKeywords || [],
    summary: document.summary || null,
  });
});
