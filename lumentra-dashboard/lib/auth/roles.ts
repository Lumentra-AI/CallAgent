import type { UserRole } from "@/types";

export function mapTenantRoleToUserRole(
  role: string | null | undefined,
): UserRole {
  switch (role) {
    case "owner":
    case "admin":
      return "admin";
    case "member":
    case "readonly":
    default:
      return "staff";
  }
}
