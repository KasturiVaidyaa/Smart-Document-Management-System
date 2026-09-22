import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { Workspace } from "../models/Workspace.js";
import { DEFAULT_CATEGORIES } from "../constants/permissions.js";

export const MAX_WORKSPACE_CATEGORIES = 30;

/**
 * Validates category name format.
 * Shared rule to guarantee single source of truth across all operations.
 */
export function validateCategoryName(name) {
  if (typeof name !== "string") {
    return { valid: false, message: "Category name must be a string" };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, message: "Category name must be at least 2 characters long" };
  }
  if (trimmed.length > 30) {
    return { valid: false, message: "Category name cannot exceed 30 characters" };
  }
  // Allow alphanumeric, spaces, hyphens, ampersands, slashes, and parentheses
  if (!/^[a-zA-Z0-9\s\-&/()]+$/.test(trimmed)) {
    return {
      valid: false,
      message: "Category name contains invalid characters. Use letters, numbers, spaces, and basic symbols (- & / ()).",
    };
  }
  return { valid: true, name: trimmed };
}

/**
 * Helper to ensure categories array is initialized in workspace settings.
 */
function getWorkspaceCategories(workspace) {
  const cats = workspace.settings?.categories;
  if (Array.isArray(cats) && cats.length > 0) {
    return [...cats];
  }
  return [...DEFAULT_CATEGORIES];
}

/**
 * GET /api/workspaces/:workspaceId/categories
 *
 * Scoped strictly to req.workspace._id.
 * Authorized for: All active workspace members.
 * Returns active category taxonomy and current document count for each category.
 */
export const listCategories = TryCatch(async (req, res) => {
  const workspaceId = req.workspace._id;
  const categories = getWorkspaceCategories(req.workspace);

  // Compute document count per category scoped strictly to current workspace and non-deleted documents
  const counts = await Document.aggregate([
    {
      $match: {
        workspaceId,
        status: { $in: ["active", "trash"] },
      },
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map();
  let unassignedCount = 0;

  for (const item of counts) {
    if (!item._id) {
      unassignedCount += item.count;
    } else {
      countMap.set(String(item._id).toLowerCase(), item.count);
    }
  }

  const resultCategories = categories.map((cat) => ({
    name: cat,
    documentCount: countMap.get(cat.toLowerCase()) || 0,
    isDefault: DEFAULT_CATEGORIES.some((d) => d.toLowerCase() === cat.toLowerCase()),
  }));

  res.json({
    workspaceId,
    categories: resultCategories,
    unassignedCount,
    defaultCategories: DEFAULT_CATEGORIES,
    maxCategories: MAX_WORKSPACE_CATEGORIES,
  });
});

/**
 * POST /api/workspaces/:workspaceId/categories
 *
 * Scoped strictly to req.workspace._id.
 * Authorized for: Workspace Owner OR members with "roles.manage" permission.
 */
export const createCategory = TryCatch(async (req, res) => {
  const canManage =
    req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
  if (!canManage) {
    return res.status(403).json({ message: "Insufficient permissions to manage categories" });
  }

  const { name } = req.body;
  const validation = validateCategoryName(name);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const categoryName = validation.name;
  const currentCategories = getWorkspaceCategories(req.workspace);

  if (currentCategories.length >= MAX_WORKSPACE_CATEGORIES) {
    return res.status(400).json({
      message: `Cannot exceed maximum limit of ${MAX_WORKSPACE_CATEGORIES} categories per workspace`,
    });
  }

  // Case-insensitive duplicate check
  const duplicate = currentCategories.some(
    (c) => c.toLowerCase() === categoryName.toLowerCase()
  );
  if (duplicate) {
    return res.status(400).json({
      message: `Category "${categoryName}" already exists in this workspace`,
    });
  }

  currentCategories.push(categoryName);

  if (!req.workspace.settings) {
    req.workspace.settings = {};
  }
  req.workspace.settings.categories = currentCategories;
  req.workspace.markModified("settings");
  await req.workspace.save();

  res.status(201).json({
    message: "Category created successfully",
    category: categoryName,
    categories: currentCategories,
  });
});

/**
 * PATCH /api/workspaces/:workspaceId/categories/:categoryName
 *
 * Rename category in taxonomy and synchronize references across documents
 * in the current workspace only.
 *
 * Authorized for: Workspace Owner OR members with "roles.manage" permission.
 */
export const updateCategory = TryCatch(async (req, res) => {
  const canManage =
    req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
  if (!canManage) {
    return res.status(403).json({ message: "Insufficient permissions to manage categories" });
  }

  const { categoryName } = req.params;
  const { newName } = req.body;

  if (!categoryName) {
    return res.status(400).json({ message: "Target category name is required" });
  }

  const validation = validateCategoryName(newName);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const updatedName = validation.name;
  const currentCategories = getWorkspaceCategories(req.workspace);

  // Locate the target category case-insensitively
  const existingIndex = currentCategories.findIndex(
    (c) => c.toLowerCase() === categoryName.toLowerCase()
  );

  if (existingIndex === -1) {
    return res.status(404).json({
      message: `Category "${categoryName}" not found in this workspace`,
    });
  }

  const originalExactName = currentCategories[existingIndex];

  // Prevent duplicate if changing to a different existing category
  const duplicate = currentCategories.some(
    (c, idx) =>
      idx !== existingIndex && c.toLowerCase() === updatedName.toLowerCase()
  );
  if (duplicate) {
    return res.status(400).json({
      message: `Category "${updatedName}" already exists in this workspace`,
    });
  }

  // Update in settings
  currentCategories[existingIndex] = updatedName;
  if (!req.workspace.settings) req.workspace.settings = {};
  req.workspace.settings.categories = currentCategories;
  req.workspace.markModified("settings");
  await req.workspace.save();

  // Synchronously update documents in the CURRENT workspace only (preserving cross-workspace isolation)
  // Matching Document.category with original exact or case-insensitive name
  const docUpdateResult = await Document.updateMany(
    {
      workspaceId: req.workspace._id,
      category: { $regex: new RegExp(`^${originalExactName}$`, "i") },
    },
    {
      $set: { category: updatedName },
    }
  );

  res.json({
    message: "Category renamed successfully",
    previousName: originalExactName,
    newName: updatedName,
    categories: currentCategories,
    affectedDocuments: docUpdateResult.modifiedCount || 0,
  });
});

/**
 * DELETE /api/workspaces/:workspaceId/categories/:categoryName
 *
 * Remove category from workspace taxonomy and safely clear document references
 * (setting category: null) strictly within the current workspace.
 *
 * Authorized for: Workspace Owner OR members with "roles.manage" permission.
 */
export const deleteCategory = TryCatch(async (req, res) => {
  const canManage =
    req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
  if (!canManage) {
    return res.status(403).json({ message: "Insufficient permissions to manage categories" });
  }

  const { categoryName } = req.params;
  if (!categoryName) {
    return res.status(400).json({ message: "Category name is required" });
  }

  const currentCategories = getWorkspaceCategories(req.workspace);

  const existingIndex = currentCategories.findIndex(
    (c) => c.toLowerCase() === categoryName.toLowerCase()
  );

  if (existingIndex === -1) {
    return res.status(404).json({
      message: `Category "${categoryName}" not found in this workspace`,
    });
  }

  // Taxonomy protection: Cannot delete the last remaining category
  if (currentCategories.length <= 1) {
    return res.status(400).json({
      message: "Cannot delete the last category. A workspace must retain at least one category.",
    });
  }

  const exactName = currentCategories[existingIndex];
  currentCategories.splice(existingIndex, 1);

  if (!req.workspace.settings) req.workspace.settings = {};
  req.workspace.settings.categories = currentCategories;
  req.workspace.markModified("settings");
  await req.workspace.save();

  // Safely clear category reference on documents in the current workspace (representation: null)
  const docUpdateResult = await Document.updateMany(
    {
      workspaceId: req.workspace._id,
      category: { $regex: new RegExp(`^${exactName}$`, "i") },
    },
    {
      $set: { category: null },
    }
  );

  res.json({
    message: "Category deleted successfully",
    deletedCategory: exactName,
    categories: currentCategories,
    affectedDocuments: docUpdateResult.modifiedCount || 0,
  });
});

/**
 * POST /api/workspaces/:workspaceId/categories/reset
 *
 * Deterministically resets workspace categories to DEFAULT_CATEGORIES.
 * Clears category references (category: null) on documents in this workspace
 * that were assigned to custom categories not present in the default set.
 *
 * Authorized for: Workspace Owner OR members with "roles.manage" permission.
 */
export const resetDefaultCategories = TryCatch(async (req, res) => {
  const canManage =
    req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
  if (!canManage) {
    return res.status(403).json({ message: "Insufficient permissions to manage categories" });
  }

  if (!req.workspace.settings) req.workspace.settings = {};
  req.workspace.settings.categories = [...DEFAULT_CATEGORIES];
  req.workspace.markModified("settings");
  await req.workspace.save();

  // Deterministically clear documents with non-default categories
  const defaultRegexPatterns = DEFAULT_CATEGORIES.map(
    (c) => new RegExp(`^${c}$`, "i")
  );

  const docUpdateResult = await Document.updateMany(
    {
      workspaceId: req.workspace._id,
      category: { $nin: [...DEFAULT_CATEGORIES, null] },
    },
    {
      $set: { category: null },
    }
  );

  res.json({
    message: "Categories reset to default taxonomy",
    categories: [...DEFAULT_CATEGORIES],
    affectedDocuments: docUpdateResult.modifiedCount || 0,
  });
});
