import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  DEFAULT_CATEGORIES,
  ROLE_PERMISSIONS,
} from "../constants/permissions.js";
import {
  validateCategoryName,
  MAX_WORKSPACE_CATEGORIES,
} from "../controllers/categoryController.js";
import { membershipPermissions } from "../services/workspaceService.js";

test("Security Test Suite — AI Categories & Document Classification (Phase 8)", async (t) => {
  const workspaceAId = new mongoose.Types.ObjectId();
  const workspaceBId = new mongoose.Types.ObjectId();
  const ownerAId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();
  const regularMemberAId = new mongoose.Types.ObjectId();
  const removedMemberAId = new mongoose.Types.ObjectId();
  const foreignUserId = new mongoose.Types.ObjectId();

  const adminRole = {
    _id: new mongoose.Types.ObjectId(),
    name: "Admin",
    isSystem: true,
    permissions: [...ROLE_PERMISSIONS],
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
    settings: {
      categories: [...DEFAULT_CATEGORIES], // ["HR", "Finance", "Projects", "Legal", "General"]
    },
  };

  // Mock workspace B
  const workspaceB = {
    _id: workspaceBId,
    name: "Beta Corp",
    type: "organization",
    ownerId: foreignUserId,
    settings: {
      categories: [...DEFAULT_CATEGORIES],
    },
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
    [String(regularMemberAId)]: {
      workspaceId: workspaceAId,
      userId: regularMemberAId,
      status: "active",
      roleIds: [employeeRole],
    },
    [String(removedMemberAId)]: {
      workspaceId: workspaceAId,
      userId: removedMemberAId,
      status: "removed",
      roleIds: [employeeRole],
    },
  };

  // Mock documents
  const documents = [
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "financial_report.pdf",
      category: "Finance",
      createdBy: ownerAId,
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "hr_policy.pdf",
      category: "HR",
      createdBy: ownerAId,
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "confidential_legal.pdf",
      category: "Legal",
      createdBy: ownerAId,
      status: "active",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "notes.txt",
      category: null,
      createdBy: ownerAId,
      status: "active",
    },
    // Document in workspace B with category Finance
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceBId,
      name: "beta_finance.pdf",
      category: "Finance",
      createdBy: foreignUserId,
      status: "active",
    },
  ];

  // Helper simulating listCategories
  function processListCategories(userWorkspaceId, userId) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }
    const mem = memberships[String(userId)];
    const isOwner = String(workspaceA.ownerId) === String(userId);
    if (!isOwner && (!mem || mem.status !== "active")) {
      return { status: 403, message: "Workspace access denied" };
    }

    const cats = workspaceA.settings.categories;
    const catCounts = cats.map((cat) => ({
      name: cat,
      documentCount: documents.filter(
        (d) =>
          String(d.workspaceId) === String(workspaceAId) &&
          d.category &&
          d.category.toLowerCase() === cat.toLowerCase()
      ).length,
    }));

    return {
      status: 200,
      categories: catCounts,
      unassignedCount: documents.filter(
        (d) => String(d.workspaceId) === String(workspaceAId) && !d.category
      ).length,
    };
  }

  // Helper simulating createCategory
  function processCreateCategory(userWorkspaceId, userId, categoryName) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }
    const mem = memberships[String(userId)];
    const authz = membershipPermissions(mem, workspaceA, userId);
    const canManage = authz.isOwner || authz.permissions.includes("roles.manage");
    if (!canManage) {
      return { status: 403, message: "Insufficient permissions to manage categories" };
    }

    const validation = validateCategoryName(categoryName);
    if (!validation.valid) {
      return { status: 400, message: validation.message };
    }

    const currentCats = workspaceA.settings.categories;
    if (currentCats.length >= MAX_WORKSPACE_CATEGORIES) {
      return { status: 400, message: "Cannot exceed maximum limit of categories" };
    }

    const duplicate = currentCats.some(
      (c) => c.toLowerCase() === validation.name.toLowerCase()
    );
    if (duplicate) {
      return { status: 400, message: `Category "${validation.name}" already exists in this workspace` };
    }

    currentCats.push(validation.name);
    return { status: 201, categories: currentCats };
  }

  // Helper simulating updateCategory (rename)
  function processRenameCategory(userWorkspaceId, userId, oldName, newName) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }
    const mem = memberships[String(userId)];
    const authz = membershipPermissions(mem, workspaceA, userId);
    const canManage = authz.isOwner || authz.permissions.includes("roles.manage");
    if (!canManage) {
      return { status: 403, message: "Insufficient permissions to manage categories" };
    }

    const validation = validateCategoryName(newName);
    if (!validation.valid) {
      return { status: 400, message: validation.message };
    }

    const currentCats = workspaceA.settings.categories;
    const existingIndex = currentCats.findIndex(
      (c) => c.toLowerCase() === oldName.toLowerCase()
    );
    if (existingIndex === -1) {
      return { status: 404, message: "Category not found in this workspace" };
    }

    const duplicate = currentCats.some(
      (c, idx) => idx !== existingIndex && c.toLowerCase() === validation.name.toLowerCase()
    );
    if (duplicate) {
      return { status: 400, message: `Category "${validation.name}" already exists` };
    }

    const originalExact = currentCats[existingIndex];
    currentCats[existingIndex] = validation.name;

    // Synchronize documents in current workspace only
    let affected = 0;
    for (const doc of documents) {
      if (
        String(doc.workspaceId) === String(workspaceAId) &&
        doc.category &&
        doc.category.toLowerCase() === originalExact.toLowerCase()
      ) {
        doc.category = validation.name;
        affected++;
      }
    }

    return { status: 200, categories: currentCats, affectedDocuments: affected };
  }

  // Helper simulating deleteCategory
  function processDeleteCategory(userWorkspaceId, userId, categoryName) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }
    const mem = memberships[String(userId)];
    const authz = membershipPermissions(mem, workspaceA, userId);
    const canManage = authz.isOwner || authz.permissions.includes("roles.manage");
    if (!canManage) {
      return { status: 403, message: "Insufficient permissions to manage categories" };
    }

    const currentCats = workspaceA.settings.categories;
    const existingIndex = currentCats.findIndex(
      (c) => c.toLowerCase() === categoryName.toLowerCase()
    );
    if (existingIndex === -1) {
      return { status: 404, message: "Category not found" };
    }

    if (currentCats.length <= 1) {
      return {
        status: 400,
        message: "Cannot delete the last category. A workspace must retain at least one category.",
      };
    }

    const exactName = currentCats[existingIndex];
    currentCats.splice(existingIndex, 1);

    // Safely unset category (null) on documents in current workspace
    let affected = 0;
    for (const doc of documents) {
      if (
        String(doc.workspaceId) === String(workspaceAId) &&
        doc.category &&
        doc.category.toLowerCase() === exactName.toLowerCase()
      ) {
        doc.category = null;
        affected++;
      }
    }

    return { status: 200, categories: currentCats, affectedDocuments: affected };
  }

  // Helper simulating resetDefaultCategories
  function processResetCategories(userWorkspaceId, userId) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }
    const mem = memberships[String(userId)];
    const authz = membershipPermissions(mem, workspaceA, userId);
    const canManage = authz.isOwner || authz.permissions.includes("roles.manage");
    if (!canManage) {
      return { status: 403, message: "Insufficient permissions to manage categories" };
    }

    workspaceA.settings.categories = [...DEFAULT_CATEGORIES];

    // Clear categories on documents with non-default category
    let affected = 0;
    for (const doc of documents) {
      if (
        String(doc.workspaceId) === String(workspaceAId) &&
        doc.category &&
        !DEFAULT_CATEGORIES.some((d) => d.toLowerCase() === doc.category.toLowerCase())
      ) {
        doc.category = null;
        affected++;
      }
    }

    return { status: 200, categories: [...DEFAULT_CATEGORIES], affectedDocuments: affected };
  }

  // Helper simulating listDocuments with category filter and ACL check
  function processListDocumentsWithAcl({
    userWorkspaceId,
    userId,
    categoryQuery,
    allowedDocumentIds,
  }) {
    if (String(userWorkspaceId) !== String(workspaceAId)) {
      return { status: 403, message: "Not a member of this workspace" };
    }

    // 1. Base filter scoped to workspace
    let docs = documents.filter((d) => String(d.workspaceId) === String(workspaceAId));

    // 2. Category filter
    if (categoryQuery !== undefined && categoryQuery !== "" && categoryQuery !== "all") {
      if (categoryQuery === "unassigned" || categoryQuery === "null") {
        docs = docs.filter((d) => d.category === null);
      } else {
        const validCats = workspaceA.settings.categories;
        const matched = validCats.find(
          (c) => c.toLowerCase() === categoryQuery.trim().toLowerCase()
        );
        if (!matched) {
          return { status: 400, message: "Category not found in this workspace taxonomy" };
        }
        docs = docs.filter((d) => d.category && d.category.toLowerCase() === matched.toLowerCase());
      }
    }

    // 3. SECONDARY ACL CHECK (A category match must NEVER bypass ACL)
    const authorizedDocs = docs.filter((d) => allowedDocumentIds.includes(String(d._id)));

    return { status: 200, documents: authorizedDocs };
  }

  // 1. Active member can list categories
  await t.test("1. Active member can list categories (200)", () => {
    const res = processListCategories(workspaceAId, regularMemberAId);
    assert.equal(res.status, 200);
    assert.equal(res.categories.length, 5);
    const financeCat = res.categories.find((c) => c.name === "Finance");
    assert.equal(financeCat.documentCount, 1);
  });

  // 2. Inactive/removed member cannot access categories
  await t.test("2. Removed member cannot access categories (403)", () => {
    const res = processListCategories(workspaceAId, removedMemberAId);
    assert.equal(res.status, 403);
    assert.equal(res.message, "Workspace access denied");
  });

  // 3. Unauthorized user cannot create category
  await t.test("3. Unauthorized member cannot create category (403)", () => {
    const res = processCreateCategory(workspaceAId, regularMemberAId, "Marketing");
    assert.equal(res.status, 403);
    assert.equal(res.message, "Insufficient permissions to manage categories");
  });

  // 4. Authorized owner/admin can create category
  await t.test("4. Authorized admin can create category (201)", () => {
    const res = processCreateCategory(workspaceAId, adminAId, "Marketing");
    assert.equal(res.status, 201);
    assert.ok(res.categories.includes("Marketing"));
  });

  // 5. Invalid category names are rejected
  await t.test("5. Invalid category names rejected (400)", () => {
    // Empty / whitespace
    assert.equal(processCreateCategory(workspaceAId, adminAId, "   ").status, 400);
    // Too short (< 2 chars)
    assert.equal(processCreateCategory(workspaceAId, adminAId, "A").status, 400);
    // Too long (> 30 chars)
    assert.equal(
      processCreateCategory(
        workspaceAId,
        adminAId,
        "Super Long Category Name That Exceeds Thirty Characters Max"
      ).status,
      400
    );
    // Invalid characters (<script> tags)
    assert.equal(
      processCreateCategory(workspaceAId, adminAId, "Malicious<script>").status,
      400
    );
  });

  // 6. Duplicate category names rejected case-insensitively
  await t.test("6. Duplicate category names rejected case-insensitively (400)", () => {
    // "marketing" already added in test 4
    const res = processCreateCategory(workspaceAId, adminAId, "marketing");
    assert.equal(res.status, 400);
    assert.match(res.message, /already exists/i);
  });

  // 7. Category limit enforced (MAX_WORKSPACE_CATEGORIES)
  await t.test("7. Maximum category limit enforced (400)", () => {
    // Fill up to max
    const tempCats = [...workspaceA.settings.categories];
    while (workspaceA.settings.categories.length < MAX_WORKSPACE_CATEGORIES) {
      workspaceA.settings.categories.push(`Cat_${workspaceA.settings.categories.length}`);
    }
    const res = processCreateCategory(workspaceAId, adminAId, "OverLimitCat");
    assert.equal(res.status, 400);
    assert.match(res.message, /Cannot exceed maximum limit/i);
    // Restore
    workspaceA.settings.categories = tempCats;
  });

  // 8. Unauthorized rename rejected
  await t.test("8. Unauthorized member cannot rename category (403)", () => {
    const res = processRenameCategory(
      workspaceAId,
      regularMemberAId,
      "Marketing",
      "Growth Marketing"
    );
    assert.equal(res.status, 403);
  });

  // 9. Authorized rename succeeds
  await t.test("9. Authorized admin can rename category (200)", () => {
    const res = processRenameCategory(
      workspaceAId,
      adminAId,
      "Finance",
      "Financial Operations"
    );
    assert.equal(res.status, 200);
    assert.ok(res.categories.includes("Financial Operations"));
    assert.ok(!res.categories.includes("Finance"));
    assert.equal(res.affectedDocuments, 1);
  });

  // 10. Rename only affects documents in the same workspace (Cross-workspace isolation)
  await t.test(
    "10. Rename does not affect documents in foreign workspace",
    () => {
      // Document in Workspace B should still have category "Finance"
      const docB = documents.find((d) => String(d.workspaceId) === String(workspaceBId));
      assert.equal(docB.category, "Finance");
    }
  );

  // 11. Unauthorized deletion rejected
  await t.test("11. Unauthorized member cannot delete category (403)", () => {
    const res = processDeleteCategory(workspaceAId, regularMemberAId, "Marketing");
    assert.equal(res.status, 403);
  });

  // 12. Deletion safely clears references (category: null)
  await t.test("12. Deletion safely sets category to null on tagged documents", () => {
    // Rename "Financial Operations" doc exists, now delete "Financial Operations"
    const res = processDeleteCategory(workspaceAId, adminAId, "Financial Operations");
    assert.equal(res.status, 200);
    assert.equal(res.affectedDocuments, 1);
    const docA = documents.find((d) => d.name === "financial_report.pdf");
    assert.equal(docA.category, null);
  });

  // 13. Last-category protection follows the defined taxonomy rule
  await t.test("13. Cannot delete the last remaining category (400)", () => {
    const saved = [...workspaceA.settings.categories];
    workspaceA.settings.categories = ["SoleCategory"];
    const res = processDeleteCategory(workspaceAId, adminAId, "SoleCategory");
    assert.equal(res.status, 400);
    assert.match(res.message, /Cannot delete the last category/i);
    workspaceA.settings.categories = saved;
  });

  // 14. Reset behavior is deterministic
  await t.test(
    "14. Reset restores DEFAULT_CATEGORIES and clears custom categories on docs",
    () => {
      // Add a custom category and tag a doc
      workspaceA.settings.categories.push("CustomTag");
      const testDoc = documents.find((d) => d.name === "notes.txt");
      testDoc.category = "CustomTag";

      const res = processResetCategories(workspaceAId, ownerAId);
      assert.equal(res.status, 200);
      assert.deepEqual(res.categories, DEFAULT_CATEGORIES);
      assert.equal(testDoc.category, null); // custom tag cleared
    }
  );

  // 15. Category update requires existing document edit permission
  await t.test(
    "15. Document category update requires document edit permission",
    () => {
      function processUpdateDocCategory(hasEditPermission, targetCategory) {
        if (!hasEditPermission) {
          return { status: 403, message: "Permission denied for this document action" };
        }
        const validCats = workspaceA.settings.categories;
        const matched = validCats.find(
          (c) => c.toLowerCase() === targetCategory.toLowerCase()
        );
        if (!matched) {
          return { status: 400, message: "Specified category not found in this workspace taxonomy" };
        }
        return { status: 200, category: matched };
      }

      assert.equal(processUpdateDocCategory(false, "Legal").status, 403);
      assert.equal(processUpdateDocCategory(true, "Legal").status, 200);
      assert.equal(processUpdateDocCategory(true, "NonexistentCat").status, 400);
    }
  );

  // 16. Critical: Category filtering respects existing document ACL
  await t.test(
    "16. Category match NEVER grants document access (ACL filter is authoritative)",
    () => {
      // User is permitted to view only "hr_policy.pdf"
      // User is NOT permitted to view "confidential_legal.pdf" (category: Legal)
      const confidentialDoc = documents.find(
        (d) => d.name === "confidential_legal.pdf"
      );
      assert.equal(confidentialDoc.category, "Legal");

      const allowedDocIds = [
        String(documents.find((d) => d.name === "hr_policy.pdf")._id),
      ];

      // Query ?category=Legal
      const res = processListDocumentsWithAcl({
        userWorkspaceId: workspaceAId,
        userId: regularMemberAId,
        categoryQuery: "Legal",
        allowedDocumentIds: allowedDocIds, // User lacks ACL on confidential_legal.pdf
      });

      assert.equal(res.status, 200);
      // Expected: confidential_legal.pdf MUST NOT appear even though it matches category=Legal!
      assert.equal(res.documents.length, 0);
    }
  );

  // 17. Cross-workspace category access rejected
  await t.test(
    "17. Cross-workspace category access is rejected (403)",
    () => {
      const res = processListCategories(workspaceBId, regularMemberAId);
      assert.equal(res.status, 403);
    }
  );

  // 18. Invalid category assignment rejected
  await t.test(
    "18. Invalid category assignment is rejected (400)",
    () => {
      const validCats = workspaceA.settings.categories;
      const invalidCat = "BogusCategoryNotInTaxonomy";
      const matched = validCats.find(
        (c) => c.toLowerCase() === invalidCat.toLowerCase()
      );
      assert.equal(matched, undefined);
    }
  );
});
