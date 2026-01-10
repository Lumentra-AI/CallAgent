/**
 * API client exports
 */

// Base client
export {
  apiClient,
  get,
  post,
  put,
  patch,
  del,
  ApiClientError,
  API_BASE,
  type ApiError,
} from "./client";

// Dashboard API
export {
  // Main functions (transformed to frontend format)
  fetchDashboardMetrics,
  fetchActivityLog,
  fetchVoiceSessions,
  checkApiHealth,

  // Raw API functions (original backend format)
  fetchMetricsRaw,
  fetchStatsRaw,
  fetchActivityLogRaw,

  // Transform utilities
  transformMetrics,
  transformLogEntry,

  // Types
  type ApiMetricsResponse,
  type ApiActivityLogEntry,
  type ApiActivityLogResponse,
  type ApiDashboardStats,
  type ApiVoiceSession,
  type ApiVoiceSessionsResponse,
} from "./dashboard";
