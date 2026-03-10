"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Phone,
  RefreshCw,
  Server,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchSystemHealth,
  fetchActiveCalls,
  fetchPortRequestStats,
  fetchErrorStats,
  type SystemHealth,
  type ActiveCallsResponse,
  type PortRequestStats,
  type ErrorStats,
} from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d > 0 ? `${d}d` : "", h > 0 ? `${h}h` : "", `${m}m`]
    .filter(Boolean)
    .join(" ");
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "Unknown";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `***${digits.slice(-4)}`;
}

type StatusColor = "green" | "amber" | "red";

function statusColor(status: string): StatusColor {
  if (status === "healthy") return "green";
  if (status === "degraded") return "amber";
  return "red";
}

function StatusDot({ color }: { color: StatusColor }) {
  const colorClasses: Record<StatusColor, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40",
          colorClasses[color],
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          colorClasses[color],
        )}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-zinc-200" />
        <div className="h-6 w-32 rounded bg-zinc-200" />
        <div className="h-3 w-48 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function SkeletonTable({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          <div className="h-4 w-28 rounded bg-zinc-200" />
          <div className="h-4 w-36 rounded bg-zinc-200" />
          <div className="h-4 w-20 rounded bg-zinc-200" />
          <div className="h-4 w-16 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Port request status tabs
// ---------------------------------------------------------------------------

const PORT_STATUS_TABS = [
  "all",
  "draft",
  "submitted",
  "pending",
  "approved",
] as const;
type PortStatusFilter = (typeof PORT_STATUS_TABS)[number];

const PORT_STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  submitted: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function AdminOperationsPage() {
  // Data state
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [calls, setCalls] = useState<ActiveCallsResponse | null>(null);
  const [portStats, setPortStats] = useState<PortRequestStats | null>(null);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);

  // Loading state
  const [healthLoading, setHealthLoading] = useState(true);
  const [callsLoading, setCallsLoading] = useState(true);
  const [portLoading, setPortLoading] = useState(true);
  const [errorsLoading, setErrorsLoading] = useState(true);

  // Error state
  const [healthError, setHealthError] = useState<string | null>(null);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [portError, setPortError] = useState<string | null>(null);
  const [errorsError, setErrorsError] = useState<string | null>(null);

  // UI state
  const [jobsExpanded, setJobsExpanded] = useState(false);
  const [portFilter, setPortFilter] = useState<PortStatusFilter>("all");

  // Live duration counters for active calls
  const [tick, setTick] = useState(0);

  // Refs for intervals
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch functions
  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchSystemHealth();
      setHealth(data);
      setHealthError(null);
    } catch (err) {
      setHealthError(
        err instanceof Error ? err.message : "Failed to load health",
      );
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadCalls = useCallback(async () => {
    try {
      const data = await fetchActiveCalls();
      setCalls(data);
      setCallsError(null);
    } catch (err) {
      setCallsError(
        err instanceof Error ? err.message : "Failed to load active calls",
      );
    } finally {
      setCallsLoading(false);
    }
  }, []);

  const loadPortStats = useCallback(async () => {
    try {
      const data = await fetchPortRequestStats();
      setPortStats(data);
      setPortError(null);
    } catch (err) {
      setPortError(
        err instanceof Error ? err.message : "Failed to load port requests",
      );
    } finally {
      setPortLoading(false);
    }
  }, []);

  const loadErrors = useCallback(async () => {
    try {
      const data = await fetchErrorStats();
      setErrorStats(data);
      setErrorsError(null);
    } catch (err) {
      setErrorsError(
        err instanceof Error ? err.message : "Failed to load error stats",
      );
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    void loadHealth();
    void loadCalls();
    void loadPortStats();
    void loadErrors();
  }, [loadHealth, loadCalls, loadPortStats, loadErrors]);

  // Initial load
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh: health every 30s, calls every 10s
  useEffect(() => {
    healthIntervalRef.current = setInterval(() => {
      void loadHealth();
    }, 30_000);

    callsIntervalRef.current = setInterval(() => {
      void loadCalls();
    }, 10_000);

    // Tick for live call duration counter every second
    tickIntervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
      if (callsIntervalRef.current) clearInterval(callsIntervalRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [loadHealth, loadCalls]);

  // Computed: filtered port requests
  const filteredPorts =
    portStats?.pending.filter((p) =>
      portFilter === "all" ? true : p.status === portFilter,
    ) ?? [];

  // Computed: failure rate color
  const failureRate = errorStats?.failure_stats.failure_rate_24h ?? 0;
  const failureRateColor =
    failureRate > 10
      ? "text-red-700 bg-red-50"
      : failureRate > 5
        ? "text-amber-700 bg-amber-50"
        : "text-emerald-700 bg-emerald-50";

  // Suppress unused tick warning -- tick drives re-render for live duration display
  void tick;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-zinc-400" />
            <h1 className="text-2xl font-semibold text-zinc-950">Operations</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            System health, active calls, port requests, and error monitoring.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
          aria-label="Refresh all operations data"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              healthLoading || callsLoading ? "animate-spin" : "",
            )}
          />
          Refresh
        </button>
      </div>

      {/* Top row: System Health + Active Calls */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* System Health Card */}
        {healthLoading && !health ? (
          <SkeletonCard className="min-h-[180px]" />
        ) : healthError && !health ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-800">
              System health unavailable
            </p>
            <p className="mt-1 text-sm text-red-600">{healthError}</p>
            <button
              type="button"
              onClick={() => void loadHealth()}
              className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : health ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                System Health
              </h2>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* API status */}
              <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                <StatusDot color={statusColor(health.api.status)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">API</p>
                  <p className="text-xs text-zinc-500">
                    {formatUptime(health.api.uptime_seconds)} uptime
                    <span className="mx-1.5 text-zinc-300">|</span>v
                    {health.api.version}
                  </p>
                </div>
              </div>

              {/* Database status */}
              <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                <StatusDot color={statusColor(health.database.status)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">Database</p>
                  <p className="text-xs text-zinc-500">
                    {health.database.latency_ms !== null
                      ? `${health.database.latency_ms}ms latency`
                      : "Latency unavailable"}
                  </p>
                </div>
              </div>
            </div>

            {/* Background jobs */}
            {health.background_jobs.scheduled.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setJobsExpanded((prev) => !prev)}
                  className="flex items-center gap-1.5 text-sm text-zinc-600 transition hover:text-zinc-900"
                  aria-expanded={jobsExpanded}
                  aria-controls="background-jobs-list"
                >
                  {jobsExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>
                    Background Jobs ({health.background_jobs.scheduled.length})
                  </span>
                </button>

                {jobsExpanded && (
                  <ul
                    id="background-jobs-list"
                    className="mt-2 space-y-1.5 pl-5"
                    role="list"
                  >
                    {health.background_jobs.scheduled.map((job) => (
                      <li
                        key={job.name}
                        className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-zinc-800">
                          {job.name}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {job.interval}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Active Calls Card */}
        {callsLoading && !calls ? (
          <SkeletonCard className="min-h-[180px]" />
        ) : callsError && !calls ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-800">
              Active calls unavailable
            </p>
            <p className="mt-1 text-sm text-red-600">{callsError}</p>
            <button
              type="button"
              onClick={() => void loadCalls()}
              className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : calls ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Active Calls
              </h2>
              {calls.count > 0 && (
                <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {calls.count} live
                </span>
              )}
            </div>

            {calls.active_calls.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center py-6">
                <Phone className="h-8 w-8 text-zinc-200" />
                <p className="mt-2 text-sm text-zinc-400">No active calls</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {calls.active_calls.map((call) => {
                  const liveDuration = Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(call.started_at).getTime()) / 1000,
                    ),
                  );

                  return (
                    <div
                      key={call.call_id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5"
                    >
                      <Activity className="h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {call.business_name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {maskPhone(call.caller_phone)}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-700">
                        {formatDuration(liveDuration)}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          call.status === "active" ||
                            call.status === "in_progress"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {call.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Port Requests Section */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-950">
              Port Requests
            </h2>
          </div>
        </div>

        {portLoading && !portStats ? (
          <div className="mt-4">
            <div className="animate-pulse">
              <div className="flex gap-4">
                <div className="h-16 flex-1 rounded-xl bg-zinc-100" />
                <div className="h-16 flex-1 rounded-xl bg-zinc-100" />
                <div className="h-16 flex-1 rounded-xl bg-zinc-100" />
              </div>
              <div className="mt-4">
                <SkeletonTable rows={3} />
              </div>
            </div>
          </div>
        ) : portError && !portStats ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-800">
              Port request data unavailable
            </p>
            <p className="mt-1 text-sm text-red-600">{portError}</p>
            <button
              type="button"
              onClick={() => void loadPortStats()}
              className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : portStats ? (
          <>
            {/* Stats row */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Total Ports
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {portStats.stats.total}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Avg Completion
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {portStats.stats.avg_completion_days !== null
                    ? `${portStats.stats.avg_completion_days}d`
                    : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Oldest Pending
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {portStats.stats.oldest_pending_days !== null
                    ? `${portStats.stats.oldest_pending_days}d`
                    : "--"}
                </p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="mt-4 flex gap-1.5 overflow-x-auto" role="tablist">
              {PORT_STATUS_TABS.map((tab) => {
                const count =
                  tab === "all"
                    ? portStats.pending.length
                    : portStats.pending.filter((p) => p.status === tab).length;

                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={portFilter === tab}
                    onClick={() => setPortFilter(tab)}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium capitalize transition",
                      portFilter === tab
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                    )}
                  >
                    {tab}
                    {count > 0 && (
                      <span
                        className={cn(
                          "ml-1.5 inline-block rounded-full px-1.5 text-xs",
                          portFilter === tab
                            ? "bg-zinc-700 text-zinc-200"
                            : "bg-zinc-200 text-zinc-500",
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Port requests table */}
            {filteredPorts.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center py-8">
                <Wrench className="h-8 w-8 text-zinc-200" />
                <p className="mt-2 text-sm text-zinc-400">
                  No pending port requests
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        <th className="px-4 py-3">Phone Number</th>
                        <th className="px-4 py-3">Business</th>
                        <th className="px-4 py-3">Carrier</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Days Pending</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredPorts.map((port) => (
                        <tr
                          key={port.id}
                          className="transition hover:bg-zinc-50"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-900">
                            {port.phone_number}
                          </td>
                          <td className="px-4 py-3 text-zinc-800">
                            {port.business_name}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {port.current_carrier}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                PORT_STATUS_BADGE[port.status] ??
                                  "bg-zinc-100 text-zinc-600",
                              )}
                            >
                              {port.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-zinc-700">
                            {port.days_pending}d
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                            {port.submitted_at
                              ? formatRelativeTime(port.submitted_at)
                              : formatRelativeTime(port.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/tenants/${port.tenant_id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-900"
                              title="View tenant details"
                            >
                              View Tenant
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* Recent Errors Section */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-950">Recent Errors</h2>
        </div>

        {errorsLoading && !errorStats ? (
          <div className="mt-4 animate-pulse">
            <div className="flex gap-3">
              <div className="h-8 w-32 rounded-full bg-zinc-100" />
              <div className="h-8 w-32 rounded-full bg-zinc-100" />
              <div className="h-8 w-32 rounded-full bg-zinc-100" />
            </div>
            <div className="mt-4">
              <SkeletonTable rows={3} />
            </div>
          </div>
        ) : errorsError && !errorStats ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-800">
              Error stats unavailable
            </p>
            <p className="mt-1 text-sm text-red-600">{errorsError}</p>
            <button
              type="button"
              onClick={() => void loadErrors()}
              className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : errorStats ? (
          <>
            {/* Failure stats badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700">
                {errorStats.failure_stats.last_24h} failures (24h)
              </span>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700">
                {errorStats.failure_stats.last_7d} failures (7d)
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium",
                  failureRateColor,
                )}
              >
                {failureRate.toFixed(1)}% failure rate
              </span>
            </div>

            {/* Failures table */}
            {errorStats.recent_failures.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center py-8">
                <AlertTriangle className="h-8 w-8 text-zinc-200" />
                <p className="mt-2 text-sm text-zinc-400">No recent failures</p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Business</th>
                        <th className="px-4 py-3">Caller</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {errorStats.recent_failures.map((failure) => (
                        <tr
                          key={failure.call_id}
                          className="transition hover:bg-zinc-50"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                            {formatRelativeTime(failure.created_at)}
                          </td>
                          <td className="px-4 py-3 text-zinc-800">
                            {failure.business_name}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-600">
                            {maskPhone(failure.caller_phone)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                failure.status === "failed"
                                  ? "bg-red-50 text-red-700"
                                  : failure.status === "missed"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-zinc-100 text-zinc-600",
                              )}
                            >
                              {failure.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
