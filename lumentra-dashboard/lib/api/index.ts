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
  getTenantId,
  setTenantId,
  clearTenantId,
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

// Contacts API
export {
  searchContacts,
  lookupByPhone,
  lookupByEmail,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  findOrCreateByPhone,
  updateContactStatus,
  updateContactTags,
  bulkAddTag,
  getContactNotes,
  addContactNote,
  getContactHistory,
  getContactBookings,
  getContactCalls,
  importContacts,
  exportContacts,
  mergeContacts,
  recalculateEngagementScore,
} from "./contacts";

// Calendar API
export {
  listBookings,
  getUpcomingBookings,
  getCalendarEvents,
  getDaySummary,
  getBooking,
  createBooking,
  updateBooking,
  cancelBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  cancelBookingWithReason,
  rescheduleBooking,
  getAvailableSlots,
  getAvailableSlotsForRange,
  checkAvailability,
  createSlot,
  updateSlot,
  blockSlot,
  unblockSlot,
  deleteSlot,
  generateSlots,
  getDateRangeForView,
  navigateCalendar,
} from "./calendar";

// Notifications API
export {
  listNotifications,
  getNotification,
  sendNotification,
  previewNotification,
  listTemplates,
  createTemplate,
  updateTemplate,
  getPreferences,
  updatePreferences,
  processQueue,
  getNotificationTypeLabel,
  getNotificationStatusInfo,
  getChannelIcon,
} from "./notifications";

// Resources API
export {
  listResources,
  getActiveResources,
  getBookableResources,
  getResourcesByType,
  getResource,
  createResource,
  updateResource,
  patchResource,
  deleteResource,
  getResourceAvailability,
  reorderResources,
  getResourceTypeLabel,
  getResourceTypeIcon,
  getResourceTypeColor,
  formatDuration,
} from "./resources";
