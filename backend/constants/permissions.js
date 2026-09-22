export const ROLE_PERMISSIONS = [
  "members.invite",
  "roles.manage",
  "departments.manage",
  "audit.view",
  "dashboard.view",
  "sharing.manage",
  "storage.view",
];

export const DOCUMENT_ACTIONS = ["view", "edit", "download", "share", "delete"];

export const LINK_ACTIONS = ["view", "download"];

export const DEFAULT_CATEGORIES = [
  "HR",
  "Finance",
  "Projects",
  "Legal",
  "General",
];

export const PERSONAL_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
export const ORG_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;

export const SYSTEM_ROLES = [
  {
    name: "Owner",
    isSystem: true,
    isOwner: true,
    permissions: [...ROLE_PERMISSIONS],
  },
  {
    name: "Admin",
    isSystem: true,
    isOwner: false,
    permissions: [...ROLE_PERMISSIONS],
  },
  {
    name: "Manager",
    isSystem: true,
    isOwner: false,
    permissions: [
      "members.invite",
      "dashboard.view",
      "sharing.manage",
      "audit.view",
    ],
  },
  {
    name: "Employee",
    isSystem: true,
    isOwner: false,
    permissions: ["dashboard.view"],
  },
];
