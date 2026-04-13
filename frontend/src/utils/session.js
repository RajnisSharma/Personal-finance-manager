export const ROLE_ADMINISTRATOR = "administrator";
export const ROLE_USER = "user";
export const ROLE_MANAGER = "manager";

export const ROLE_DISPLAY_NAMES = {
  [ROLE_ADMINISTRATOR]: "Administrator",
  [ROLE_MANAGER]: "Account Manager",
  [ROLE_USER]: "Normal User",
};

export const PERMISSIONS = {
  VIEW_ALL_USERS: "view_all_users",
  MANAGE_ALL_USERS: "manage_all_users",
  VIEW_ASSIGNED_USERS: "view_assigned_users",
  MANAGE_ASSIGNED_USERS: "manage_assigned_users",
  VIEW_OWN_DATA: "view_own_data",
  MANAGE_OWN_DATA: "manage_own_data",
  MANAGE_SYSTEM_SETTINGS: "manage_system_settings",
  VIEW_AUDIT_LOGS: "view_audit_logs",
  MANAGE_CATEGORIES: "manage_categories",
  GENERATE_SYSTEM_REPORTS: "generate_system_reports",
  GENERATE_ASSIGNED_REPORTS: "generate_assigned_reports",
  GENERATE_OWN_REPORTS: "generate_own_reports",
  BLOCK_USERS: "block_users",
  DELETE_USERS: "delete_users",
  ASSIGN_ROLES: "assign_roles",
  VIEW_ALL_TRANSACTIONS: "view_all_transactions",
  VIEW_ASSIGNED_TRANSACTIONS: "view_assigned_transactions",
  MANAGE_BACKUP_RESTORE: "manage_backup_restore",
  HANDLE_SUPPORT: "handle_support",
};

const ROLE_PERMISSIONS = {
  [ROLE_ADMINISTRATOR]: [
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.MANAGE_ALL_USERS,
    PERMISSIONS.VIEW_ALL_TRANSACTIONS,
    PERMISSIONS.MANAGE_SYSTEM_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_CATEGORIES,
    PERMISSIONS.GENERATE_SYSTEM_REPORTS,
    PERMISSIONS.BLOCK_USERS,
    PERMISSIONS.DELETE_USERS,
    PERMISSIONS.ASSIGN_ROLES,
    PERMISSIONS.MANAGE_BACKUP_RESTORE,
    PERMISSIONS.HANDLE_SUPPORT,
    PERMISSIONS.VIEW_OWN_DATA,
    PERMISSIONS.MANAGE_OWN_DATA,
  ],
  [ROLE_MANAGER]: [
    PERMISSIONS.VIEW_ASSIGNED_USERS,
    PERMISSIONS.MANAGE_ASSIGNED_USERS,
    PERMISSIONS.VIEW_ASSIGNED_TRANSACTIONS,
    PERMISSIONS.GENERATE_ASSIGNED_REPORTS,
    PERMISSIONS.VIEW_OWN_DATA,
    PERMISSIONS.MANAGE_OWN_DATA,
  ],
  [ROLE_USER]: [
    PERMISSIONS.VIEW_OWN_DATA,
    PERMISSIONS.MANAGE_OWN_DATA,
    PERMISSIONS.GENERATE_OWN_REPORTS,
  ],
};

export function hasPermission(permission, role = getStoredRole()) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(permissions, role = getStoredRole()) {
  return permissions.some((permission) => hasPermission(permission, role));
}

export function hasAllPermissions(permissions, role = getStoredRole()) {
  return permissions.every((permission) => hasPermission(permission, role));
}

export function getRoleDisplayName(role = getStoredRole()) {
  return ROLE_DISPLAY_NAMES[role] || role;
}

export function getDashboardComponent(role = getStoredRole()) {
  switch (role) {
    case ROLE_ADMINISTRATOR:
      return "AdminDashboard";
    case ROLE_MANAGER:
      return "ManagerDashboard";
    default:
      return "UserDashboard";
  }
}

export function canManageAllUsers(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.MANAGE_ALL_USERS, role);
}

export function canViewAllUsers(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.VIEW_ALL_USERS, role);
}

export function canViewAssignedUsers(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.VIEW_ASSIGNED_USERS, role);
}

export function isNormalUserRole(role = getStoredRole()) {
  return role === ROLE_USER;
}

export function canAccessSystemSettings(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.MANAGE_SYSTEM_SETTINGS, role);
}

export function canViewAuditLogs(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS, role);
}

export function canManageCategories(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.MANAGE_CATEGORIES, role);
}

export function canBlockUsers(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.BLOCK_USERS, role);
}

export function canDeleteUsers(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.DELETE_USERS, role);
}

export function canAssignRoles(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.ASSIGN_ROLES, role);
}

export function canGenerateSystemReports(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.GENERATE_SYSTEM_REPORTS, role);
}

export function canGenerateAssignedReports(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.GENERATE_ASSIGNED_REPORTS, role);
}

export function canViewAllTransactions(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.VIEW_ALL_TRANSACTIONS, role);
}

export function canViewAssignedTransactions(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.VIEW_ASSIGNED_TRANSACTIONS, role);
}

export function canManageBackupRestore(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.MANAGE_BACKUP_RESTORE, role);
}

export function canHandleSupport(role = getStoredRole()) {
  return hasPermission(PERMISSIONS.HANDLE_SUPPORT, role);
}

export function getUserNavLinks(role = getStoredRole()) {
  const baseLinks = [
    { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/accounts", label: "Accounts", icon: "account_balance" },
    { to: "/transactions", label: "Transactions", icon: "receipt" },
    { to: "/budgets", label: "Budgets", icon: "account_balance_wallet" },
    { to: "/goals", label: "Goals", icon: "flag" },
    { to: "/investments", label: "Investments", icon: "trending_up" },
    { to: "/payments", label: "Payments", icon: "payment" },
    { to: "/reports", label: "Reports", icon: "assessment" },
  ];

  if (isAdminRole(role)) {
    return [
      ...baseLinks,
      { to: "/management/users", label: "Users", icon: "people" },
      { to: "/management/categories", label: "Categories", icon: "category" },
      { to: "/management/audit-logs", label: "Audit Logs", icon: "history" },
      { to: "/management/settings", label: "System", icon: "settings" },
    ];
  }

  if (isManagerRole(role)) {
    return [
      { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { to: "/reports", label: "Reports", icon: "assessment" },
      { to: "/accounts", label: "My Accounts", icon: "account_balance" },
      { to: "/transactions", label: "My Transactions", icon: "receipt" },
    ];
  }

  return baseLinks;
}

export function isAuthenticated() {
  const token = localStorage.getItem("access");
  if (!token) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getStoredUser() {
  const rawUser = localStorage.getItem("currentUser");
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function getStoredRole() {
  return localStorage.getItem("role") || getStoredUser()?.role || ROLE_USER;
}

export function persistSession(authPayload) {
  const user = authPayload.user || {};

  if (authPayload.access) {
    localStorage.setItem("access", authPayload.access);
  }
  if (authPayload.refresh) {
    localStorage.setItem("refresh", authPayload.refresh);
  }

  localStorage.setItem("username", user.username || "");
  localStorage.setItem("role", user.role || ROLE_USER);
  localStorage.setItem("currentUser", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  localStorage.removeItem("currentUser");
}

export function getHomeRoute(role = getStoredRole()) {
  return "/dashboard";
}

export function canManageUsers(role = getStoredRole()) {
  return role === ROLE_ADMINISTRATOR || role === ROLE_MANAGER;
}

export function isAdminRole(role = getStoredRole()) {
  return role === ROLE_ADMINISTRATOR;
}

export function isManagerRole(role = getStoredRole()) {
  return role === ROLE_MANAGER;
}
