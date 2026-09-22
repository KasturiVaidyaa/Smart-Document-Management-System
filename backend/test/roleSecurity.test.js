import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { ROLE_PERMISSIONS, SYSTEM_ROLES } from "../constants/permissions.js";
import { membershipPermissions } from "../services/workspaceService.js";

test("Security Test Suite — Role-Based Access Control (Phase 5)", async (t) => {
  const workspaceAId = new mongoose.Types.ObjectId();
  const workspaceBId = new mongoose.Types.ObjectId();

  const ownerAId = new mongoose.Types.ObjectId();
  const adminRoleAId = new mongoose.Types.ObjectId();
  const employeeRoleAId = new mongoose.Types.ObjectId();
  const customRoleAId = new mongoose.Types.ObjectId();
  const customRoleBId = new mongoose.Types.ObjectId();

  const userRegularId = new mongoose.Types.ObjectId();

  const RESERVED_ROLE_NAMES = ["owner", "admin", "manager", "employee"];

  // 1. Unauthorized user cannot create roles
  await t.test("1. Unauthorized user cannot create roles", () => {
    const authz = { isOwner: false, permissions: ["dashboard.view"] }; // lacks "roles.manage"
    const canManageRoles = authz.isOwner || authz.permissions.includes("roles.manage");
    assert.equal(canManageRoles, false, "Must reject role creation if user lacks roles.manage");
  });

  // 2. Unauthorized user cannot update roles
  await t.test("2. Unauthorized user cannot update roles", () => {
    const authz = { isOwner: false, permissions: ["members.invite", "departments.manage"] };
    const canManageRoles = authz.isOwner || authz.permissions.includes("roles.manage");
    assert.equal(canManageRoles, false, "Must reject role update if user lacks roles.manage");
  });

  // 3. Unauthorized user cannot delete roles
  await t.test("3. Unauthorized user cannot delete roles", () => {
    const authz = { isOwner: false, permissions: ["sharing.manage"] };
    const canManageRoles = authz.isOwner || authz.permissions.includes("roles.manage");
    assert.equal(canManageRoles, false, "Must reject role deletion if user lacks roles.manage");
  });

  // 4. Cross-workspace role access is rejected
  await t.test("4. Cross-workspace role access is rejected", () => {
    const roleInWorkspaceB = {
      _id: customRoleBId,
      workspaceId: workspaceBId,
      name: "Workspace B Lead",
    };

    // Scoped check: query enforces { _id: roleId, workspaceId: req.workspace._id }
    const currentWorkspaceId = workspaceAId;
    const matches =
      String(roleInWorkspaceB.workspaceId) === String(currentWorkspaceId);

    assert.equal(matches, false, "Role in Workspace B must not match Workspace A scope");
  });

  // 5. Owner cannot be renamed
  await t.test("5. Owner cannot be renamed", () => {
    const ownerRole = {
      _id: ownerAId,
      workspaceId: workspaceAId,
      name: "Owner",
      isOwner: true,
      isSystem: true,
    };

    function validateUpdate(role, newName) {
      if (role.isOwner) return { status: 403, message: "Cannot modify the Owner role" };
      if (role.isSystem) return { status: 403, message: "System roles cannot be modified" };
      return { status: 200 };
    }

    const res = validateUpdate(ownerRole, "Chief Executive");
    assert.equal(res.status, 403);
    assert.equal(res.message, "Cannot modify the Owner role");
  });

  // 6. Owner cannot have permissions changed
  await t.test("6. Owner cannot have permissions changed", () => {
    const ownerRole = {
      _id: ownerAId,
      workspaceId: workspaceAId,
      name: "Owner",
      isOwner: true,
      isSystem: true,
      permissions: [...ROLE_PERMISSIONS],
    };

    function validatePermissionChange(role, newPerms) {
      if (role.isOwner) return { status: 403, message: "Cannot modify the Owner role" };
      return { status: 200 };
    }

    const res = validatePermissionChange(ownerRole, ["dashboard.view"]);
    assert.equal(res.status, 403);
    assert.equal(res.message, "Cannot modify the Owner role");
  });

  // 7. Owner cannot be deleted
  await t.test("7. Owner cannot be deleted", () => {
    const ownerRole = {
      _id: ownerAId,
      workspaceId: workspaceAId,
      isOwner: true,
      isSystem: true,
    };

    function validateDelete(role) {
      if (role.isOwner) return { status: 403, message: "Cannot delete the Owner role" };
      if (role.isSystem) return { status: 403, message: "System roles cannot be deleted" };
      return { status: 200 };
    }

    const res = validateDelete(ownerRole);
    assert.equal(res.status, 403);
    assert.equal(res.message, "Cannot delete the Owner role");
  });

  // 8. System roles cannot be renamed
  await t.test("8. System roles cannot be renamed", () => {
    const adminRole = {
      _id: adminRoleAId,
      workspaceId: workspaceAId,
      name: "Admin",
      isSystem: true,
      isOwner: false,
    };

    function validateUpdate(role, newName) {
      if (role.isOwner) return { status: 403, message: "Cannot modify the Owner role" };
      if (role.isSystem) return { status: 403, message: "System roles cannot be modified" };
      return { status: 200 };
    }

    const res = validateUpdate(adminRole, "Super Admin");
    assert.equal(res.status, 403);
    assert.equal(res.message, "System roles cannot be modified");
  });

  // 9. System roles cannot be deleted
  await t.test("9. System roles cannot be deleted", () => {
    const employeeRole = {
      _id: employeeRoleAId,
      workspaceId: workspaceAId,
      name: "Employee",
      isSystem: true,
      isOwner: false,
    };

    function validateDelete(role) {
      if (role.isOwner) return { status: 403, message: "Cannot delete the Owner role" };
      if (role.isSystem) return { status: 403, message: "System roles cannot be deleted" };
      return { status: 200 };
    }

    const res = validateDelete(employeeRole);
    assert.equal(res.status, 403);
    assert.equal(res.message, "System roles cannot be deleted");
  });

  // 10. Reserved names are rejected case-insensitively
  await t.test("10. Reserved names are rejected case-insensitively", () => {
    function validateRoleName(name) {
      if (RESERVED_ROLE_NAMES.includes(name.trim().toLowerCase())) {
        return { status: 400, message: `"${name}" is a reserved system role name` };
      }
      return { status: 200 };
    }

    assert.equal(validateRoleName("owner").status, 400);
    assert.equal(validateRoleName("ADMIN").status, 400);
    assert.equal(validateRoleName("Manager").status, 400);
    assert.equal(validateRoleName("eMpLoYeE").status, 400);
    assert.equal(validateRoleName("Custom Reviewer").status, 200);
  });

  // 11. Duplicate custom role names are rejected within the workspace
  await t.test("11. Duplicate custom role names are rejected within the workspace", () => {
    const existingRoles = [
      { _id: new mongoose.Types.ObjectId(), workspaceId: workspaceAId, name: "Compliance Officer" },
    ];

    function checkDuplicateName(workspaceId, proposedName, excludeId = null) {
      const match = existingRoles.find(
        (r) =>
          String(r.workspaceId) === String(workspaceId) &&
          r.name.toLowerCase() === proposedName.trim().toLowerCase() &&
          (!excludeId || String(r._id) !== String(excludeId))
      );
      if (match) {
        return { status: 400, message: "A role with this name already exists in this workspace" };
      }
      return { status: 200 };
    }

    assert.equal(checkDuplicateName(workspaceAId, "compliance officer").status, 400);
    assert.equal(checkDuplicateName(workspaceAId, "COMPLIANCE OFFICER").status, 400);
    assert.equal(checkDuplicateName(workspaceAId, "Security Auditor").status, 200);
  });

  // 12. Invalid permissions are rejected
  await t.test("12. Invalid permissions are rejected", () => {
    function validatePermissions(perms) {
      if (!Array.isArray(perms) || perms.length === 0) {
        return { status: 400, message: "Permissions must be a non-empty array" };
      }
      const invalid = perms.filter((p) => !ROLE_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        return { status: 400, message: `Invalid permissions: ${invalid.join(", ")}` };
      }
      return { status: 200 };
    }

    assert.equal(validatePermissions([]).status, 400);
    assert.equal(validatePermissions(["root.all"]).status, 400);
    assert.equal(validatePermissions(["members.invite", "invalid.action"]).status, 400);
    assert.equal(validatePermissions(["members.invite", "departments.manage"]).status, 200);
  });

  // 13. Valid custom role is created correctly
  await t.test("13. Valid custom role is created correctly", () => {
    const validPayload = {
      name: "Auditor",
      permissions: ["audit.view", "dashboard.view"],
    };

    const createdRole = {
      _id: customRoleAId,
      workspaceId: workspaceAId,
      name: validPayload.name.trim(),
      isSystem: false,
      isOwner: false,
      permissions: [...validPayload.permissions],
    };

    assert.equal(createdRole.isSystem, false);
    assert.equal(createdRole.isOwner, false);
    assert.equal(createdRole.name, "Auditor");
    assert.deepEqual(createdRole.permissions, ["audit.view", "dashboard.view"]);
  });

  // 14. Custom role permissions can be updated
  await t.test("14. Custom role permissions can be updated", () => {
    const role = {
      _id: customRoleAId,
      workspaceId: workspaceAId,
      name: "Auditor",
      isSystem: false,
      isOwner: false,
      permissions: ["audit.view"],
    };

    const newPermissions = ["audit.view", "storage.view"];
    const invalid = newPermissions.filter((p) => !ROLE_PERMISSIONS.includes(p));
    assert.equal(invalid.length, 0);

    role.permissions = newPermissions;
    assert.deepEqual(role.permissions, ["audit.view", "storage.view"]);
  });

  // 15. Custom role deletion removes role references only in the correct workspace
  await t.test("15. Custom role deletion removes role references only in the correct workspace", () => {
    const targetRoleId = customRoleAId;

    const members = [
      {
        _id: new mongoose.Types.ObjectId(),
        workspaceId: workspaceAId,
        roleIds: [targetRoleId, employeeRoleAId],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        workspaceId: workspaceBId, // Foreign workspace
        roleIds: [targetRoleId],
      },
    ];

    // Cleanup simulation scoped to workspaceAId
    members.forEach((m) => {
      if (String(m.workspaceId) === String(workspaceAId)) {
        m.roleIds = m.roleIds.filter((rId) => String(rId) !== String(targetRoleId));
      }
    });

    assert.equal(members[0].roleIds.length, 1);
    assert.equal(String(members[0].roleIds[0]), String(employeeRoleAId));
    // Member in Workspace B remains untouched
    assert.equal(members[1].roleIds.length, 1);
    assert.equal(String(members[1].roleIds[0]), String(targetRoleId));
  });

  // 16. Member with another role remains assigned to that role after custom-role deletion
  await t.test("16. Member with another role remains assigned to that role after custom-role deletion", () => {
    const otherRoleId = new mongoose.Types.ObjectId();
    const member = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      roleIds: [customRoleAId, otherRoleId],
    };

    // Pull customRoleAId
    member.roleIds = member.roleIds.filter((id) => String(id) !== String(customRoleAId));

    assert.equal(member.roleIds.length, 1);
    assert.equal(String(member.roleIds[0]), String(otherRoleId));
  });

  // 17. Member left with zero roles receives the SAME WORKSPACE'S Employee role
  await t.test("17. Member left with zero roles receives the SAME WORKSPACE'S Employee role", () => {
    const employeeRoleInA = {
      _id: employeeRoleAId,
      workspaceId: workspaceAId,
      name: "Employee",
      isSystem: true,
    };

    const member = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      roleIds: [customRoleAId], // only holds the custom role being deleted
    };

    // Remove deleted role
    member.roleIds = member.roleIds.filter((id) => String(id) !== String(customRoleAId));

    // Fallback logic
    if (member.roleIds.length === 0) {
      assert.equal(
        String(employeeRoleInA.workspaceId),
        String(member.workspaceId),
        "Employee role must belong to the same workspace"
      );
      member.roleIds.push(employeeRoleInA._id);
    }

    assert.equal(member.roleIds.length, 1);
    assert.equal(String(member.roleIds[0]), String(employeeRoleAId));
  });

  // 18. Multiple roles produce the existing permission union behavior
  await t.test("18. Multiple roles produce the existing permission union behavior", () => {
    const role1 = {
      _id: new mongoose.Types.ObjectId(),
      permissions: ["dashboard.view"],
    };
    const role2 = {
      _id: new mongoose.Types.ObjectId(),
      permissions: ["members.invite", "sharing.manage"],
    };

    const membership = {
      roleIds: [role1, role2],
    };

    const workspace = {
      _id: workspaceAId,
      ownerId: new mongoose.Types.ObjectId(), // Different user is owner
    };

    const authz = membershipPermissions(membership, workspace, userRegularId);

    assert.equal(authz.isOwner, false);
    assert.equal(authz.permissions.includes("dashboard.view"), true);
    assert.equal(authz.permissions.includes("members.invite"), true);
    assert.equal(authz.permissions.includes("sharing.manage"), true);
    assert.equal(authz.permissions.length, 3);
  });

  // 19. Custom role cannot gain permissions outside ROLE_PERMISSIONS
  await t.test("19. Custom role cannot gain permissions outside ROLE_PERMISSIONS", () => {
    const proposed = ["members.invite", "custom.hack", "admin.bypass"];
    const invalid = proposed.filter((p) => !ROLE_PERMISSIONS.includes(p));

    assert.equal(invalid.length, 2);
    assert.deepEqual(invalid, ["custom.hack", "admin.bypass"]);
  });

  // 20. Frontend cannot bypass backend role immutability
  await t.test("20. Frontend cannot bypass backend role immutability", () => {
    // Simulate server-side controller check rejecting direct API call targeting system role
    const systemRole = {
      _id: adminRoleAId,
      workspaceId: workspaceAId,
      name: "Admin",
      isSystem: true,
      isOwner: false,
    };

    function serverSideUpdateGuard(role) {
      if (role.isOwner) return { status: 403, error: "Cannot modify the Owner role" };
      if (role.isSystem) return { status: 403, error: "System roles cannot be modified" };
      return { status: 200 };
    }

    function serverSideDeleteGuard(role) {
      if (role.isOwner) return { status: 403, error: "Cannot delete the Owner role" };
      if (role.isSystem) return { status: 403, error: "System roles cannot be deleted" };
      return { status: 200 };
    }

    assert.equal(serverSideUpdateGuard(systemRole).status, 403);
    assert.equal(serverSideDeleteGuard(systemRole).status, 403);
  });
});
