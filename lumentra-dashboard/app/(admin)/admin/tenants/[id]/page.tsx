"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Globe,
  History,
  Loader2,
  Mail,
  Mic,
  Phone,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantStatusBadge } from "@/components/admin/TenantStatusBadge";
import { TenantTierBadge } from "@/components/admin/TenantTierBadge";
import { StatusChangeDialog } from "@/components/admin/StatusChangeDialog";
import { TierChangeDialog } from "@/components/admin/TierChangeDialog";
import {
  fetchAdminTenant,
  updateTenantStatus,
  updateTenantTier,
  updateTenantFeatures,
  fetchFeatureOverrides,
  updateFeatureOverrides,
  fetchTenantActivity,
  type AdminTenant,
  type AdminTenantMember,
  type AuditLogEntry,
  type CallStats,
  type FeatureOverride,
  type RecentCall,
  type PhoneConfig,
  type PortRequest,
  type TenantStatus,
  type TenantTier,
  type TenantFeatures,
} from "@/lib/api/admin";

// ============================================================================
// Tab definitions
// ============================================================================

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "configuration", label: "Configuration" },
  { key: "features", label: "Features" },
  { key: "page_access", label: "Page Access" },
  { key: "members", label: "Members" },
  { key: "calls", label: "Calls" },
  { key: "phone", label: "Phone" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatIndustry(industry: string): string {
  return industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sentimentLabel(score: number | null): { text: string; color: string } {
  if (score == null) return { text: "--", color: "text-zinc-400" };
  if (score >= 0.6) return { text: "Positive", color: "text-emerald-600" };
  if (score >= 0.3) return { text: "Neutral", color: "text-zinc-600" };
  return { text: "Negative", color: "text-red-600" };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Default features by tier
const TIER_DEFAULTS: Record<string, TenantFeatures> = {
  starter: {
    sms_confirmations: true,
    email_notifications: false,
    live_transfer: false,
    voicemail_fallback: true,
    sentiment_analysis: false,
    recording_enabled: false,
    transcription_enabled: false,
  },
  professional: {
    sms_confirmations: true,
    email_notifications: true,
    live_transfer: true,
    voicemail_fallback: true,
    sentiment_analysis: true,
    recording_enabled: true,
    transcription_enabled: true,
  },
  enterprise: {
    sms_confirmations: true,
    email_notifications: true,
    live_transfer: true,
    voicemail_fallback: true,
    sentiment_analysis: true,
    recording_enabled: true,
    transcription_enabled: true,
  },
};

const FEATURE_LABELS: Record<string, string> = {
  sms_confirmations: "SMS Confirmations",
  email_notifications: "Email Notifications",
  live_transfer: "Live Transfer",
  voicemail_fallback: "Voicemail Fallback",
  sentiment_analysis: "Sentiment Analysis",
  recording_enabled: "Call Recording",
  transcription_enabled: "Transcription",
};

// Page access feature keys and labels
const PAGE_FEATURE_KEYS = [
  "dashboard",
  "workstation",
  "calls",
  "analytics",
  "calendar",
  "contacts",
  "deals",
  "tasks",
  "chats",
  "escalations",
  "pending",
  "resources",
  "notifications",
] as const;

const PAGE_FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  workstation: "Workstation",
  calls: "Calls",
  analytics: "Analytics",
  calendar: "Calendar",
  contacts: "Contacts",
  deals: "Deals",
  tasks: "Tasks",
  chats: "Chats",
  escalations: "Escalations",
  pending: "Pending Bookings",
  resources: "Resources",
  notifications: "Notifications",
};

const PAGE_TIER_DEFAULTS: Record<string, string[]> = {
  starter: [
    "dashboard",
    "workstation",
    "calls",
    "contacts",
    "calendar",
    "escalations",
  ],
  professional: [
    "dashboard",
    "workstation",
    "calls",
    "contacts",
    "calendar",
    "escalations",
    "analytics",
    "deals",
    "tasks",
    "chats",
    "resources",
    "notifications",
    "pending",
  ],
  enterprise: [
    "dashboard",
    "workstation",
    "calls",
    "contacts",
    "calendar",
    "escalations",
    "analytics",
    "deals",
    "tasks",
    "chats",
    "resources",
    "notifications",
    "pending",
  ],
};

// ============================================================================
// Main Page Component
// ============================================================================

export default function AdminTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tenantId = params.id;

  // Data state
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [members, setMembers] = useState<AdminTenantMember[]>([]);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [phoneConfig, setPhoneConfig] = useState<PhoneConfig | null>(null);
  const [portRequest, setPortRequest] = useState<PortRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);

  // Feature toggle state
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Page access state
  const [pageOverrides, setPageOverrides] = useState<FeatureOverride[]>([]);
  const [pageOverridesLoading, setPageOverridesLoading] = useState(false);
  const [pageOverridesError, setPageOverridesError] = useState<string | null>(
    null,
  );
  const [savingPageOverrides, setSavingPageOverrides] = useState(false);

  // Activity state
  const [activityLogs, setActivityLogs] = useState<AuditLogEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityOffset, setActivityOffset] = useState(0);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const ACTIVITY_PAGE_SIZE = 25;

  const loadTenant = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAdminTenant(tenantId);
      setTenant(result.tenant);
      setMembers(result.members);
      setCallStats(result.callStats);
      setRecentCalls(result.recentCalls);
      setPhoneConfig(result.phoneConfig);
      setPortRequest(result.portRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenant");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  // Status change handler
  const handleStatusChange = useCallback(
    async (newStatus: TenantStatus, reason?: string) => {
      if (!tenantId) return;
      await updateTenantStatus(tenantId, newStatus, reason);
      // Reload to get fresh state
      await loadTenant();
    },
    [tenantId, loadTenant],
  );

  // Tier change handler
  const handleTierChange = useCallback(
    async (newTier: TenantTier) => {
      if (!tenantId) return;
      await updateTenantTier(tenantId, newTier);
      await loadTenant();
    },
    [tenantId, loadTenant],
  );

  // Feature toggle handler
  const handleFeatureToggle = useCallback(
    async (featureKey: string, enabled: boolean) => {
      if (!tenant) return;

      const updatedFeatures: TenantFeatures = {
        ...tenant.features,
        [featureKey]: enabled,
      };

      // Optimistic update
      setTenant((prev) =>
        prev ? { ...prev, features: updatedFeatures } : prev,
      );

      setSavingFeatures(true);
      try {
        await updateTenantFeatures(tenant.id, updatedFeatures);
      } catch {
        // Revert on error
        await loadTenant();
      } finally {
        setSavingFeatures(false);
      }
    },
    [tenant, loadTenant],
  );

  // Reset features to tier defaults
  const handleResetFeatures = useCallback(async () => {
    if (!tenant) return;
    const defaults = TIER_DEFAULTS[tenant.subscription_tier];
    if (!defaults) return;

    setSavingFeatures(true);
    try {
      await updateTenantFeatures(tenant.id, defaults);
      setTenant((prev) => (prev ? { ...prev, features: defaults } : prev));
    } catch {
      await loadTenant();
    } finally {
      setSavingFeatures(false);
    }
  }, [tenant, loadTenant]);

  // Page access: load overrides when tab is selected
  const loadPageOverrides = useCallback(async () => {
    if (!tenantId) return;
    setPageOverridesLoading(true);
    setPageOverridesError(null);
    try {
      const result = await fetchFeatureOverrides(tenantId);
      setPageOverrides(result.overrides);
    } catch (err) {
      setPageOverridesError(
        err instanceof Error ? err.message : "Failed to load page overrides",
      );
    } finally {
      setPageOverridesLoading(false);
    }
  }, [tenantId]);

  // Page access: toggle a page feature
  const handlePageOverrideToggle = useCallback(
    async (featureKey: string, enabled: boolean) => {
      if (!tenant) return;

      // Build full overrides map from current state
      const overridesMap: Record<string, boolean> = {};
      for (const ov of pageOverrides) {
        overridesMap[ov.feature_key] = ov.enabled;
      }
      overridesMap[featureKey] = enabled;

      // Optimistic update
      setPageOverrides((prev) => {
        const existing = prev.find((o) => o.feature_key === featureKey);
        if (existing) {
          return prev.map((o) =>
            o.feature_key === featureKey ? { ...o, enabled } : o,
          );
        }
        return [...prev, { feature_key: featureKey, enabled }];
      });

      setSavingPageOverrides(true);
      try {
        const result = await updateFeatureOverrides(tenant.id, overridesMap);
        setPageOverrides(result.overrides);
      } catch {
        // Revert on error
        await loadPageOverrides();
      } finally {
        setSavingPageOverrides(false);
      }
    },
    [tenant, pageOverrides, loadPageOverrides],
  );

  // Page access: clear all overrides (reset to tier defaults)
  const handleClearPageOverrides = useCallback(async () => {
    if (!tenant) return;
    setSavingPageOverrides(true);
    try {
      const result = await updateFeatureOverrides(tenant.id, {});
      setPageOverrides(result.overrides);
    } catch {
      await loadPageOverrides();
    } finally {
      setSavingPageOverrides(false);
    }
  }, [tenant, loadPageOverrides]);

  // Activity: load logs
  const loadActivityLogs = useCallback(
    async (offset: number = 0) => {
      if (!tenantId) return;
      setActivityLoading(true);
      setActivityError(null);
      try {
        const result = await fetchTenantActivity(tenantId, {
          limit: ACTIVITY_PAGE_SIZE,
          offset,
        });
        if (offset === 0) {
          setActivityLogs(result.logs);
        } else {
          setActivityLogs((prev) => [...prev, ...result.logs]);
        }
        setActivityTotal(result.total);
        setActivityOffset(offset);
      } catch (err) {
        setActivityError(
          err instanceof Error ? err.message : "Failed to load activity",
        );
      } finally {
        setActivityLoading(false);
      }
    },
    [tenantId],
  );

  // Load tab-specific data when switching tabs
  useEffect(() => {
    if (
      activeTab === "page_access" &&
      pageOverrides.length === 0 &&
      !pageOverridesLoading
    ) {
      void loadPageOverrides();
    }
    if (
      activeTab === "activity" &&
      activityLogs.length === 0 &&
      !activityLoading
    ) {
      void loadActivityLogs(0);
    }
  }, [
    activeTab,
    pageOverrides.length,
    pageOverridesLoading,
    loadPageOverrides,
    activityLogs.length,
    activityLoading,
    loadActivityLogs,
  ]);

  // ============================================================================
  // Loading / Error states
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading tenant details...</span>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-md py-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">
            {error || "Tenant not found"}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/tenants")}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
            >
              Back to list
            </button>
            <button
              type="button"
              onClick={() => void loadTenant()}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  function renderOverviewTab() {
    if (!tenant || !callStats) return null;

    return (
      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Calls",
              value: callStats.total_calls.toLocaleString(),
            },
            {
              label: "This Month",
              value: callStats.calls_this_month.toLocaleString(),
            },
            {
              label: "Avg Duration",
              value: formatDuration(callStats.avg_duration),
            },
            {
              label: "Members",
              value: members.length.toString(),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Business info card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Business Info
            </h3>
            <div className="mt-4 space-y-3">
              <InfoRow label="Business Name" value={tenant.business_name} />
              <InfoRow
                label="Industry"
                value={formatIndustry(tenant.industry)}
              />
              <InfoRow
                label="Contact Email"
                value={tenant.contact_email || "--"}
                icon={<Mail className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="Phone"
                value={
                  tenant.phone_number.startsWith("pending_")
                    ? "Not configured"
                    : tenant.phone_number
                }
                icon={<Phone className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="Timezone"
                value={tenant.timezone || "Not set"}
                icon={<Globe className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="Location"
                value={
                  [tenant.location_city, tenant.location_address]
                    .filter(Boolean)
                    .join(", ") || "--"
                }
              />
              <InfoRow
                label="Created"
                value={formatDate(tenant.created_at)}
                icon={<Calendar className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="Setup Completed"
                value={tenant.setup_completed ? "Yes" : "No"}
              />
            </div>
          </div>

          {/* Status + Tier cards */}
          <div className="space-y-4">
            {/* Status card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Status
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <TenantStatusBadge status={tenant.status} />
                <button
                  type="button"
                  onClick={() => setStatusDialogOpen(true)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50"
                >
                  Change
                </button>
              </div>
              {!tenant.is_active && tenant.status !== "suspended" && (
                <p className="mt-2 text-xs text-amber-600">
                  Tenant is inactive (is_active=false)
                </p>
              )}
            </div>

            {/* Tier card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Subscription Tier
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <TenantTierBadge tier={tenant.subscription_tier} />
                <button
                  type="button"
                  onClick={() => setTierDialogOpen(true)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Escalation card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Escalation
              </h3>
              <div className="mt-3 space-y-2">
                <InfoRow
                  label="Enabled"
                  value={tenant.escalation_enabled ? "Yes" : "No"}
                />
                <InfoRow
                  label="Phone"
                  value={tenant.escalation_phone || "Not set"}
                />
                {tenant.escalation_triggers &&
                  tenant.escalation_triggers.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="w-28 shrink-0 text-xs text-zinc-500">
                        Triggers
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {tenant.escalation_triggers.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderConfigurationTab() {
    if (!tenant) return null;

    const voiceConfig = tenant.voice_config;
    const operatingHours = tenant.operating_hours;

    return (
      <div className="space-y-6">
        {/* Agent config */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Agent Configuration
          </h3>
          <div className="mt-4 space-y-3">
            <InfoRow
              label="Agent Name"
              value={tenant.agent_name || "AI Assistant"}
              icon={<Mic className="h-3.5 w-3.5" />}
            />
            {voiceConfig && (
              <>
                <InfoRow
                  label="Voice Provider"
                  value={voiceConfig.provider || "--"}
                />
                <InfoRow
                  label="Voice Name"
                  value={voiceConfig.voice_name || "--"}
                />
                <InfoRow
                  label="Voice ID"
                  value={voiceConfig.voice_id || "--"}
                />
                <InfoRow
                  label="Speaking Rate"
                  value={String(voiceConfig.speaking_rate ?? 1.0)}
                />
              </>
            )}
          </div>
        </div>

        {/* Greetings */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Greetings
          </h3>
          <div className="mt-4 space-y-4">
            <GreetingBlock label="Standard" text={tenant.greeting_standard} />
            <GreetingBlock
              label="After Hours"
              text={tenant.greeting_after_hours}
            />
            <GreetingBlock
              label="Returning Caller"
              text={tenant.greeting_returning}
            />
          </div>
        </div>

        {/* Operating hours */}
        {operatingHours?.schedule && operatingHours.schedule.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Operating Hours
            </h3>
            <div className="mt-4 space-y-2">
              {operatingHours.schedule.map((slot) => (
                <div key={slot.day} className="flex items-center gap-3 text-sm">
                  <span className="w-10 font-medium text-zinc-700">
                    {DAY_NAMES[slot.day]}
                  </span>
                  {slot.enabled ? (
                    <span className="text-zinc-600">
                      {slot.open_time} - {slot.close_time}
                    </span>
                  ) : (
                    <span className="text-zinc-400">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom instructions */}
        {tenant.custom_instructions && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Custom Instructions
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
              {tenant.custom_instructions}
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderFeaturesTab() {
    if (!tenant) return null;

    const features = tenant.features || {};
    const tierDefaults = TIER_DEFAULTS[tenant.subscription_tier] || {};

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Feature Flags
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Toggle features for this tenant. Overrides are highlighted.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFeatures}
            disabled={savingFeatures}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {savingFeatures && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Reset to Tier Defaults
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const isEnabled = !!features[key];
            const tierDefault = !!tierDefaults[key];
            const isOverride = isEnabled !== tierDefault;

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-4",
                  isOverride
                    ? "border-blue-200 bg-blue-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{label}</p>
                  {isOverride && (
                    <p className="mt-0.5 text-xs text-blue-600">
                      Custom override (tier default:{" "}
                      {tierDefault ? "on" : "off"})
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`Toggle ${label}`}
                  onClick={() => handleFeatureToggle(key, !isEnabled)}
                  disabled={savingFeatures}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                    isEnabled ? "bg-emerald-500" : "bg-zinc-300",
                    savingFeatures && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200",
                      isEnabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderMembersTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">
            Team Members ({members.length})
          </h3>
        </div>

        {members.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Accepted</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-t border-zinc-100 text-zinc-700"
                  >
                    <td className="px-4 py-3">
                      {member.email || member.user_id.slice(0, 8) + "..."}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-600">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(member.accepted_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(member.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderCallsTab() {
    if (!callStats) return null;

    return (
      <div className="space-y-6">
        {/* Call stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total",
              value: callStats.total_calls.toLocaleString(),
            },
            {
              label: "This Week",
              value: callStats.calls_this_week.toLocaleString(),
            },
            {
              label: "This Month",
              value: callStats.calls_this_month.toLocaleString(),
            },
            {
              label: "Avg Duration",
              value: formatDuration(callStats.avg_duration),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Recent calls */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">
            Recent Calls (last 10)
          </h3>

          {recentCalls.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-zinc-500">No calls recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Caller</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Sentiment</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCalls.map((call) => {
                    const sentiment = sentimentLabel(call.sentiment_score);
                    return (
                      <tr
                        key={call.id}
                        className="border-t border-zinc-100 text-zinc-700"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                          {formatDateTime(call.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {call.caller_name || call.caller_phone || "--"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatDuration(call.duration_seconds)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                              call.status === "completed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : call.status === "failed"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-600",
                            )}
                          >
                            {call.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-600">
                          {call.outcome_type?.replace(/_/g, " ") || "--"}
                        </td>
                        <td className={cn("px-4 py-3", sentiment.color)}>
                          {sentiment.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderPageAccessTab() {
    if (!tenant) return null;

    const tierDefaults = PAGE_TIER_DEFAULTS[tenant.subscription_tier] || [];

    // Build overrides lookup
    const overridesMap = new Map<string, boolean>();
    for (const ov of pageOverrides) {
      overridesMap.set(ov.feature_key, ov.enabled);
    }

    if (pageOverridesLoading && pageOverrides.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading page access settings...</span>
          </div>
        </div>
      );
    }

    if (pageOverridesError) {
      return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{pageOverridesError}</p>
          <button
            type="button"
            onClick={() => void loadPageOverrides()}
            className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
          >
            Retry
          </button>
        </div>
      );
    }

    const hasOverrides = overridesMap.size > 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-900">
                Page Access
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Control which dashboard pages are visible for this tenant.
              Overrides apply on top of the{" "}
              <span className="font-medium text-zinc-700">
                {tenant.subscription_tier}
              </span>{" "}
              tier defaults.
            </p>
          </div>
          {hasOverrides && (
            <button
              type="button"
              onClick={handleClearPageOverrides}
              disabled={savingPageOverrides}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              {savingPageOverrides && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Clear All Overrides
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PAGE_FEATURE_KEYS.map((key) => {
            const label = PAGE_FEATURE_LABELS[key];
            const tierDefault = tierDefaults.includes(key);
            const hasOverride = overridesMap.has(key);
            const effectiveEnabled = hasOverride
              ? overridesMap.get(key)!
              : tierDefault;
            const isOverride =
              hasOverride && overridesMap.get(key) !== tierDefault;

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-4",
                  isOverride
                    ? "border-blue-200 bg-blue-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{label}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      Tier: {tierDefault ? "included" : "not included"}
                    </span>
                    {isOverride && (
                      <span className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                        Override
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={effectiveEnabled}
                  aria-label={`Toggle ${label}`}
                  onClick={() =>
                    handlePageOverrideToggle(key, !effectiveEnabled)
                  }
                  disabled={savingPageOverrides}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                    effectiveEnabled ? "bg-emerald-500" : "bg-zinc-300",
                    savingPageOverrides && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200",
                      effectiveEnabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderActivityTab() {
    if (activityLoading && activityLogs.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading activity log...</span>
          </div>
        </div>
      );
    }

    if (activityError) {
      return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{activityError}</p>
          <button
            type="button"
            onClick={() => void loadActivityLogs(0)}
            className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
          >
            Retry
          </button>
        </div>
      );
    }

    const hasMore = activityLogs.length < activityTotal;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">
              Activity Log
            </h3>
            {activityTotal > 0 && (
              <span className="text-xs text-zinc-500">
                ({activityTotal} total)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadActivityLogs(0)}
            disabled={activityLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {activityLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Refresh
          </button>
        </div>

        {activityLogs.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No activity recorded yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="w-8 px-3 py-3" />
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Resource ID</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => {
                    const isExpanded = expandedLogIds.has(log.id);
                    const hasDetails = !!(
                      (log.old_values &&
                        Object.keys(log.old_values).length > 0) ||
                      (log.new_values && Object.keys(log.new_values).length > 0)
                    );

                    return (
                      <ActivityLogRow
                        key={log.id}
                        log={log}
                        isExpanded={isExpanded}
                        hasDetails={hasDetails}
                        onToggle={() => {
                          setExpandedLogIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(log.id)) {
                              next.delete(log.id);
                            } else {
                              next.add(log.id);
                            }
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    void loadActivityLogs(activityOffset + ACTIVITY_PAGE_SIZE)
                  }
                  disabled={activityLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  {activityLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Load more ({activityLogs.length} of {activityTotal})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderPhoneTab() {
    if (!tenant) return null;

    return (
      <div className="space-y-6">
        {/* Current phone */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Phone Number
          </h3>
          <div className="mt-3 space-y-3">
            <InfoRow
              label="Number"
              value={
                tenant.phone_number.startsWith("pending_")
                  ? "Not configured"
                  : tenant.phone_number
              }
              icon={<Phone className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        {/* Phone config */}
        {phoneConfig && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Phone Configuration
            </h3>
            <div className="mt-3 space-y-3">
              <InfoRow label="Setup Type" value={phoneConfig.setup_type} />
              <InfoRow label="Status" value={phoneConfig.status} />
              <InfoRow
                label="Provider SID"
                value={phoneConfig.provider_sid || "--"}
              />
              {phoneConfig.sip_uri && (
                <InfoRow label="SIP URI" value={phoneConfig.sip_uri} />
              )}
            </div>
          </div>
        )}

        {/* Port request */}
        {portRequest && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Port Request
            </h3>
            <div className="mt-3 space-y-3">
              <InfoRow label="Number" value={portRequest.phone_number} />
              <InfoRow label="Carrier" value={portRequest.current_carrier} />
              <InfoRow label="Status" value={portRequest.status} />
              <InfoRow
                label="Authorized Name"
                value={portRequest.authorized_name}
              />
              <InfoRow
                label="Submitted"
                value={formatDate(portRequest.submitted_at)}
              />
              <InfoRow
                label="Estimated Completion"
                value={formatDate(portRequest.estimated_completion)}
              />
              {portRequest.rejection_reason && (
                <InfoRow
                  label="Rejection Reason"
                  value={portRequest.rejection_reason}
                />
              )}
            </div>
          </div>
        )}

        {!phoneConfig && !portRequest && (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">
              No phone configuration or port request found.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    overview: renderOverviewTab,
    configuration: renderConfigurationTab,
    features: renderFeaturesTab,
    page_access: renderPageAccessTab,
    members: renderMembersTab,
    calls: renderCallsTab,
    phone: renderPhoneTab,
    activity: renderActivityTab,
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/admin/tenants")}
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
            aria-label="Back to tenants"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950">
              {tenant.business_name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <TenantStatusBadge status={tenant.status} />
              <TenantTierBadge tier={tenant.subscription_tier} />
              <span className="text-xs text-zinc-400">
                {tenant.id.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadTenant()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
          aria-label="Refresh tenant details"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition",
              activeTab === tab.key
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{tabContent[activeTab]()}</div>

      {/* Dialogs */}
      <StatusChangeDialog
        isOpen={statusDialogOpen}
        currentStatus={tenant.status}
        tenantName={tenant.business_name}
        onClose={() => setStatusDialogOpen(false)}
        onConfirm={handleStatusChange}
      />
      <TierChangeDialog
        isOpen={tierDialogOpen}
        currentTier={tenant.subscription_tier}
        tenantName={tenant.business_name}
        onClose={() => setTierDialogOpen(false)}
        onConfirm={handleTierChange}
      />
    </div>
  );
}

// ============================================================================
// Shared sub-components
// ============================================================================

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-32 shrink-0 text-xs text-zinc-500">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <span className="text-zinc-900">{value}</span>
      </div>
    </div>
  );
}

function GreetingBlock({
  label,
  text,
}: {
  label: string;
  text: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
        {text || "Not configured"}
      </p>
    </div>
  );
}

function formatActionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatResourceType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ActivityLogRow({
  log,
  isExpanded,
  hasDetails,
  onToggle,
}: {
  log: AuditLogEntry;
  isExpanded: boolean;
  hasDetails: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-t border-zinc-100 text-zinc-700",
          hasDetails && "cursor-pointer hover:bg-zinc-50",
        )}
        onClick={hasDetails ? onToggle : undefined}
      >
        <td className="px-3 py-3">
          {hasDetails && (
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-600"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              tabIndex={-1}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
          {new Date(log.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {log.email ||
            (log.user_id ? log.user_id.slice(0, 8) + "..." : "System")}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {formatActionLabel(log.action)}
          </span>
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {formatResourceType(log.resource_type)}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
          {log.resource_id ? log.resource_id.slice(0, 8) + "..." : "--"}
        </td>
      </tr>
      {isExpanded && hasDetails && (
        <tr className="border-t border-zinc-50">
          <td colSpan={6} className="bg-zinc-50 px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {log.old_values && Object.keys(log.old_values).length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Previous Values
                  </p>
                  <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                    {JSON.stringify(log.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_values && Object.keys(log.new_values).length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    New Values
                  </p>
                  <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                    {JSON.stringify(log.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
