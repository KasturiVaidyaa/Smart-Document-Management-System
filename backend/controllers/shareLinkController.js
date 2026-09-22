import crypto from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { ShareLink } from "../models/ShareLink.js";
import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { getDownloadUrl } from "../services/s3.js";
import { resolveMimeType } from "./documentController.js";
import { LINK_ACTIONS } from "../constants/permissions.js";

/**
 * Generate a random share token and its SHA-256 hash.
 */
function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/**
 * POST /api/workspaces/:workspaceId/documents/:documentId/links
 *
 * Create a new share link for a document.
 * Requires workspace ownership or "sharing.manage" role permission.
 *
 * Body: { password?, expiresAt?, maxViews?, actions? }
 */
export const createShareLink = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  const { password, expiresAt, maxViews, actions } = req.body;

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

  // Validate actions if provided
  const linkActions = actions && Array.isArray(actions) && actions.length > 0
    ? actions.filter((a) => LINK_ACTIONS.includes(a))
    : ["view"];

  // Generate token
  const { token, tokenHash } = generateToken();

  // Hash password if provided
  let passwordHash = undefined;
  if (password && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  // Use workspace default expiry if not specified
  let expiry = null;
  if (expiresAt) {
    expiry = new Date(expiresAt);
  } else if (req.workspace.settings?.defaultLinkExpiryHours) {
    expiry = new Date(Date.now() + req.workspace.settings.defaultLinkExpiryHours * 60 * 60 * 1000);
  }

  const link = await ShareLink.create({
    workspaceId: req.workspace._id,
    documentId: document._id,
    tokenHash,
    passwordHash,
    actions: linkActions,
    expiresAt: expiry,
    maxViews: maxViews ? Number(maxViews) : undefined,
    createdBy: req.user._id,
  });

  // Return the raw token (only time it's ever exposed)
  const clientOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "http://localhost:5173";
  const shareUrl = `${clientOrigin}/share/${token}`;

  res.status(201).json({
    message: "Share link created",
    link: {
      _id: link._id,
      documentId: link.documentId,
      actions: link.actions,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews,
      viewCount: link.viewCount,
      hasPassword: !!link.passwordHash,
      createdAt: link.createdAt,
    },
    token,
    shareUrl,
  });
});

/**
 * GET /api/workspaces/:workspaceId/documents/:documentId/links
 *
 * List active share links for a document.
 */
export const listShareLinks = TryCatch(async (req, res) => {
  const { documentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const links = await ShareLink.find({
    workspaceId: req.workspace._id,
    documentId,
    revokedAt: { $eq: null },
  })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  const sanitized = links.map((l) => ({
    _id: l._id,
    documentId: l.documentId,
    actions: l.actions,
    expiresAt: l.expiresAt,
    maxViews: l.maxViews,
    viewCount: l.viewCount,
    hasPassword: !!l.passwordHash,
    createdBy: l.createdBy,
    createdAt: l.createdAt,
    isExpired: l.expiresAt && new Date(l.expiresAt) < new Date(),
    isMaxViewsReached: l.maxViews && l.viewCount >= l.maxViews,
  }));

  res.json({ links: sanitized });
});

/**
 * DELETE /api/workspaces/:workspaceId/links/:linkId
 *
 * Revoke a share link by setting revokedAt.
 */
export const revokeShareLink = TryCatch(async (req, res) => {
  const { linkId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(linkId)) {
    return res.status(400).json({ message: "Invalid link id" });
  }

  const link = await ShareLink.findOne({
    _id: linkId,
    workspaceId: req.workspace._id,
  });

  if (!link) {
    return res.status(404).json({ message: "Share link not found" });
  }

  link.revokedAt = new Date();
  await link.save();

  res.json({
    message: "Share link revoked",
    linkId: link._id,
  });
});

// ──────────────────────────────────────────────
// Public endpoints (no auth required)
// ──────────────────────────────────────────────

/**
 * GET /api/share/:token
 *
 * Public. Resolve a share token to document metadata.
 * Does NOT expose the file URL — requires POST to /api/share/:token/file.
 */
export const resolveShareLink = TryCatch(async (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 16) {
    return res.status(400).json({ message: "Invalid share token" });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const link = await ShareLink.findOne({ tokenHash });

  if (!link) {
    return res.status(404).json({ message: "Share link not found or invalid" });
  }

  // Check revoked
  if (link.revokedAt) {
    return res.status(410).json({ message: "This share link has been revoked" });
  }

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return res.status(410).json({ message: "This share link has expired" });
  }

  // Check max views
  if (link.maxViews && link.viewCount >= link.maxViews) {
    return res.status(410).json({ message: "This share link has reached its maximum view count" });
  }

  // Load document
  const document = await Document.findOne({
    _id: link.documentId,
    status: "active",
  });

  if (!document) {
    return res.status(404).json({ message: "Document no longer available" });
  }

  res.json({
    document: {
      _id: document._id,
      name: document.name,
      mimeType: document.mimeType,
      extension: document.extension,
      sizeBytes: document.sizeBytes,
    },
    requiresPassword: !!link.passwordHash,
    actions: link.actions,
    expiresAt: link.expiresAt,
    viewCount: link.viewCount,
    maxViews: link.maxViews,
  });
});

/**
 * POST /api/share/:token/file
 *
 * Public. Verify password (if required), increment view count,
 * and return the pre-signed S3 download URL.
 *
 * Body: { password? }
 */
export const accessShareLinkFile = TryCatch(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token || token.length < 16) {
    return res.status(400).json({ message: "Invalid share token" });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const link = await ShareLink.findOne({ tokenHash });

  if (!link) {
    return res.status(404).json({ message: "Share link not found or invalid" });
  }

  // Check revoked
  if (link.revokedAt) {
    return res.status(410).json({ message: "This share link has been revoked" });
  }

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return res.status(410).json({ message: "This share link has expired" });
  }

  // Check max views
  if (link.maxViews && link.viewCount >= link.maxViews) {
    return res.status(410).json({ message: "This share link has reached its maximum view count" });
  }

  // Verify password if protected
  if (link.passwordHash) {
    if (!password) {
      return res.status(401).json({ message: "Password is required for this link" });
    }
    const match = await bcrypt.compare(password, link.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password" });
    }
  }

  // Load document and current version
  const document = await Document.findOne({
    _id: link.documentId,
    status: "active",
  });

  if (!document || !document.currentVersionId) {
    return res.status(404).json({ message: "Document no longer available" });
  }

  const version = await DocumentVersion.findById(document.currentVersionId);
  if (!version?.s3Key) {
    return res.status(404).json({ message: "File not found" });
  }

  // Increment view count
  link.viewCount = (link.viewCount || 0) + 1;
  await link.save();

  // Generate pre-signed URL
  const filename = version.filename || document.name;
  const resolvedMime = resolveMimeType(filename, version.mimeType || document.mimeType);

  const canDownload = link.actions.includes("download");
  const disposition = canDownload ? "attachment" : "inline";

  const url = await getDownloadUrl(version.s3Key, {
    filename,
    contentType: resolvedMime,
    disposition,
  });

  res.json({
    url,
    name: filename,
    mimeType: resolvedMime,
    sizeBytes: version.sizeBytes || document.sizeBytes,
    disposition,
    viewCount: link.viewCount,
  });
});
