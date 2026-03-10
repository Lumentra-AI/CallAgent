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

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsOverview {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  total_calls_today: number;
  total_calls_week: number;
  total_calls_month: number;
  total_calls_all_time: number;
  avg_calls_per_tenant_month: number;
  total_users: number;
  new_signups_this_week: number;
  new_signups_this_month: number;
  setup_completion_rate: number;
  active_rate: number;
  top_industries: Array<{ industry: string; count: number }>;
  tier_distribution: Array<{ tier: string; count: number }>;
}

export interface GrowthDataPoint {
  date: string;
  count: number;
}

export interface GrowthData {
  signups: GrowthDataPoint[];
  calls: GrowthDataPoint[];
  active_tenants: GrowthDataPoint[];
}

export interface CallAnalytics {
  total: number;
  by_outcome: Record<string, number>;
  by_industry: Array<{
    industry: string;
    count: number;
    success_rate: number;
  }>;
  by_hour: Array<{ hour: number; count: number }>;
  avg_duration_seconds: number;
  failure_rate: number;
}

export interface TopTenant {
  tenant_id: string;
  business_name: string;
  industry: string;
  metric_value: number;
}

export interface AtRiskTenant {
  tenant_id: string;
  business_name: string;
  industry: string;
  reason: string;
  detail: string;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface SystemHealth {
  api: { status: string; uptime_seconds: number; version: string };
  database: { status: string; latency_ms: number | null };
  background_jobs: {
    scheduled: Array<{ name: string; interval: string }>;
  };
}

export interface ActiveCall {
  call_id: string;
  tenant_id: string;
  business_name: string;
  caller_phone: string | null;
  started_at: string;
  duration_so_far: number;
  status: string;
}

export interface ActiveCallsResponse {
  active_calls: ActiveCall[];
  count: number;
}

export interface PortRequestStats {
  stats: {
    total: number;
    by_status: Record<string, number>;
    avg_completion_days: number | null;
    oldest_pending_days: number | null;
  };
  pending: Array<{
    id: string;
    tenant_id: string;
    business_name: string;
    phone_number: string;
    current_carrier: string;
    status: string;
    days_pending: number;
    submitted_at: string | null;
    created_at: string;
  }>;
}

export interface ErrorStats {
  recent_failures: Array<{
    call_id: string;
    tenant_id: string;
    business_name: string;
    caller_phone: string | null;
    status: string;
    created_at: string;
  }>;
  failure_stats: {
    last_24h: number;
    last_7d: number;
    failure_rate_24h: number;
  };
}

// ============================================================================
// Analytics API Functions
// ============================================================================

export function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  return get<AnalyticsOverview>("/admin/analytics/overview");
}

export function fetchAnalyticsGrowth(
  period: "daily" | "weekly" | "monthly" = "daily",
  range: number = 30,
): Promise<GrowthData> {
  return get<GrowthData>("/admin/analytics/growth", {
    period,
    range: String(range),
  });
}

export function fetchCallAnalytics(days: number = 30): Promise<CallAnalytics> {
  return get<CallAnalytics>("/admin/analytics/calls", {
    days: String(days),
  });
}

export function fetchTopTenants(
  metric: "calls" | "bookings" | "duration" = "calls",
  limit: number = 10,
): Promise<TopTenant[]> {
  return get<TopTenant[]>("/admin/analytics/tenants/top", {
    metric,
    limit: String(limit),
  });
}

export function fetchAtRiskTenants(): Promise<AtRiskTenant[]> {
  return get<AtRiskTenant[]>("/admin/analytics/tenants/at-risk");
}

// ============================================================================
// Monitoring API Functions
// ============================================================================

export function fetchSystemHealth(): Promise<SystemHealth> {
  return get<SystemHealth>("/admin/monitoring/health");
}

export function fetchActiveCalls(): Promise<ActiveCallsResponse> {
  return get<ActiveCallsResponse>("/admin/monitoring/active-calls");
}

export function fetchPortRequestStats(): Promise<PortRequestStats> {
  return get<PortRequestStats>("/admin/monitoring/port-requests");
}

export function fetchErrorStats(): Promise<ErrorStats> {
  return get<ErrorStats>("/admin/monitoring/errors");
}

// ============================================================================
// Feature Overrides (Page Access) Types & Functions
// ============================================================================

export interface FeatureOverride {
  feature_key: string;
  enabled: boolean;
  updated_at?: string;
}

/**
 * GET /admin/tenants/:id/feature-overrides - Get page access overrides
 */
export function fetchFeatureOverrides(
  tenantId: string,
): Promise<{ overrides: FeatureOverride[] }> {
  return get<{ overrides: FeatureOverride[] }>(
    `/admin/tenants/${tenantId}/feature-overrides`,
  );
}

/**
 * PUT /admin/tenants/:id/feature-overrides - Update page access overrides
 */
export function updateFeatureOverrides(
  tenantId: string,
  overrides: Record<string, boolean>,
): Promise<{ success: boolean; overrides: FeatureOverride[] }> {
  return put<{ success: boolean; overrides: FeatureOverride[] }>(
    `/admin/tenants/${tenantId}/feature-overrides`,
    { overrides },
  );
}

// ============================================================================
// Audit Log / Activity Types & Functions
// ============================================================================

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  email?: string | null;
}

/**
 * GET /admin/tenants/:id/activity - Get tenant audit log entries
 */
export function fetchTenantActivity(
  tenantId: string,
  params?: { limit?: number; offset?: number },
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const queryParams: Record<string, string> = {};
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.offset) queryParams.offset = String(params.offset);
  return get<{ logs: AuditLogEntry[]; total: number }>(
    `/admin/tenants/${tenantId}/activity`,
    Object.keys(queryParams).length > 0 ? queryParams : undefined,
  );
}
