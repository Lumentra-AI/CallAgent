"use client";

import { useState, useEffect, useCallback } from "react";
import { listBookings, fetchStatsRaw, listResources, get } from "@/lib/api";
import type { Booking, Resource } from "@/types/crm";
import type { ScheduleItem } from "@/components/workstation/TodayPanel";
import type { Activity } from "@/components/workstation/ActivityFeed";
import type { HotelRoom } from "@/components/workstation/RoomGrid";
import type { Provider } from "@/components/workstation/ProviderAvailability";
import type { WaitingPatient } from "@/components/workstation/WaitingRoom";
import type { VIPAlert } from "@/components/workstation/VIPAlerts";

// ============================================================================
// TIMEZONE HELPER
// ============================================================================

/**
 * Get current hours and minutes in a given IANA timezone.
 * Falls back to browser local time if timezone is invalid.
 */
function getNowMinutesInTz(timezone?: string): number {
  const now = new Date();
  if (!timezone) return now.getHours() * 60 + now.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
    return h * 60 + m;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Format time from "HH:MM" (24h) or "HH:MM:SS" to "HH:MM AM/PM"
 */
function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Map booking status to ScheduleItem status
 */
const BOOKING_STATUS_MAP: Record<string, ScheduleItem["status"]> = {
  pending: "pending",
  confirmed: "confirmed",
  cancelled: "cancelled",
  completed: "completed",
  no_show: "no-show",
};

/**
 * Transform a Booking into a ScheduleItem for TodayPanel
 */
function bookingToScheduleItem(booking: Booking): ScheduleItem {
  return {
    id: booking.id,
    time: formatTime12h(booking.booking_time),
    entityName: booking.customer_name,
    entityPhone: booking.customer_phone,
    type: booking.booking_type,
    status: BOOKING_STATUS_MAP[booking.status] || "pending",
    notes: booking.notes || undefined,
    isVip: false,
  };
}

/**
 * Shape of a recent call from the API
 */
interface RecentCall {
  id: string;
  caller_phone: string | null;
  caller_name: string | null;
  duration_seconds: number | null;
  outcome_type: string | null;
  summary: string | null;
  created_at: string;
}

/**
 * Transform a recent call into an Activity for ActivityFeed
 */
function callToActivity(call: RecentCall): Activity {
  const isMissed = !call.duration_seconds || call.duration_seconds === 0;
  const type = isMissed ? "call_missed" : "call_incoming";

  const durationStr = call.duration_seconds
    ? `Duration: ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
    : "Missed call";

  return {
    id: call.id,
    type,
    title: call.caller_name
      ? `${isMissed ? "Missed call from" : "Call from"} ${call.caller_name}`
      : `${isMissed ? "Missed call" : "Incoming call"}`,
    description: call.summary || durationStr,
    timestamp: new Date(call.created_at),
    entityName: call.caller_name || undefined,
  };
}

/**
 * Transform a Resource (type=room) into a HotelRoom for RoomGrid
 */
function resourceToRoom(r: Resource): HotelRoom {
  return {
    id: r.id,
    number: r.name,
    floor: (r.metadata?.floor as number) || 1,
    type: (r.metadata?.room_type as string) || r.description || "Standard",
    status: r.is_active
      ? (r.metadata?.room_status as HotelRoom["status"]) || "available"
      : "maintenance",
    guestName: (r.metadata?.current_guest as string) || undefined,
    isVip: (r.metadata?.is_vip as boolean) || false,
  };
}

/**
 * Transform a Resource (type=staff) into a Provider for ProviderAvailability
 */
function resourceToProvider(r: Resource): Provider {
  return {
    id: r.id,
    name: r.name,
    title: (r.metadata?.title as string) || r.type,
    specialty: r.description || undefined,
    status: r.is_active ? "available" : "off",
    appointmentsToday: 0,
    appointmentsCompleted: 0,
  };
}

/**
 * Derive waiting patients from today's confirmed bookings.
 * - Past appointment time + not completed = "waiting"
 * - Within next 15 min = "ready" (arriving soon)
 */
function deriveWaitingPatients(
  bookings: Booking[],
  timezone?: string,
): WaitingPatient[] {
  const now = new Date();
  const nowMinutes = getNowMinutesInTz(timezone);
  const result: WaitingPatient[] = [];

  for (const b of bookings) {
    if (b.status !== "confirmed" && b.status !== "pending") continue;

    const [h, m] = b.booking_time.split(":").map(Number);
    const bookingMinutes = h * 60 + m;
    const diffMinutes = bookingMinutes - nowMinutes;

    // Skip bookings more than 2 hours in the future or already completed
    if (diffMinutes > 120) continue;

    let status: WaitingPatient["status"];
    if (diffMinutes <= 0) {
      status = "waiting"; // appointment time has passed
    } else if (diffMinutes <= 15) {
      status = "ready"; // arriving within 15 min
    } else {
      continue; // too far in the future
    }

    // Approximate check-in as appointment time (or slightly before)
    const checkedInAt = new Date(now);
    checkedInAt.setHours(h, m, 0, 0);
    if (status === "waiting") {
      checkedInAt.setMinutes(checkedInAt.getMinutes() - 5);
    }

    result.push({
      id: b.id,
      name: b.customer_name,
      appointmentTime: formatTime12h(b.booking_time),
      checkedInAt,
      provider: b.resource?.name || b.booking_type,
      type: b.booking_type,
      priority: "normal",
      status,
    });
  }

  return result;
}

/**
 * Derive VIP alerts from bookings and recent calls.
 * - Upcoming bookings (next 2 hours) = arrival alerts
 * - Bookings with notes = special request alerts
 * - Missed calls = general alerts
 */
function deriveVIPAlerts(
  bookings: Booking[],
  calls: RecentCall[],
  timezone?: string,
): VIPAlert[] {
  const alerts: VIPAlert[] = [];
  const now = new Date();
  const nowMinutes = getNowMinutesInTz(timezone);

  // Upcoming bookings as arrival alerts
  for (const b of bookings) {
    if (b.status !== "confirmed" && b.status !== "pending") continue;
    const [h, m] = b.booking_time.split(":").map(Number);
    const diffMinutes = h * 60 + m - nowMinutes;

    if (diffMinutes > 0 && diffMinutes <= 120) {
      const alertTime = new Date(now);
      alertTime.setHours(h, m, 0, 0);
      alerts.push({
        id: `arrival-${b.id}`,
        type: "arrival",
        priority: diffMinutes <= 30 ? "high" : "medium",
        guestName: b.customer_name,
        message: `${b.booking_type} at ${formatTime12h(b.booking_time)}`,
        time: alertTime,
        isRead: diffMinutes > 60,
      });
    }

    // Bookings with notes as special request alerts
    if (b.notes && b.notes.trim().length > 0) {
      alerts.push({
        id: `note-${b.id}`,
        type: "special_request",
        priority: "low",
        guestName: b.customer_name,
        message: b.notes,
        time: new Date(b.created_at),
        isRead: true,
      });
    }
  }

  // Recent missed calls as alerts
  for (const call of calls) {
    if (call.duration_seconds && call.duration_seconds > 0) continue;
    alerts.push({
      id: `missed-${call.id}`,
      type: "general",
      priority: "medium",
      guestName: call.caller_name || call.caller_phone || "Unknown",
      message: call.summary || "Missed call - may need callback",
      time: new Date(call.created_at),
      isRead: false,
    });
  }

  return alerts.sort((a, b) => b.time.getTime() - a.time.getTime());
}

// ============================================================================
// STAT TYPE
// ============================================================================

export interface WorkstationStat {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: "phone" | "calendar" | "users" | "clock" | "dollar";
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface WorkstationData {
  todayBookings: ScheduleItem[];
  recentActivity: Activity[];
  stats: WorkstationStat[];
  rooms: HotelRoom[];
  staffResources: Provider[];
  waitingPatients: WaitingPatient[];
  vipAlerts: VIPAlert[];
  primaryMetricValue: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWorkstationData(timezone?: string): WorkstationData {
  const [todayBookings, setTodayBookings] = useState<ScheduleItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [stats, setStats] = useState<WorkstationStat[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [staffResources, setStaffResources] = useState<Provider[]>([]);
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [vipAlerts, setVipAlerts] = useState<VIPAlert[]>([]);
  const [primaryMetricValue, setPrimaryMetricValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const today = new Date().toISOString().split("T")[0];

      // Fetch all data in parallel -- use allSettled so partial failures
      // don't block the entire workstation from rendering
      const [bookingsRes, callsRes, statsRes, roomsRes, staffRes] =
        await Promise.allSettled([
          listBookings({ date: today }),
          get<{ calls: RecentCall[] }>("/api/calls/recent", { limit: "10" }),
          fetchStatsRaw(),
          listResources({ type: "room" }),
          listResources({ type: "staff" }),
        ]);

      // Keep raw data for derived computations
      let rawBookings: Booking[] = [];
      let rawCalls: RecentCall[] = [];

      // Transform bookings -> ScheduleItems
      if (bookingsRes.status === "fulfilled") {
        rawBookings = bookingsRes.value.bookings;
        const items = rawBookings.map(bookingToScheduleItem);
        items.sort((a, b) => a.time.localeCompare(b.time));
        setTodayBookings(items);
        setPrimaryMetricValue(items.length);
      }

      // Transform calls -> Activities
      if (callsRes.status === "fulfilled") {
        rawCalls = callsRes.value.calls;
        const activities = rawCalls.map(callToActivity);
        setRecentActivity(activities);
      }

      // Transform dashboard stats
      if (statsRes.status === "fulfilled") {
        const s = statsRes.value;
        setStats([
          {
            id: "bookings",
            label: "Today's Bookings",
            value: s.bookings.today,
            icon: "calendar" as const,
          },
          {
            id: "calls",
            label: "Calls Handled",
            value: s.calls.today,
            icon: "phone" as const,
          },
          {
            id: "weekCalls",
            label: "This Week",
            value: s.calls.week,
            icon: "phone" as const,
          },
          {
            id: "revenue",
            label: "Revenue Today",
            value:
              s.revenue.today > 0
                ? `$${(s.revenue.today / 100).toFixed(0)}`
                : "$0",
            icon: "dollar" as const,
          },
        ]);
      }

      // Transform room resources
      if (roomsRes.status === "fulfilled") {
        setRooms(roomsRes.value.resources.map(resourceToRoom));
      }

      // Transform staff resources
      if (staffRes.status === "fulfilled") {
        setStaffResources(staffRes.value.resources.map(resourceToProvider));
      }

      // Derive waiting patients from today's bookings
      setWaitingPatients(deriveWaitingPatients(rawBookings, timezone));

      // Derive VIP alerts from bookings + missed calls
      setVipAlerts(deriveVIPAlerts(rawBookings, rawCalls, timezone));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workstation data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [timezone]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    todayBookings,
    recentActivity,
    stats,
    rooms,
    staffResources,
    waitingPatients,
    vipAlerts,
    primaryMetricValue,
    isLoading,
    error,
    refetch: fetchData,
  };
}
