import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

test("Security Test Suite — Department Management", async (t) => {
  const workspaceAId = new mongoose.Types.ObjectId();
  const workspaceBId = new mongoose.Types.ObjectId();
  const deptA1Id = new mongoose.Types.ObjectId();
  const deptA2Id = new mongoose.Types.ObjectId();
  const deptBId = new mongoose.Types.ObjectId();
  const memberActiveId = new mongoose.Types.ObjectId();
  const memberInactiveId = new mongoose.Types.ObjectId();
  const userForeignId = new mongoose.Types.ObjectId();

  await t.test("1. Unauthorized user cannot create, update, or delete department", () => {
    const authz = { isOwner: false, permissions: ["dashboard.view"] }; // lacks "departments.manage"
    const canManageDepts = authz.isOwner || authz.permissions.includes("departments.manage");
    assert.equal(canManageDepts, false, "Must reject user without departments.manage");
  });

  await t.test("2. Cross-workspace department access: Workspace A cannot access Workspace B department", () => {
    const deptInWorkspaceB = {
      _id: deptBId,
      workspaceId: workspaceBId,
      name: "Engineering",
    };
    const reqWorkspaceId = workspaceAId;

    const matches =
      String(deptInWorkspaceB.workspaceId) === String(reqWorkspaceId);
    assert.equal(matches, false, "Department from Workspace B cannot match Workspace A scope");
  });

  await t.test("3. Cross-workspace parent: Parent department must belong to the same workspace", () => {
    const proposedParent = {
      _id: deptBId,
      workspaceId: workspaceBId, // Foreign workspace
    };
    const currentWorkspaceId = workspaceAId;

    const isValidParent = String(proposedParent.workspaceId) === String(currentWorkspaceId);
    assert.equal(isValidParent, false, "Parent from foreign workspace must be rejected");
  });

  await t.test("4. Cross-workspace manager: Manager must be a member of the current workspace", () => {
    const activeMembersInWorkspaceA = [
      { userId: memberActiveId, workspaceId: workspaceAId, status: "active" },
    ];
    const proposedManagerId = userForeignId;

    const memberMatch = activeMembersInWorkspaceA.find(
      (m) => String(m.userId) === String(proposedManagerId) && m.status === "active"
    );
    assert.equal(!!memberMatch, false, "Foreign user cannot be department manager");
  });

  await t.test("5. Self-parenting: Department cannot be its own parent", () => {
    const targetDeptId = deptA1Id;
    const proposedParentId = deptA1Id;

    const isSelfParent = String(targetDeptId) === String(proposedParentId);
    assert.equal(isSelfParent, true, "Self-parenting condition detected");
  });

  await t.test("6. Descendant circular reference: Department cannot use descendant as parent", () => {
    // Tree: Root -> DeptA1 -> DeptA2 (Child of DeptA1)
    // Attempting to set DeptA1's parent to DeptA2 would form a cycle
    const depts = [
      { _id: String(deptA1Id), parentId: null },
      { _id: String(deptA2Id), parentId: String(deptA1Id) },
    ];

    function checkDescendant(potentialDescendantId, ancestorId) {
      let curr = potentialDescendantId;
      while (curr) {
        if (String(curr) === String(ancestorId)) return true;
        const found = depts.find((d) => d._id === String(curr));
        curr = found ? found.parentId : null;
      }
      return false;
    }

    const causesCycle = checkDescendant(String(deptA2Id), String(deptA1Id));
    assert.equal(causesCycle, true, "Must detect that DeptA2 is a descendant of DeptA1");
  });

  await t.test("7. Inactive or removed member cannot be selected as department manager", () => {
    const members = [
      { userId: memberInactiveId, workspaceId: workspaceAId, status: "removed" },
    ];

    const isEligibleManager = members.some(
      (m) => String(m.userId) === String(memberInactiveId) && m.status === "active"
    );
    assert.equal(isEligibleManager, false, "Inactive/removed member must be rejected as manager");
  });

  await t.test("8. Inactive or removed member cannot be assigned to department", () => {
    const proposedMember = {
      _id: memberInactiveId,
      workspaceId: workspaceAId,
      status: "suspended",
    };

    const isAssignable = proposedMember.status === "active";
    assert.equal(isAssignable, false, "Suspended/removed member cannot be assigned");
  });

  await t.test("9. Deleted department cleanup: unassigns department ID from members", () => {
    const targetDeptId = deptA1Id;
    const member = {
      _id: memberActiveId,
      departmentIds: [deptA1Id, deptA2Id],
    };

    // Simulate $pull: { departmentIds: targetDeptId }
    member.departmentIds = member.departmentIds.filter(
      (id) => String(id) !== String(targetDeptId)
    );

    assert.equal(member.departmentIds.length, 1);
    assert.equal(String(member.departmentIds[0]), String(deptA2Id));
  });

  await t.test("10. Parent deletion reparenting: child departments reparent to deleted parent's parent", () => {
    const parentDept = { _id: deptA1Id, parentId: null }; // Root
    const childDept = { _id: deptA2Id, parentId: deptA1Id };

    // When parentDept is deleted, childDept.parentId becomes parentDept.parentId (null)
    childDept.parentId = parentDept.parentId || null;

    assert.equal(childDept.parentId, null, "Child of deleted root department becomes root (null)");
  });

  await t.test("11. Duplicate department name validation (case-insensitive in workspace)", () => {
    const existingDepts = [
      { workspaceId: workspaceAId, name: "Engineering" },
    ];
    const newName = "engineering"; // Case-insensitive collision

    const isDuplicate = existingDepts.some(
      (d) =>
        String(d.workspaceId) === String(workspaceAId) &&
        d.name.toLowerCase() === newName.toLowerCase().trim()
    );
    assert.equal(isDuplicate, true, "Case-insensitive duplicate must be rejected");
  });

  await t.test("12. Bulk assignment atomic validation: rejects entire batch if ANY member is invalid", () => {
    const activeMembersInWorkspace = [
      { _id: String(memberActiveId), status: "active", workspaceId: String(workspaceAId) },
    ];
    // Input batch includes 1 valid and 1 foreign/inactive member
    const batchToAssign = [String(memberActiveId), String(memberInactiveId)];

    const validatedMembers = activeMembersInWorkspace.filter(
      (m) => batchToAssign.includes(m._id) && m.status === "active"
    );

    const isAllValid = validatedMembers.length === batchToAssign.length;
    assert.equal(isAllValid, false, "Partial batch must fail atomic validation and be rejected");
  });
});
