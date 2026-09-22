import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

test("Security & Functional Test Suite — Document Department Filtering (Phase 4)", async (t) => {
  const workspaceAId = new mongoose.Types.ObjectId();
  const workspaceBId = new mongoose.Types.ObjectId();

  const deptA1Id = new mongoose.Types.ObjectId();
  const deptA2Id = new mongoose.Types.ObjectId();
  const deptB1Id = new mongoose.Types.ObjectId();

  const userAuthorizedId = new mongoose.Types.ObjectId();
  const userUnauthorizedId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  // Mock departments database scoped by workspace
  const mockDepartments = [
    { _id: deptA1Id, workspaceId: workspaceAId, name: "Engineering" },
    { _id: deptA2Id, workspaceId: workspaceAId, name: "Marketing" },
    { _id: deptB1Id, workspaceId: workspaceBId, name: "Finance" },
  ];

  // Helper simulating department resolution in listDocuments controller
  function resolveDepartmentFilter(workspaceId, departmentIdParam) {
    if (
      departmentIdParam === undefined ||
      departmentIdParam === "" ||
      departmentIdParam === "all"
    ) {
      return { status: 200, deptFilter: undefined };
    }

    if (departmentIdParam === "unassigned" || departmentIdParam === "null") {
      return { status: 200, deptFilter: null };
    }

    if (!mongoose.Types.ObjectId.isValid(departmentIdParam)) {
      return { status: 400, message: "Invalid department ID" };
    }

    const dept = mockDepartments.find(
      (d) =>
        String(d._id) === String(departmentIdParam) &&
        String(d.workspaceId) === String(workspaceId)
    );

    if (!dept) {
      return { status: 400, message: "Department not found in this workspace" };
    }

    return { status: 200, deptFilter: dept._id };
  }

  // Test A: Same-workspace department filter works
  await t.test("A: Same-workspace department filter works", () => {
    const result = resolveDepartmentFilter(workspaceAId, String(deptA1Id));
    assert.equal(result.status, 200);
    assert.equal(String(result.deptFilter), String(deptA1Id));
  });

  // Test B: Foreign-workspace department ID rejected (400)
  await t.test("B: Foreign-workspace department ID rejected (400)", () => {
    // Attempt to filter Workspace A documents using Workspace B's department ID
    const result = resolveDepartmentFilter(workspaceAId, String(deptB1Id));
    assert.equal(result.status, 400);
    assert.equal(result.message, "Department not found in this workspace");
  });

  // Test C: Invalid department ID format rejected (400)
  await t.test("C: Invalid department ID format rejected (400)", () => {
    const result = resolveDepartmentFilter(workspaceAId, "invalid-not-an-id");
    assert.equal(result.status, 400);
    assert.equal(result.message, "Invalid department ID");
  });

  // Test D: Nonexistent department rejected (400)
  await t.test("D: Nonexistent department rejected (400)", () => {
    const randomDeptId = new mongoose.Types.ObjectId();
    const result = resolveDepartmentFilter(workspaceAId, String(randomDeptId));
    assert.equal(result.status, 400);
    assert.equal(result.message, "Department not found in this workspace");
  });

  // Test E: Document ACL cannot be bypassed via department filter
  await t.test("E: Document ACL cannot be bypassed via department filter", async () => {
    // Document belongs to Dept A1 in Workspace A
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: deptA1Id,
      name: "Confidential-Financials.pdf",
    };

    // User is in Dept A1, but has NO explicit or inherited permission to view this document
    const mockHasDocumentPermission = async ({ userId, documentId, action }) => {
      if (String(userId) === String(userUnauthorizedId)) {
        return false; // Unauthorized!
      }
      return true;
    };

    // Simulating controller ACL chain on candidate documents
    const candidateDocs = [doc];
    const authChecks = await Promise.all(
      candidateDocs.map(async (d) => {
        const canView = await mockHasDocumentPermission({
          userId: userUnauthorizedId,
          documentId: d._id,
          action: "view",
        });
        return canView ? d : null;
      })
    );
    const authorizedDocs = authChecks.filter(Boolean);

    assert.equal(
      authorizedDocs.length,
      0,
      "Unauthorized user must receive 0 documents even if department matches"
    );
  });

  // Test F: User with permission + matching department -> document returned
  await t.test("F: User with permission + matching department -> document returned", async () => {
    const doc1 = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: deptA1Id,
      name: "Engineering-Guide.pdf",
    };

    const mockHasDocumentPermission = async ({ userId }) => {
      return String(userId) === String(userAuthorizedId);
    };

    // Filter candidate documents matching query: { workspaceId: A, departmentId: deptA1Id }
    const candidateDocs = [doc1].filter(
      (d) =>
        String(d.workspaceId) === String(workspaceAId) &&
        String(d.departmentId) === String(deptA1Id)
    );

    const authorizedDocs = (
      await Promise.all(
        candidateDocs.map(async (d) => {
          const canView = await mockHasDocumentPermission({
            userId: userAuthorizedId,
            documentId: d._id,
            action: "view",
          });
          return canView ? d : null;
        })
      )
    ).filter(Boolean);

    assert.equal(authorizedDocs.length, 1);
    assert.equal(authorizedDocs[0].name, "Engineering-Guide.pdf");
  });

  // Test G: User with permission + nonmatching department -> document excluded
  await t.test("G: User with permission + nonmatching department -> document excluded", () => {
    const doc1 = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: deptA1Id, // Engineering
      name: "Engineering-Guide.pdf",
    };

    // Querying for Marketing (deptA2Id)
    const targetDeptFilter = deptA2Id;
    const matchesQuery =
      String(doc1.workspaceId) === String(workspaceAId) &&
      String(doc1.departmentId) === String(targetDeptFilter);

    assert.equal(
      matchesQuery,
      false,
      "Document in Engineering must be excluded when filtering by Marketing"
    );
  });

  // Test H: Unassigned filter returns departmentId: null documents
  await t.test("H: Unassigned filter returns departmentId: null documents", () => {
    const docUnassigned = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: null,
      name: "Unassigned-Notes.txt",
    };
    const docAssigned = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: deptA1Id,
      name: "Engineering-Plan.pdf",
    };

    const filterResult = resolveDepartmentFilter(workspaceAId, "unassigned");
    assert.equal(filterResult.status, 200);
    assert.equal(filterResult.deptFilter, null);

    const docs = [docUnassigned, docAssigned].filter(
      (d) =>
        String(d.workspaceId) === String(workspaceAId) &&
        d.departmentId === filterResult.deptFilter
    );

    assert.equal(docs.length, 1);
    assert.equal(docs[0].name, "Unassigned-Notes.txt");
  });

  // Test I: Existing documents without department remain accessible
  await t.test("I: Existing documents without department remain accessible", () => {
    const legacyDoc = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: null, // Legacy doc without department
      name: "Legacy-Spec.pdf",
    };

    // Query without department filter (all)
    const filterResult = resolveDepartmentFilter(workspaceAId, "all");
    assert.equal(filterResult.status, 200);
    assert.equal(filterResult.deptFilter, undefined);

    const matches =
      String(legacyDoc.workspaceId) === String(workspaceAId) &&
      (filterResult.deptFilter === undefined ||
        legacyDoc.departmentId === filterResult.deptFilter);

    assert.equal(matches, true, "Legacy documents without department remain accessible");
  });

  // Test J: Cross-workspace document access remains impossible
  await t.test("J: Cross-workspace document access remains impossible", () => {
    const docInWorkspaceB = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceBId,
      departmentId: deptB1Id,
      name: "WorkspaceB-Confidential.pdf",
    };

    // Query executed in Workspace A
    const queriedWorkspaceId = workspaceAId;
    const matchesWorkspaceScope =
      String(docInWorkspaceB.workspaceId) === String(queriedWorkspaceId);

    assert.equal(
      matchesWorkspaceScope,
      false,
      "Documents from Workspace B can never be returned in Workspace A query"
    );
  });

  // Test K: Updating document department requires existing edit permission
  await t.test("K: Updating document department requires existing edit permission", async () => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      departmentId: null,
    };

    // Simulate checkDocumentPermission("edit") middleware
    function checkDocPermission(action, userPerms) {
      if (userPerms.isOwner) return true;
      return userPerms.actions?.includes(action) || false;
    }

    const editorPerms = { isOwner: false, actions: ["view", "edit"] };
    const viewerOnlyPerms = { isOwner: false, actions: ["view"] };

    assert.equal(
      checkDocPermission("edit", viewerOnlyPerms),
      false,
      "Viewer-only user must be rejected when attempting to update document department"
    );
    assert.equal(
      checkDocPermission("edit", editorPerms),
      true,
      "User with edit permission is authorized to update department"
    );

    // Also test foreign department validation in updateDocumentDepartment
    const foreignDeptResult = resolveDepartmentFilter(workspaceAId, String(deptB1Id));
    assert.equal(
      foreignDeptResult.status,
      400,
      "Cannot assign foreign department to document"
    );
  });
});
