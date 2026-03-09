import { apiClient } from "./client";

export interface AdminMeResponse {
  isPlatformAdmin: boolean;
  authMethod: "jwt" | "internal_api_key";
  user: {
    id: string;
    email: string | null;
  } | null;
}

export function fetchAdminMe(): Promise<AdminMeResponse> {
  return apiClient<AdminMeResponse>("/admin/me", { method: "GET" });
}
