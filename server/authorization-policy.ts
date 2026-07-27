import type { SafeUser } from "@shared/schema";

export type PolicyResource =
  | "users"
  | "platformConfig"
  | "complianceRecords"
  | "auditLogs"
  | "ttbReports"
  | "ttbReportApproval"
  | "ttbReportExport"
  | "salesOrders"
  | "clientAttachments"
  | "jobPhotos";

export type PolicyAction = "read" | "write" | "delete" | "upload" | "approve" | "export";

const allRoles: SafeUser["role"][] = ["admin", "distiller", "cellar", "compliance", "inventory", "sales"];

export const AUTHORIZATION_POLICY_MATRIX: Record<
  PolicyResource,
  Partial<Record<PolicyAction, SafeUser["role"][]>>
> = {
  users: {
    read: ["admin"],
    write: ["admin"],
    delete: ["admin"],
  },
  platformConfig: {
    read: allRoles,
    write: ["admin"],
  },
  complianceRecords: {
    read: allRoles,
    write: ["admin", "compliance"],
    delete: ["admin", "compliance"],
  },
  auditLogs: {
    read: ["admin", "compliance"],
  },
  ttbReports: {
    read: allRoles,
    write: ["admin", "compliance"],
    delete: ["admin", "compliance"],
  },
  ttbReportApproval: {
    approve: ["admin", "compliance"],
  },
  ttbReportExport: {
    export: ["admin", "compliance"],
  },
  salesOrders: {
    read: allRoles,
    write: ["admin", "sales"],
    delete: ["admin", "sales"],
  },
  clientAttachments: {
    read: allRoles,
    upload: ["admin", "compliance"],
  },
  jobPhotos: {
    read: allRoles,
    upload: ["admin", "distiller", "cellar"],
    delete: ["admin", "distiller", "cellar"],
  },
};

export function isRoleAuthorized(
  role: SafeUser["role"] | undefined,
  resource: PolicyResource,
  action: PolicyAction,
): boolean {
  if (!role) return false;
  const allowedRoles = AUTHORIZATION_POLICY_MATRIX[resource]?.[action];
  if (!allowedRoles || allowedRoles.length === 0) return false;
  return allowedRoles.includes(role);
}
