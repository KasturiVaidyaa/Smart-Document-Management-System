import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { Department } from "../models/Department.js";
import { Workspace } from "../models/Workspace.js";

/**
 * Categorize a document's mimeType or extension into a presentation-layer grouping.
 * Presentation and aggregation concern only — does not alter database fields.
 */
export function categorizeMimeType(mimeType = "", extension = "") {
  const mime = String(mimeType).toLowerCase();
  const ext = String(extension).toLowerCase().replace(".", "");

  if (mime.includes("pdf") || ext === "pdf") {
    return "PDF";
  }
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "tiff"].includes(ext)
  ) {
    return "Images";
  }
  if (
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessingml") ||
    ["doc", "docx", "odt", "rtf"].includes(ext)
  ) {
    return "Word/Docs";
  }
  if (
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("csv") ||
    ["xls", "xlsx", "csv", "ods"].includes(ext)
  ) {
    return "Spreadsheets";
  }
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    ["ppt", "pptx", "odp"].includes(ext)
  ) {
    return "Presentations";
  }
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    ["txt", "md", "markdown", "json", "html", "htm", "xml", "js", "ts", "py"].includes(ext)
  ) {
    return "Plain Text/Code";
  }
  return "Other";
}

/**
 * GET /api/workspaces/:workspaceId/storage
 *
 * Scoped strictly to req.workspace._id.
 * Authorized for: Workspace Owner OR members with "storage.view" permission.
 */
export const getWorkspaceStorage = TryCatch(async (req, res) => {
  const workspaceId = req.workspace._id;

  // Retrieve current quota and tracked usage from the workspace
  const quotaBytes = req.workspace.storageQuotaBytes || 0;
  const usedBytes = req.workspace.storageUsedBytes || 0;
  const percentage =
    quotaBytes > 0
      ? Math.min(100, Math.round((usedBytes / quotaBytes) * 10000) / 100)
      : 0;

  // Query documents belonging to current workspace that are not permanently deleted
  const [activeCount, trashCount, docs] = await Promise.all([
    Document.countDocuments({ workspaceId, status: "active" }),
    Document.countDocuments({ workspaceId, status: "trash" }),
    Document.find({
      workspaceId,
      status: { $in: ["active", "trash"] },
    }).select("sizeBytes mimeType extension departmentId status"),
  ]);

  const totalDocumentCount = activeCount + trashCount;

  // 1. Group by MIME / File Category
  const MIME_GROUPS = [
    "PDF",
    "Images",
    "Word/Docs",
    "Spreadsheets",
    "Presentations",
    "Plain Text/Code",
    "Other",
  ];

  const mimeBreakdownMap = {};
  for (const group of MIME_GROUPS) {
    mimeBreakdownMap[group] = { category: group, totalBytes: 0, count: 0 };
  }

  for (const doc of docs) {
    const group = categorizeMimeType(doc.mimeType, doc.extension);
    const size = doc.sizeBytes || 0;
    if (!mimeBreakdownMap[group]) {
      mimeBreakdownMap[group] = { category: group, totalBytes: 0, count: 0 };
    }
    mimeBreakdownMap[group].totalBytes += size;
    mimeBreakdownMap[group].count += 1;
  }

  const breakdownByMimeType = MIME_GROUPS.map((group) => {
    const item = mimeBreakdownMap[group];
    const itemPercentage =
      usedBytes > 0
        ? Math.round((item.totalBytes / usedBytes) * 10000) / 100
        : 0;
    return {
      ...item,
      percentage: itemPercentage,
    };
  });

  // 2. Group by Department (strictly within current workspace)
  const departments = await Department.find({ workspaceId }).select("_id name");
  const deptNameMap = new Map();
  for (const dept of departments) {
    deptNameMap.set(String(dept._id), dept.name);
  }

  const deptStorageMap = new Map();
  // Initialize unassigned
  deptStorageMap.set("unassigned", {
    departmentId: null,
    name: "Unassigned",
    totalBytes: 0,
    count: 0,
  });

  for (const dept of departments) {
    deptStorageMap.set(String(dept._id), {
      departmentId: dept._id,
      name: dept.name,
      totalBytes: 0,
      count: 0,
    });
  }

  for (const doc of docs) {
    const size = doc.sizeBytes || 0;
    const deptKey = doc.departmentId ? String(doc.departmentId) : "unassigned";
    if (!deptStorageMap.has(deptKey)) {
      deptStorageMap.set(deptKey, {
        departmentId: doc.departmentId,
        name: deptNameMap.get(deptKey) || "Unknown Department",
        totalBytes: 0,
        count: 0,
      });
    }
    const entry = deptStorageMap.get(deptKey);
    entry.totalBytes += size;
    entry.count += 1;
  }

  const breakdownByDepartment = Array.from(deptStorageMap.values());

  res.json({
    workspaceId: req.workspace._id,
    workspaceName: req.workspace.name,
    storage: {
      usedBytes,
      quotaBytes,
      availableBytes: Math.max(0, quotaBytes - usedBytes),
      percentage,
      isOverQuota: quotaBytes > 0 && usedBytes >= quotaBytes,
    },
    counts: {
      total: totalDocumentCount,
      active: activeCount,
      trash: trashCount,
    },
    breakdownByMimeType,
    breakdownByDepartment,
  });
});

/**
 * POST /api/workspaces/:workspaceId/storage/recalculate
 *
 * Reconciliation mechanism: recomputes usage from authoritative document version data
 * scoped strictly to req.workspace._id.
 *
 * Does NOT modify storageQuotaBytes.
 * Authorized for: Workspace Owner OR users with "roles.manage" permission.
 */
export const recalculateWorkspaceStorage = TryCatch(async (req, res) => {
  const workspaceId = req.workspace._id;

  // Authorization: Owner OR roles.manage
  const canManage =
    req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
  if (!canManage) {
    return res.status(403).json({ message: "Insufficient permissions to recalculate storage" });
  }

  const previousUsedBytes = req.workspace.storageUsedBytes || 0;

  // Reconcile from authoritative document versions belonging to active or trashed documents
  // in this workspace
  const activeOrTrashDocs = await Document.find({
    workspaceId,
    status: { $in: ["active", "trash"] },
  }).select("_id");

  const validDocIds = activeOrTrashDocs.map((d) => d._id);

  const versions = await DocumentVersion.find({
    workspaceId,
    documentId: { $in: validDocIds },
  }).select("sizeBytes");

  const currentUsedBytes = versions.reduce((sum, v) => sum + (v.sizeBytes || 0), 0);

  // Update storageUsedBytes only; storageQuotaBytes remains intact
  await Workspace.updateOne(
    { _id: workspaceId },
    { $set: { storageUsedBytes: currentUsedBytes } }
  );

  req.workspace.storageUsedBytes = currentUsedBytes;

  res.json({
    message: "Storage recalculated successfully",
    workspaceId,
    previousUsedBytes,
    currentUsedBytes,
    differenceBytes: currentUsedBytes - previousUsedBytes,
    recalculatedAt: new Date().toISOString(),
  });
});
