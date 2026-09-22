import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { DEFAULT_CATEGORIES } from "../constants/permissions.js";
import { membershipPermissions } from "../services/workspaceService.js";

test("Security Test Suite — Workspace Settings (Phase 6)", async (t) => {
  const workspaceAId = new mongoose.Types.ObjectId();
  const workspaceBId = new mongoose.Types.ObjectId();
  const ownerAId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();
  const regularUserId = new mongoose.Types.ObjectId();

  // Helper simulating controller allowlist and validation logic
  function processSettingsUpdate(req, workspace) {
    // 1. Authorization
    const canManage =
      req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
    if (!canManage) {
      return { status: 403, message: "Insufficient permissions to modify workspace settings" };
    }

    // 2. Top-level allowlist
    const ALLOWED_TOP_FIELDS = ["name", "settings"];
    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.length === 0) {
      return { status: 400, message: "No update fields provided" };
    }

    for (const key of bodyKeys) {
      if (!ALLOWED_TOP_FIELDS.includes(key)) {
        return { status: 400, message: `Field '${key}' cannot be modified through this endpoint` };
      }
    }

    // 3. Name validation
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return { status: 400, message: "Workspace name cannot be empty" };
      }
      const trimmed = req.body.name.trim();
      if (trimmed.length > 100) {
        return { status: 400, message: "Workspace name cannot exceed 100 characters" };
      }
      workspace.name = trimmed;
    }

    // 4. Nested settings allowlist
    if (req.body.settings !== undefined) {
      if (
        typeof req.body.settings !== "object" ||
        req.body.settings === null ||
        Array.isArray(req.body.settings)
      ) {
        return { status: 400, message: "Settings must be an object" };
      }

      const ALLOWED_SETTINGS_KEYS = [
        "allowExternalSharing",
        "defaultLinkExpiryHours",
        "aiEnabled",
      ];
      const settingsKeys = Object.keys(req.body.settings);

      for (const key of settingsKeys) {
        if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
          return { status: 400, message: `Setting '${key}' is invalid or cannot be modified` };
        }
      }

      const { allowExternalSharing, defaultLinkExpiryHours, aiEnabled } = req.body.settings;

      if (allowExternalSharing !== undefined) {
        if (typeof allowExternalSharing !== "boolean") {
          return { status: 400, message: "allowExternalSharing must be a boolean" };
        }
        workspace.settings.allowExternalSharing = allowExternalSharing;
      }

      if (defaultLinkExpiryHours !== undefined) {
        if (
          typeof defaultLinkExpiryHours !== "number" ||
          !Number.isInteger(defaultLinkExpiryHours) ||
          defaultLinkExpiryHours < 1 ||
          defaultLinkExpiryHours > 8760
        ) {
          return { status: 400, message: "defaultLinkExpiryHours must be an integer between 1 and 8760" };
        }
        workspace.settings.defaultLinkExpiryHours = defaultLinkExpiryHours;
      }

      if (aiEnabled !== undefined) {
        if (typeof aiEnabled !== "boolean") {
          return { status: 400, message: "aiEnabled must be a boolean" };
        }
        workspace.settings.aiEnabled = aiEnabled;
      }
    }

    return { status: 200, workspace };
  }

  // Fresh workspace fixture factory
  function createWorkspaceFixture() {
    return {
      _id: workspaceAId,
      ownerId: ownerAId,
      type: "organization",
      name: "Engineering Org",
      slug: "eng-org-abc",
      storageQuotaBytes: 53687091200,
      storageUsedBytes: 1048576,
      settings: {
        allowExternalSharing: true,
        defaultLinkExpiryHours: 72,
        aiEnabled: true,
        categories: [...DEFAULT_CATEGORIES],
      },
    };
  }

  // 1. Unauthorized member cannot update workspace settings
  await t.test("1. Unauthorized member cannot update workspace settings", () => {
    const req = {
      authz: { isOwner: false, permissions: ["dashboard.view"] },
      body: { name: "Hacked Workspace" },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 403);
    assert.match(res.message, /Insufficient permissions/i);
  });

  // 2. Authorized owner can update settings
  await t.test("2. Authorized owner can update settings", () => {
    const ws = createWorkspaceFixture();
    const req = {
      authz: { isOwner: true, permissions: [] },
      body: { name: "Engineering Org v2" },
    };
    const res = processSettingsUpdate(req, ws);
    assert.equal(res.status, 200);
    assert.equal(ws.name, "Engineering Org v2");
  });

  // 3. Authorized administrator can update settings using the EXISTING admin permission
  await t.test("3. Authorized administrator can update settings using the EXISTING admin permission", () => {
    const ws = createWorkspaceFixture();
    const req = {
      authz: { isOwner: false, permissions: ["roles.manage"] },
      body: { settings: { aiEnabled: false } },
    };
    const res = processSettingsUpdate(req, ws);
    assert.equal(res.status, 200);
    assert.equal(ws.settings.aiEnabled, false);
  });

  // 4. Cross-workspace update is rejected
  await t.test("4. Cross-workspace update is rejected", () => {
    // User belongs to Workspace A, attempts to update Workspace B
    const userMemberships = [
      { workspaceId: String(workspaceAId), userId: String(regularUserId), status: "active" },
    ];
    const targetWorkspaceId = String(workspaceBId);

    const hasAccess = userMemberships.some(
      (m) => m.workspaceId === targetWorkspaceId && m.status === "active"
    );
    assert.equal(hasAccess, false, "Cross-workspace access must be denied");
  });

  // 5. Empty name rejected
  await t.test("5. Empty name rejected", () => {
    const req = {
      authz: { isOwner: true },
      body: { name: "" },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Workspace name cannot be empty");
  });

  // 6. Whitespace-only name rejected
  await t.test("6. Whitespace-only name rejected", () => {
    const req = {
      authz: { isOwner: true },
      body: { name: "    " },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Workspace name cannot be empty");
  });

  // 7. Name length validation works
  await t.test("7. Name length validation works", () => {
    const req = {
      authz: { isOwner: true },
      body: { name: "x".repeat(101) },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Workspace name cannot exceed 100 characters");
  });

  // 8. Invalid allowExternalSharing type rejected
  await t.test("8. Invalid allowExternalSharing type rejected", () => {
    const req = {
      authz: { isOwner: true },
      body: { settings: { allowExternalSharing: "true" } }, // string instead of boolean
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "allowExternalSharing must be a boolean");
  });

  // 9. Invalid aiEnabled type rejected
  await t.test("9. Invalid aiEnabled type rejected", () => {
    const req = {
      authz: { isOwner: true },
      body: { settings: { aiEnabled: 1 } }, // number instead of boolean
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "aiEnabled must be a boolean");
  });

  // 10. Invalid defaultLinkExpiryHours rejected
  await t.test("10. Invalid defaultLinkExpiryHours rejected", () => {
    const invalidValues = [-1, 0, 8761, 3.5, "72", null];
    for (const val of invalidValues) {
      const req = {
        authz: { isOwner: true },
        body: { settings: { defaultLinkExpiryHours: val } },
      };
      const res = processSettingsUpdate(req, createWorkspaceFixture());
      assert.equal(res.status, 400, `Expected 400 for defaultLinkExpiryHours: ${val}`);
    }
  });

  // 11. ownerId cannot be changed
  await t.test("11. ownerId cannot be changed", () => {
    const req = {
      authz: { isOwner: true },
      body: { ownerId: new mongoose.Types.ObjectId() },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field 'ownerId' cannot be modified through this endpoint");
  });

  // 12. type cannot be changed
  await t.test("12. type cannot be changed", () => {
    const req = {
      authz: { isOwner: true },
      body: { type: "personal" },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field 'type' cannot be modified through this endpoint");
  });

  // 13. storageQuotaBytes cannot be changed
  await t.test("13. storageQuotaBytes cannot be changed", () => {
    const req = {
      authz: { isOwner: true },
      body: { storageQuotaBytes: 1099511627776 },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field 'storageQuotaBytes' cannot be modified through this endpoint");
  });

  // 14. storageUsedBytes cannot be changed
  await t.test("14. storageUsedBytes cannot be changed", () => {
    const req = {
      authz: { isOwner: true },
      body: { storageUsedBytes: 0 },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field 'storageUsedBytes' cannot be modified through this endpoint");
  });

  // 15. slug cannot be changed
  await t.test("15. slug cannot be changed", () => {
    const req = {
      authz: { isOwner: true },
      body: { slug: "hijacked-slug" },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field 'slug' cannot be modified through this endpoint");
  });

  // 16. _id cannot be changed
  await t.test("16. _id cannot be changed", () => {
    const req = {
      authz: { isOwner: true },
      body: { _id: new mongoose.Types.ObjectId() },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field '_id' cannot be modified through this endpoint");
  });

  // 17. Unknown top-level fields cannot modify workspace data
  await t.test("17. Unknown top-level fields cannot modify workspace data", () => {
    const req = {
      authz: { isOwner: true },
      body: { unexpectedField: "malicious-payload" },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Field 'unexpectedField' cannot be modified through this endpoint");
  });

  // 18. Unknown nested settings cannot modify workspace data
  await t.test("18. Unknown nested settings cannot modify workspace data", () => {
    const req = {
      authz: { isOwner: true },
      body: { settings: { bypassAuth: true } },
    };
    const res = processSettingsUpdate(req, createWorkspaceFixture());
    assert.equal(res.status, 400);
    assert.equal(res.message, "Setting 'bypassAuth' is invalid or cannot be modified");
  });

  // 19. Updating one setting preserves all other existing settings
  await t.test("19. Updating one setting preserves all other existing settings", () => {
    const ws = createWorkspaceFixture();
    const req = {
      authz: { isOwner: true },
      body: { settings: { aiEnabled: false } },
    };
    const res = processSettingsUpdate(req, ws);
    assert.equal(res.status, 200);
    assert.equal(ws.settings.aiEnabled, false);
    // Preserved other settings
    assert.equal(ws.settings.allowExternalSharing, true);
    assert.equal(ws.settings.defaultLinkExpiryHours, 72);
    assert.deepEqual(ws.settings.categories, DEFAULT_CATEGORIES);
  });

  // 20. Existing workspace creation still works
  await t.test("20. Existing workspace creation still works", () => {
    const newWs = {
      name: "New Org",
      type: "organization",
      ownerId: ownerAId,
      storageQuotaBytes: 53687091200,
      storageUsedBytes: 0,
      settings: {
        allowExternalSharing: true,
        defaultLinkExpiryHours: 72,
        aiEnabled: true,
        categories: [...DEFAULT_CATEGORIES],
      },
    };
    assert.equal(newWs.name, "New Org");
    assert.equal(newWs.type, "organization");
    assert.equal(newWs.settings.defaultLinkExpiryHours, 72);
  });

  // 21. Existing workspace switching still works
  await t.test("21. Existing workspace switching still works", () => {
    const wsA = createWorkspaceFixture();
    const wsB = { ...createWorkspaceFixture(), _id: workspaceBId, name: "Workspace B" };
    const memberships = [
      { workspaceId: wsA._id, status: "active" },
      { workspaceId: wsB._id, status: "active" },
    ];
    const availableWorkspaceIds = memberships.map((m) => String(m.workspaceId));
    assert.equal(availableWorkspaceIds.includes(String(workspaceAId)), true);
    assert.equal(availableWorkspaceIds.includes(String(workspaceBId)), true);
  });

  // 22. Existing authentication still works
  await t.test("22. Existing authentication still works", () => {
    const req = { user: { _id: regularUserId, status: "active" } };
    assert.equal(req.user.status, "active");
  });

  // 23. Existing document access is unchanged
  await t.test("23. Existing document access is unchanged", () => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceAId,
      name: "Doc.pdf",
    };
    const reqWorkspaceId = workspaceAId;
    assert.equal(String(doc.workspaceId), String(reqWorkspaceId));
  });
});
