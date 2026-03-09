import { apiClient, get, post, put, del } from "./client";

// ============================================================================
// Admin Auth Types
// ============================================================================

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

// ============================================================================
// Tenant Types
// ============================================================================

export type TenantStatus =
  | "draft"
  | "pending_verification"
  | "active"
  | "suspended";

export type TenantTier = "starter" | "professional" | "enterprise";

export interface TenantFeatures {
  sms_confirmations?: boolean;
  email_notifications?: boolean;
  live_transfer?: boolean;
  voicemail_fallback?: boolean;
  sentiment_analysis?: boolean;
  recording_enabled?: boolean;
  transcription_enabled?: boolean;
  [key: string]: boolean | undefined;
}

export interface VoiceConfig {
  provider?: string;
  voice_id?: string;
  voice_name?: string;
  speaking_rate?: number;
  pitch?: number;
}

export interface OperatingHoursSchedule {
  day: number;
  enabled: boolean;
  open_time: string;
  close_time: string;
}

export interface OperatingHours {
  schedule: OperatingHoursSchedule[];
  holidays: string[];
}

export interface AdminTenant {
  id: string;
  business_name: string;
  industry: string;
  phone_number: string;
  contact_email: string | null;
  status: TenantStatus;
  subscription_tier: TenantTier;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  agent_name: string | null;
  agent_personality: Record<string, unknown> | null;
  voice_config: VoiceConfig | null;
  greeting_standard: string | null;
  greeting_after_hours: string | null;
  greeting_returning: string | null;
  timezone: string | null;
  operating_hours: OperatingHours | null;
  escalation_enabled: boolean;
  escalation_phone: string | null;
  escalation_triggers: string[] | null;
  features: TenantFeatures | null;
  custom_instructions: string | null;
  setup_completed: boolean;
  setup_step: string | null;
  location_city: string | null;
  location_address: string | null;
}

export interface AdminTenantListItem extends AdminTenant {
  member_count: string;
  calls_30d: string;
  last_call_at: string | null;
}

export interface AdminTenantMember {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  accepted_at: string | null;
  email: string | null;
}

export interface CallStats {
  total_calls: number;
  calls_this_week: number;
  calls_this_month: number;
  avg_duration: number;
}

export interface RecentCall {
  id: string;
  caller_phone: string | null;
  caller_name: string | null;
  status: string;
  duration_seconds: number | null;
  sentiment_score: number | null;
  created_at: string;
  outcome_type: string | null;
}

export interface PhoneConfig {
  id: string;
  tenant_id: string;
  phone_number: string | null;
  setup_type: string;
  provider_sid: string | null;
  status: string;
  port_request_id: string | null;
  sip_uri?: string | null;
  sip_username?: string | null;
}

export interface PortRequest {
  id: string;
  tenant_id: string;
  phone_number: string;
  current_carrier: string;
  authorized_name: string;
  status: string;
  estimated_completion: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  tenant_count: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface FetchTenantsParams {
  search?: string;
  status?: TenantStatus | "";
  tier?: TenantTier | "";
  industry?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface UpdateTenantData {
  business_name?: string;
  industry?: string;
  contact_email?: string;
  agent_name?: string;
  timezone?: string;
  escalation_enabled?: boolean;
  escalation_phone?: string;
  [key: string]: unknown;
}

// ============================================================================
// Response Types
// ============================================================================

export interface FetchTenantsResponse {
  tenants: AdminTenantListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FetchTenantDetailResponse {
  tenant: AdminTenant;
  members: AdminTenantMember[];
  callStats: CallStats;
  recentCalls: RecentCall[];
  phoneConfig: PhoneConfig | null;
  portRequest: PortRequest | null;
}

export interface StatusChangeResponse {
  success: boolean;
  previousStatus: string;
}

export interface TierChangeResponse {
  success: boolean;
  previousTier: string;
}

export interface FetchUsersResponse {
  users: AdminUser[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * GET /admin/tenants - List all tenants with filtering and pagination
 */
export function fetchAdminTenants(
  params: FetchTenantsParams = {},
): Promise<FetchTenantsResponse> {
  const queryParams: Record<string, string> = {};

  if (params.search) queryParams.search = params.search;
  if (params.status) queryParams.status = params.status;
  if (params.tier) queryParams.tier = params.tier;
  if (params.industry) queryParams.industry = params.industry;
  if (params.sortBy) queryParams.sortBy = params.sortBy;
  if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
  if (params.limit !== undefined) queryParams.limit = String(params.limit);
  if (params.offset !== undefined) queryParams.offset = String(params.offset);

  return get<FetchTenantsResponse>("/admin/tenants", queryParams);
}

/**
 * GET /admin/tenants/:id - Get full tenant details
 */
export function fetchAdminTenant(
  id: string,
): Promise<FetchTenantDetailResponse> {
  return get<FetchTenantDetailResponse>(`/admin/tenants/${id}`);
}

/**
 * PUT /admin/tenants/:id - Update tenant fields
 */
export function updateAdminTenant(
  id: string,
  data: UpdateTenantData,
): Promise<{ tenant: AdminTenant }> {
  return put<{ tenant: AdminTenant }>(`/admin/tenants/${id}`, data);
}

/**
 * POST /admin/tenants/:id/features - Update tenant feature flags
 */
export function updateTenantFeatures(
  id: string,
  features: TenantFeatures,
): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/admin/tenants/${id}/features`, {
    features,
  });
}

/**
 * PUT /admin/tenants/:id/tier - Change tenant tier
 */
export function updateTenantTier(
  id: string,
  tier: TenantTier,
): Promise<TierChangeResponse> {
  return put<TierChangeResponse>(`/admin/tenants/${id}/tier`, { tier });
}

/**
 * PUT /admin/tenants/:id/status - Change tenant status
 */
export function updateTenantStatus(
  id: string,
  status: TenantStatus,
  reason?: string,
): Promise<StatusChangeResponse> {
  return put<StatusChangeResponse>(`/admin/tenants/${id}/status`, {
    status,
    reason,
  });
}

/**
 * DELETE /admin/tenants/:id - Soft-delete tenant
 */
export function deleteAdminTenant(id: string): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/admin/tenants/${id}`);
}

/**
 * GET /admin/users - List all platform users
 */
export function fetchAdminUsers(): Promise<FetchUsersResponse> {
  return get<FetchUsersResponse>("/admin/users");
}
