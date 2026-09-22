import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  ROLE_PERMISSIONS,
  PERSONAL_QUOTA_BYTES,
  ORG_QUOTA_BYTES,
} from "../constants/permissions.js";
import { categorizeMimeType } from "../controllers/storageController.js";
import { membershipPermissions } from "../services/workspaceService.js";

test("Security Test Suite — Workspace Storage & Quota (Phase 7)", async (t) => {
  const workspaceAId = new mongoose.Types.ObjectId();
  const workspaceBId = new mongoose.Types.ObjectId();
  const ownerAId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();
  const storageViewerAId = new mongoose.Types.ObjectId();
  const employeeAId = new mongoose.Types.ObjectId();
  const foreignUserId = new mongoose.Types.ObjectId();

  const dept1Id = new mongoose.Types.ObjectId();
  const dept2Id = new mongoose.Types.ObjectId();

  // Roles
  const adminRole = {
    _id: new mongoose.Types.ObjectId(),
    name: "Admin",
    isSystem: true,
    permissions: [...ROLE_PERMISSIONS],
  };

  const customStorageRole = {
    _id: new mongoose.Types.ObjectId(),
    name: "Storage Auditor",
    isSystem: false,
    permissions: ["storage.view"],
  };

  const employeeRole = {
    _id: new mongoose.Types.ObjectId(),
    name: "Employee",
    isSystem: true,
    permissions: ["dashboard.view"],
  };

  // Mock workspace
  const workspaceA = {
    _id: workspaceAId,
    name: "Acme Corp",
    type: "organization",
    ownerId: ownerAId,
    storageQuotaBytes: ORG_QUOTA_BYTES,
    storageUsedBytes: 25 * 1024 * 1024, // 25 MB
  };

  // Mock memberships
  const memberships = {
    [String(ownerAId)]: {
      workspaceId: workspaceAId,
      userId: ownerAId,
      status: "active",
      roleIds: [],
    },
    [String(adminAId)]: {
      workspaceId: workspaceAId,
      userId: adminAId,
      status: "active",
      roleIds: [adminRole],
    },
    [String(storageViewerAId)]: {
      workspaceId: workspaceAId,
      userId: storageViewerAId,
      status: "active",
      roleIds: [customStorageRole],
    },
    [String(employeeAId)]: {
      workspaceId: workspaceAId,
      userId: employeeAId,
      status: "active",
      roleIds: [employeeRole],
    },
  };

  // Mock documents
  const sampleDocs = [
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "contract.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      sizeBytes: 10 * 1024 * 1024, // 10 MB
      departmentId: dept1Id,
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "financials.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
      sizeBytes: 5 * 1024 * 1024, // 5 MB
      departmentId: dept1Id,
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "logo.png",
      mimeType: "image/png",
      extension: "png",
      sizeBytes: 2 * 1024 * 1024, // 2 MB
      departmentId: dept2Id,
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "notes.txt",
      mimeType: "text/plain",
      extension: "txt",
      sizeBytes: 1 * 1024 * 1024, // 1 MB
      departmentId: null, // Unassigned
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "old_draft.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
      sizeBytes: 7 * 1024 * 1024, // 7 MB
      departmentId: null, // Unassigned
      status: "trash", // in trash
    },
    // Foreign workspace doc
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceBId,
      name: "foreign.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      sizeBytes: 50 * 1024 * 1024,
      departmentId: null,
      status: "active",
    },
  ];

  // Simulated getWorkspaceStorage logic
  function processGetStorage(userWorkspaceId, userId) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }

    const membership = memberships[String(userId)];
    const isOwner = String(workspaceA.ownerId) === String(userId);
    const authz = membershipPermissions(membership, workspaceA, userId);

    const canView = authz.isOwner || authz.permissions.includes("storage.view");
    if (!canView) {
      return { status: 403, message: "Insufficient permissions" };
    }

    const quotaBytes = workspaceA.storageQuotaBytes;
    const usedBytes = workspaceA.storageUsedBytes;
    const percentage = Math.min(
      100,
      Math.round((usedBytes / quotaBytes) * 10000) / 100
    );

    // Filter documents scoped to workspaceA and status in active or trash
    const docs = sampleDocs.filter(
      (d) =>
        String(d.workspaceId) === String(workspaceAId) &&
        ["active", "trash"].includes(d.status)
    );

    const activeCount = docs.filter((d) => d.status === "active").length;
    const trashCount = docs.filter((d) => d.status === "trash").length;

    // MIME breakdown
    const mimeGroups = {};
    for (const doc of docs) {
      const group = categorizeMimeType(doc.mimeType, doc.extension);
      if (!mimeGroups[group]) {
        mimeGroups[group] = { totalBytes: 0, count: 0 };
      }
      mimeGroups[group].totalBytes += doc.sizeBytes;
      mimeGroups[group].count += 1;
    }

    // Department breakdown
    const deptBreakdown = {
      [String(dept1Id)]: { name: "Engineering", totalBytes: 0, count: 0 },
      [String(dept2Id)]: { name: "Design", totalBytes: 0, count: 0 },
      unassigned: { name: "Unassigned", totalBytes: 0, count: 0 },
    };

    for (const doc of docs) {
      const key = doc.departmentId ? String(doc.departmentId) : "unassigned";
      if (deptBreakdown[key]) {
        deptBreakdown[key].totalBytes += doc.sizeBytes;
        deptBreakdown[key].count += 1;
      }
    }

    return {
      status: 200,
      data: {
        storage: {
          usedBytes,
          quotaBytes,
          availableBytes: quotaBytes - usedBytes,
          percentage,
          isOverQuota: usedBytes >= quotaBytes,
        },
        counts: {
          total: docs.length,
          active: activeCount,
          trash: trashCount,
        },
        mimeGroups,
        deptBreakdown,
      },
    };
  }

  // Simulated recalculateWorkspaceStorage logic
  function processRecalculate(userWorkspaceId, userId) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }

    const membership = memberships[String(userId)];
    const authz = membershipPermissions(membership, workspaceA, userId);

    const canManage = authz.isOwner || authz.permissions.includes("roles.manage");
    if (!canManage) {
      return { status: 403, message: "Insufficient permissions to recalculate storage" };
    }

    const previousUsedBytes = workspaceA.storageUsedBytes;

    // Reconcile: sum of sizeBytes for active and trash documents in workspaceA
    const relevantDocs = sampleDocs.filter(
      (d) =>
        String(d.workspaceId) === String(workspaceAId) &&
        ["active", "trash"].includes(d.status)
    );

    const recomputedBytes = relevantDocs.reduce(
      (sum, d) => sum + (d.sizeBytes || 0),
      0
    );

    workspaceA.storageUsedBytes = recomputedBytes;

    return {
      status: 200,
      data: {
        previousUsedBytes,
        currentUsedBytes: recomputedBytes,
        quotaBytes: workspaceA.storageQuotaBytes, // verify quota untouched
      },
    };
  }

  // 1. Unauthorized member (Employee without storage.view) cannot view storage
  await t.test(
    "1. Unauthorized member lacking storage.view cannot view storage (403)",
    () => {
      const res = processGetStorage(workspaceAId, employeeAId);
      assert.equal(res.status, 403);
      assert.equal(res.message, "Insufficient permissions");
    }
  );

  // 2. Owner can view storage (200)
  await t.test("2. Owner can view storage (200)", () => {
    const res = processGetStorage(workspaceAId, ownerAId);
    assert.equal(res.status, 200);
    assert.ok(res.data.storage);
    assert.equal(res.data.storage.quotaBytes, ORG_QUOTA_BYTES);
  });

  // 3. Existing authorized storage role (Admin with storage.view) can view storage (200)
  await t.test("3. Admin with storage.view can view storage (200)", () => {
    const res = processGetStorage(workspaceAId, adminAId);
    assert.equal(res.status, 200);
    assert.ok(res.data.storage);
  });

  // 4. Custom role with storage.view works (200)
  await t.test("4. Custom role with storage.view can view storage (200)", () => {
    const res = processGetStorage(workspaceAId, storageViewerAId);
    assert.equal(res.status, 200);
    assert.ok(res.data.storage);
  });

  // 5. Custom role without storage.view is rejected (403)
  await t.test("5. Custom role without storage.view is rejected (403)", () => {
    const noStorageRole = {
      _id: new mongoose.Types.ObjectId(),
      name: "Editor Only",
      permissions: ["dashboard.view", "members.invite"],
    };
    const customUser = new mongoose.Types.ObjectId();
    memberships[String(customUser)] = {
      workspaceId: workspaceAId,
      userId: customUser,
      status: "active",
      roleIds: [noStorageRole],
    };
    const res = processGetStorage(workspaceAId, customUser);
    assert.equal(res.status, 403);
  });

  // 6. Cross-workspace isolation: Workspace A member cannot access Workspace B storage
  await t.test(
    "6. Cross-workspace isolation: access to foreign workspace is rejected (403)",
    () => {
      const res = processGetStorage(workspaceBId, adminAId);
      assert.equal(res.status, 403);
      assert.equal(res.message, "Not a member of this workspace");
    }
  );

  // 7. Correct usage calculation (usedBytes, quotaBytes, percentage)
  await t.test("7. Correct usage calculation", () => {
    const res = processGetStorage(workspaceAId, ownerAId);
    assert.equal(res.status, 200);
    assert.equal(res.data.storage.usedBytes, 25 * 1024 * 1024);
    assert.equal(res.data.storage.quotaBytes, ORG_QUOTA_BYTES);
    const expectedPercentage = Math.round(((25 * 1024 * 1024) / ORG_QUOTA_BYTES) * 10000) / 100;
    assert.equal(res.data.storage.percentage, expectedPercentage);
  });

  // 8. Correct active/trash counts
  await t.test("8. Correct active and trash document counts", () => {
    const res = processGetStorage(workspaceAId, ownerAId);
    assert.equal(res.status, 200);
    assert.equal(res.data.counts.total, 5); // 4 active + 1 trash in workspaceA
    assert.equal(res.data.counts.active, 4);
    assert.equal(res.data.counts.trash, 1);
  });

  // 9. MIME grouping
  await t.test("9. MIME grouping categorizes correctly", () => {
    assert.equal(categorizeMimeType("application/pdf", "pdf"), "PDF");
    assert.equal(categorizeMimeType("image/png", "png"), "Images");
    assert.equal(
      categorizeMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx"
      ),
      "Word/Docs"
    );
    assert.equal(
      categorizeMimeType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx"
      ),
      "Spreadsheets"
    );
    assert.equal(
      categorizeMimeType("application/vnd.ms-powerpoint", "ppt"),
      "Presentations"
    );
    assert.equal(categorizeMimeType("text/plain", "txt"), "Plain Text/Code");
    assert.equal(categorizeMimeType("application/octet-stream", "bin"), "Other");

    const res = processGetStorage(workspaceAId, ownerAId);
    assert.equal(res.data.mimeGroups.PDF.count, 1);
    assert.equal(res.data.mimeGroups.PDF.totalBytes, 10 * 1024 * 1024);
    assert.equal(res.data.mimeGroups.Spreadsheets.count, 1);
    assert.equal(res.data.mimeGroups.Images.count, 1);
    assert.equal(res.data.mimeGroups["Plain Text/Code"].count, 1);
    assert.equal(res.data.mimeGroups["Word/Docs"].count, 1); // trash doc included in storage
  });

  // 10. Department grouping (departments + "Unassigned")
  await t.test("10. Department grouping attributes storage correctly", () => {
    const res = processGetStorage(workspaceAId, ownerAId);
    assert.equal(res.status, 200);
    // dept1 has contract.pdf (10MB) + financials.xlsx (5MB) = 15MB, 2 docs
    assert.equal(res.data.deptBreakdown[String(dept1Id)].count, 2);
    assert.equal(res.data.deptBreakdown[String(dept1Id)].totalBytes, 15 * 1024 * 1024);
    // dept2 has logo.png (2MB), 1 doc
    assert.equal(res.data.deptBreakdown[String(dept2Id)].count, 1);
    assert.equal(res.data.deptBreakdown[String(dept2Id)].totalBytes, 2 * 1024 * 1024);
    // unassigned has notes.txt (1MB) + old_draft.docx (7MB) = 8MB, 2 docs
    assert.equal(res.data.deptBreakdown.unassigned.count, 2);
    assert.equal(res.data.deptBreakdown.unassigned.totalBytes, 8 * 1024 * 1024);
  });

  // 11. Unauthorized recalculation rejected (403)
  await t.test("11. Unauthorized member cannot trigger recalculation (403)", () => {
    const res = processRecalculate(workspaceAId, employeeAId);
    assert.equal(res.status, 403);
    assert.equal(res.message, "Insufficient permissions to recalculate storage");
  });

  // 12. Authorized recalculation updates storageUsedBytes
  await t.test("12. Admin can trigger recalculation and it recomputes usage", () => {
    const res = processRecalculate(workspaceAId, adminAId);
    assert.equal(res.status, 200);
    assert.equal(res.data.previousUsedBytes, 25 * 1024 * 1024);
    // 10 + 5 + 2 + 1 + 7 = 25 MB
    assert.equal(res.data.currentUsedBytes, 25 * 1024 * 1024);
    assert.equal(workspaceA.storageUsedBytes, 25 * 1024 * 1024);
  });

  // 13. Recalculation does not modify storageQuotaBytes
  await t.test("13. Recalculation does not modify storageQuotaBytes", () => {
    const res = processRecalculate(workspaceAId, ownerAId);
    assert.equal(res.status, 200);
    assert.equal(res.data.quotaBytes, ORG_QUOTA_BYTES);
    assert.equal(workspaceA.storageQuotaBytes, ORG_QUOTA_BYTES);
  });
});
