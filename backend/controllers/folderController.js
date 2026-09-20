import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Folder } from "../models/Folder.js";
import { Document } from "../models/Document.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createFolder = TryCatch(async (req, res) => {
  const { name, parentId } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Folder name is required" });
  }

  const trimmedName = name.trim();
  if (trimmedName.includes("/")) {
    return res.status(400).json({ message: "Folder name cannot contain '/'" });
  }

  let parent = null;
  let validParentId = null;

  if (parentId && parentId !== "root" && parentId !== "null") {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({ message: "Invalid parent folder id" });
    }
    parent = await Folder.findOne({
      _id: parentId,
      workspaceId: req.workspace._id,
    });
    if (!parent) {
      return res.status(404).json({ message: "Parent folder not found in this workspace" });
    }
    validParentId = parent._id;
  }

  const existing = await Folder.findOne({
    workspaceId: req.workspace._id,
    parentId: validParentId,
    name: new RegExp(`^${escapeRegex(trimmedName)}$`, "i"),
  });

  if (existing) {
    return res
      .status(400)
      .json({ message: "A folder with this name already exists in this location" });
  }

  const folderPath = parent ? `${parent.path}/${trimmedName}` : `/${trimmedName}`;

  const folder = await Folder.create({
    workspaceId: req.workspace._id,
    parentId: validParentId,
    name: trimmedName,
    path: folderPath,
    createdBy: req.user._id,
  });

  res.status(201).json({
    message: "Folder created",
    folder,
  });
});

export const listFolders = TryCatch(async (req, res) => {
  const { parentId } = req.query;
  const filter = { workspaceId: req.workspace._id };

  if (parentId !== undefined) {
    if (parentId === "root" || parentId === "null" || parentId === "") {
      filter.parentId = null;
    } else if (mongoose.Types.ObjectId.isValid(parentId)) {
      filter.parentId = parentId;
    }
  }

  const folders = await Folder.find(filter).sort({ name: 1 });
  res.json({ folders });
});

export const updateFolder = TryCatch(async (req, res) => {
  const { folderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    return res.status(400).json({ message: "Invalid folder id" });
  }

  const folder = await Folder.findOne({
    _id: folderId,
    workspaceId: req.workspace._id,
  });

  if (!folder) {
    return res.status(404).json({ message: "Folder not found in this workspace" });
  }

  const { name, parentId } = req.body;
  let newName = folder.name;

  if (name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Folder name cannot be empty" });
    }
    const trimmed = name.trim();
    if (trimmed.includes("/")) {
      return res.status(400).json({ message: "Folder name cannot contain '/'" });
    }
    newName = trimmed;
  }

  let newParentId = folder.parentId;
  let newParent = null;

  if (parentId !== undefined) {
    if (parentId === null || parentId === "root" || parentId === "" || parentId === "null") {
      newParentId = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ message: "Invalid target parent folder id" });
      }
      if (String(parentId) === String(folder._id)) {
        return res.status(400).json({ message: "Cannot move a folder into itself" });
      }

      newParent = await Folder.findOne({
        _id: parentId,
        workspaceId: req.workspace._id,
      });

      if (!newParent) {
        return res.status(404).json({ message: "Target parent folder not found" });
      }

      // Circular nesting check: target parent path cannot start with this folder's path
      if (
        newParent.path === folder.path ||
        newParent.path.startsWith(`${folder.path}/`)
      ) {
        return res.status(400).json({
          message: "Cannot move a folder into one of its subfolders (circular nesting)",
        });
      }

      newParentId = newParent._id;
    }
  } else if (folder.parentId) {
    newParent = await Folder.findById(folder.parentId);
  }

  // Check sibling duplicate name
  const duplicate = await Folder.findOne({
    _id: { $ne: folder._id },
    workspaceId: req.workspace._id,
    parentId: newParentId,
    name: new RegExp(`^${escapeRegex(newName)}$`, "i"),
  });

  if (duplicate) {
    return res.status(400).json({
      message: "A folder with this name already exists in target destination",
    });
  }

  const oldPath = folder.path;
  const newPath = newParent ? `${newParent.path}/${newName}` : `/${newName}`;

  folder.name = newName;
  folder.parentId = newParentId;
  folder.path = newPath;
  await folder.save();

  // Update path of all descendants if path changed
  if (oldPath !== newPath) {
    const descendants = await Folder.find({
      workspaceId: req.workspace._id,
      path: { $regex: `^${escapeRegex(oldPath)}/` },
    });

    for (const desc of descendants) {
      const suffix = desc.path.slice(oldPath.length);
      desc.path = `${newPath}${suffix}`;
      await desc.save();
    }
  }

  res.json({
    message: "Folder updated",
    folder,
  });
});

export const deleteFolder = TryCatch(async (req, res) => {
  const { folderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    return res.status(400).json({ message: "Invalid folder id" });
  }

  const folder = await Folder.findOne({
    _id: folderId,
    workspaceId: req.workspace._id,
  });

  if (!folder) {
    return res.status(404).json({ message: "Folder not found in this workspace" });
  }

  // Find all descendant folders
  const descendants = await Folder.find({
    workspaceId: req.workspace._id,
    path: { $regex: `^${escapeRegex(folder.path)}/` },
  });

  const allFolderIds = [folder._id, ...descendants.map((d) => d._id)];

  // Safely soft-delete active documents inside this folder hierarchy
  await Document.updateMany(
    {
      workspaceId: req.workspace._id,
      folderId: { $in: allFolderIds },
      status: "active",
    },
    {
      status: "trash",
      updatedBy: req.user._id,
    }
  );

  // Delete the folder and all descendant folders
  await Folder.deleteMany({ _id: { $in: allFolderIds } });

  res.json({
    message: "Folder and subfolders deleted safely",
    deletedFoldersCount: allFolderIds.length,
  });
});
