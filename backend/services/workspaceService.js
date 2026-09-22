import { Role } from "../models/Role.js";
import { Workspace } from "../models/Workspace.js";
import { WorkspaceMember } from "../models/WorkspaceMember.js";
import {
  ORG_QUOTA_BYTES,
  PERSONAL_QUOTA_BYTES,
  SYSTEM_ROLES,
} from "../constants/permissions.js";

export async function createWithSession(Model, data, session) {
  if (session) {
    const [doc] = await Model.create([data], { session });
    return doc;
  }
  return Model.create(data);
}

export function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "org"}-${suffix}`;
}

export async function seedOrgRoles(workspaceId, session) {
  const docs = SYSTEM_ROLES.map((role) => ({
    workspaceId,
    ...role,
  }));
  if (session) {
    return Role.insertMany(docs, { session });
  }
  return Role.insertMany(docs);
}

export async function createPersonalWorkspace({ userId, name }, session) {
  const workspace = await createWithSession(
    Workspace,
    {
      type: "personal",
      name: `${name}'s Workspace`,
      ownerId: userId,
      storageQuotaBytes: PERSONAL_QUOTA_BYTES,
    },
    session
  );

  await createWithSession(
    WorkspaceMember,
    {
      workspaceId: workspace._id,
      userId,
      status: "active",
      roleIds: [],
      joinedAt: new Date(),
    },
    session
  );

  return workspace;
}

export async function createOrganizationWorkspace(
  { userId, name, slug },
  session
) {
  const workspace = await createWithSession(
    Workspace,
    {
      type: "organization",
      name,
      slug: slug || slugify(name),
      ownerId: userId,
      storageQuotaBytes: ORG_QUOTA_BYTES,
    },
    session
  );

  const roles = await seedOrgRoles(workspace._id, session);
  const ownerRole = roles.find((r) => r.isOwner);

  await createWithSession(
    WorkspaceMember,
    {
      workspaceId: workspace._id,
      userId,
      status: "active",
      roleIds: ownerRole ? [ownerRole._id] : [],
      joinedAt: new Date(),
    },
    session
  );

  return workspace;
}

export function membershipPermissions(membership, workspace, userId) {
  const isOwner = String(workspace.ownerId) === String(userId);
  if (isOwner) {
    return {
      isOwner: true,
      permissions: SYSTEM_ROLES.find((r) => r.isOwner).permissions,
    };
  }

  const roles = membership?.roleIds || [];
  const permissions = new Set();
  for (const role of roles) {
    if (role?.permissions) {
      role.permissions.forEach((p) => permissions.add(p));
    }
  }

  return {
    isOwner: false,
    permissions: [...permissions],
  };
}
