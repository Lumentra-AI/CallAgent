"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  Calendar,
  PhoneMissed,
  ClipboardCheck,
  Clock,
  User,
  ArrowRight,
  Check,
  X,
  Loader2,
  PhoneCall,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { get, put } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types (aligned with API response shapes)
// ---------------------------------------------------------------------------

interface DashboardStats {
  calls: { today: number; week: number; month: number };
  bookings: { today: number; week: number; month: number };
}

interface RecentCall {
  id: string;
  caller_name: string | null;
  caller_phone: string | null;
  created_at: string;
  duration_seconds: number | null;
  outcome_type: string | null;
  summary: string | null;
}

interface PendingBooking {
  id: string;
  customer_name: string;
  requested_date: string | null;
  requested_time: string | null;
  service: string | null;
  status: string;
}

interface UpcomingBooking {
  id: string;
  customer_name: string;
  booking_date: string | null;
  booking_time: string | null;
  booking_type: string | null;
}

interface CallbackItem {
  id: string;
  callerName: string | null;
  phone: string | null;
  reason: string | null;
  selectedContactName: string | null;
  startedAt: string;
  transferType: string | null;
  aiSummary: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatTime12h(timeString: string | null | undefined): string {
  if (!timeString) return "";
  if (timeString.includes(":")) {
    const [hoursStr, minutesStr] = timeString.split(":");
    const hour = parseInt(hoursStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 || 12;
    return `${display}:${minutesStr} ${ampm}`;
  }
  return timeString;
}

function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "Unknown";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return "Unknown";
  const labels: Record<string, string> = {
    booking: "Booking",
    appointment: "Appointment",
    inquiry: "Inquiry",
    support: "Support",
    escalation: "Escalated",
    hangup: "Hang up",
    voicemail: "Voicemail",
    completed: "Completed",
    missed: "Missed",
    abandoned: "Abandoned",
  };
  return labels[outcome.toLowerCase()] ?? outcome;
}

function outcomeColor(outcome: string | null | undefined): string {
  if (!outcome) return "text-muted-foreground";
  const o = outcome.toLowerCase();
  if (["booking", "appointment", "completed"].includes(o))
    return "text-green-600 dark:text-green-400";
  if (["missed", "abandoned", "hangup"].includes(o))
    return "text-red-600 dark:text-red-400";
  if (["escalation"].includes(o)) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accentClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  loading: boolean;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            accentClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {loading ? (
            <div className="h-7 w-12 animate-pulse rounded bg-muted mt-0.5" />
          ) : (
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {linkLabel ?? "View all"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-12 w-full animate-pulse rounded-lg bg-muted"
        />
      ))}
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1" />
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OperationsBoard() {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>(
    [],
  );
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track confirm/reject in-flight per booking id
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(new Set());

  // Fetch all data in parallel
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, callsRes, pendingRes, upcomingRes, callbackRes] =
        await Promise.allSettled([
          get<DashboardStats>("/api/dashboard/stats"),
          get<{ calls: RecentCall[] }>("/api/calls/recent"),
          get<{ bookings: PendingBooking[] }>("/api/pending-bookings"),
          get<{ bookings: UpcomingBooking[] }>("/api/bookings/upcoming", {
            hours: "24",
          }),
          get<{ queue: CallbackItem[] }>("/api/escalation/queue"),
        ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (callsRes.status === "fulfilled")
        setRecentCalls(callsRes.value.calls ?? []);
      if (pendingRes.status === "fulfilled")
        setPendingBookings(pendingRes.value.bookings ?? []);
      if (upcomingRes.status === "fulfilled")
        setUpcomingBookings(upcomingRes.value.bookings ?? []);
      if (callbackRes.status === "fulfilled")
        setCallbacks(callbackRes.value.queue ?? []);

      // If ALL failed, show error
      const allFailed = [
        statsRes,
        callsRes,
        pendingRes,
        upcomingRes,
        callbackRes,
      ].every((r) => r.status === "rejected");
      if (allFailed) {
        setError("Could not load dashboard data. Check your connection.");
      }
    } catch {
      setError("Could not load dashboard data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Computed stats
  const callsToday = stats?.calls?.today ?? 0;
  const bookingsToday = stats?.bookings?.today ?? 0;
  const missedCalls = recentCalls.filter(
    (c) =>
      c.outcome_type &&
      ["missed", "abandoned"].includes(c.outcome_type.toLowerCase()),
  ).length;
  const pendingCount = pendingBookings.filter(
    (b) => b.status === "pending",
  ).length;

  // Confirm / Reject handlers
  const handleConfirm = async (id: string) => {
    setConfirmingIds((prev) => new Set(prev).add(id));
    try {
      await put(`/api/pending-bookings/${id}/confirm`);
      // Refetch pending bookings
      try {
        const res = await get<{ bookings: PendingBooking[] }>(
          "/api/pending-bookings",
        );
        setPendingBookings(res.bookings ?? []);
      } catch {
        // Remove locally on refetch failure
        setPendingBookings((prev) => prev.filter((b) => b.id !== id));
      }
    } catch {
      // Silently fail -- booking stays in list so user can retry
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReject = async (id: string) => {
    setRejectingIds((prev) => new Set(prev).add(id));
    try {
      await put(`/api/pending-bookings/${id}/reject`, {});
      try {
        const res = await get<{ bookings: PendingBooking[] }>(
          "/api/pending-bookings",
        );
        setPendingBookings(res.bookings ?? []);
      } catch {
        setPendingBookings((prev) => prev.filter((b) => b.id !== id));
      }
    } catch {
      // Silently fail
    } finally {
      setRejectingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Filter to only pending bookings for the confirmations section
  const pendingOnly = pendingBookings.filter((b) => b.status === "pending");

  // Filter callbacks to only those with callback transfer type
  const callbackItems = callbacks.filter(
    (c) => c.transferType === "callback" || !c.transferType,
  );

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      {/* ---------------------------------------------------------------- */}
      {/* Stat Cards */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Phone}
          label="Calls Today"
          value={callsToday}
          loading={loading && !stats}
          accentClass="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
        />
        <StatCard
          icon={Calendar}
          label="Bookings Today"
          value={bookingsToday}
          loading={loading && !stats}
          accentClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
        />
        <StatCard
          icon={PhoneMissed}
          label="Missed Calls"
          value={missedCalls}
          loading={loading && !stats}
          accentClass="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Pending"
          value={pendingCount}
          loading={loading && !stats}
          accentClass="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Recent Calls + Today's Schedule */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Calls */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <SectionHeader
            title="Recent Calls"
            href="/calls"
            linkLabel="View all"
          />
          {loading ? (
            <SkeletonRows count={4} />
          ) : recentCalls.length === 0 ? (
            <EmptyState message="No recent calls" />
          ) : (
            <div className="space-y-0.5">
              {recentCalls.slice(0, 8).map((call, idx) => (
                <Link
                  key={call.id}
                  href="/calls"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50",
                    idx % 2 === 1 && "bg-muted/40",
                  )}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {call.caller_name || "Unknown Caller"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatPhone(call.caller_phone)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        outcomeColor(call.outcome_type),
                      )}
                    >
                      {outcomeLabel(call.outcome_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(call.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Today's Schedule */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <SectionHeader
            title="Today's Schedule"
            href="/calendar"
            linkLabel="View all"
          />
          {loading ? (
            <SkeletonRows count={4} />
          ) : upcomingBookings.length === 0 ? (
            <EmptyState message="Schedule is clear" />
          ) : (
            <div className="space-y-0.5">
              {upcomingBookings.slice(0, 8).map((booking, idx) => (
                <Link
                  key={booking.id}
                  href="/calendar"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50",
                    idx % 2 === 1 && "bg-muted/40",
                  )}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {booking.customer_name || "Guest"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {booking.booking_type || "General"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-xs font-medium text-foreground">
                      {formatTime12h(booking.booking_time)}
                    </span>
                    {booking.booking_date && (
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(booking.booking_date)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Pending Confirmations */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <SectionHeader title="Pending Confirmations" />
        {loading ? (
          <SkeletonRows count={3} />
        ) : pendingOnly.length === 0 ? (
          <EmptyState message="No pending bookings" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2 pr-4">Guest</th>
                  <th className="pb-2 pr-4 hidden sm:table-cell">Date/Time</th>
                  <th className="pb-2 pr-4 hidden md:table-cell">Service</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOnly.map((booking, idx) => {
                  const isConfirming = confirmingIds.has(booking.id);
                  const isRejecting = rejectingIds.has(booking.id);
                  const busy = isConfirming || isRejecting;

                  return (
                    <tr
                      key={booking.id}
                      className={cn(
                        "border-b border-border/50 last:border-0",
                        idx % 2 === 1 && "bg-muted/40",
                      )}
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-foreground truncate max-w-[160px]">
                          {booking.customer_name || "Guest"}
                        </p>
                        {/* Show date on mobile since column is hidden */}
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {formatDateShort(booking.requested_date)}{" "}
                          {formatTime12h(booking.requested_time)}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 hidden sm:table-cell text-muted-foreground">
                        {formatDateShort(booking.requested_date)}{" "}
                        {formatTime12h(booking.requested_time)}
                      </td>
                      <td className="py-2.5 pr-4 hidden md:table-cell text-muted-foreground truncate max-w-[160px]">
                        {booking.service || "--"}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5 text-xs"
                            disabled={busy}
                            onClick={() => handleConfirm(booking.id)}
                            aria-label={`Confirm booking for ${booking.customer_name}`}
                          >
                            {isConfirming ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                  Confirm
                                </span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 h-7 px-2.5 text-xs"
                            disabled={busy}
                            onClick={() => handleReject(booking.id)}
                            aria-label={`Reject booking for ${booking.customer_name}`}
                          >
                            {isRejecting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <X className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Reject</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Callbacks Waiting -- only rendered if items exist */}
      {/* ---------------------------------------------------------------- */}
      {!loading && callbackItems.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <SectionHeader title="Callbacks Waiting" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2 pr-4">Caller</th>
                  <th className="pb-2 pr-4 hidden sm:table-cell">Reason</th>
                  <th className="pb-2 pr-4 hidden md:table-cell">
                    Assigned To
                  </th>
                  <th className="pb-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {callbackItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      idx % 2 === 1 && "bg-muted/40",
                    )}
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[140px]">
                            {item.callerName || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatPhone(item.phone)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 hidden sm:table-cell text-muted-foreground truncate max-w-[200px]">
                      {item.reason || "--"}
                    </td>
                    <td className="py-2.5 pr-4 hidden md:table-cell text-muted-foreground">
                      {item.selectedContactName || "Unassigned"}
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {relativeTime(item.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
