"use client";

import * as React from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  Filter,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  MessageSquare,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Column } from "@/components/crm/shared/DataTable";
import { Pagination } from "@/components/crm/shared/Pagination";
import { EmptyState } from "@/components/crm/shared/EmptyState";
import { useCalls, useCall, type Call } from "@/hooks/useCalls";
import { CallDetail } from "./CallDetail";
import { cn } from "@/lib/utils";

// ============================================================================
// OUTCOME BADGE
// ============================================================================

function OutcomeBadge({ outcome }: { outcome?: string }) {
  const config: Record<
    string,
    { label: string; className: string; icon: React.ElementType }
  > = {
    booking: {
      label: "Booking",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: CheckCircle,
    },
    inquiry: {
      label: "Inquiry",
      className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      icon: MessageSquare,
    },
    support: {
      label: "Support",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: User,
    },
    escalation: {
      label: "Escalated",
      className: "bg-red-500/10 text-red-400 border-red-500/20",
      icon: ArrowUpRight,
    },
    hangup: {
      label: "Hangup",
      className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      icon: XCircle,
    },
  };

  const item = config[outcome || ""] || {
    label: outcome || "Unknown",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    icon: Phone,
  };

  const Icon = item.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        item.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {item.label}
    </span>
  );
}

// ============================================================================
// DURATION FORMAT
// ============================================================================

function formatDuration(seconds?: number): string {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================================
// TABLE COLUMNS
// ============================================================================

const columns: Column<Call>[] = [
  {
    key: "direction",
    header: "",
    render: (call) => (
      <div className="flex items-center justify-center">
        {call.direction === "inbound" ? (
          <PhoneIncoming className="h-4 w-4 text-emerald-400" />
        ) : (
          <PhoneOutgoing className="h-4 w-4 text-blue-400" />
        )}
      </div>
    ),
  },
  {
    key: "caller",
    header: "Caller",
    sortable: true,
    render: (call) => (
      <div>
        <div className="font-medium text-zinc-100">
          {call.caller_name || "Unknown Caller"}
        </div>
        <div className="text-xs text-zinc-500">{call.caller_phone}</div>
      </div>
    ),
  },
  {
    key: "outcome",
    header: "Outcome",
    render: (call) => <OutcomeBadge outcome={call.outcome_type} />,
  },
  {
    key: "duration",
    header: "Duration",
    render: (call) => (
      <div className="flex items-center gap-1 text-zinc-400">
        <Clock className="h-3 w-3" />
        {formatDuration(call.duration_seconds)}
      </div>
    ),
  },
  {
    key: "summary",
    header: "Summary",
    render: (call) => (
      <div className="max-w-[200px] truncate text-zinc-400">
        {call.summary || "-"}
      </div>
    ),
  },
  {
    key: "created_at",
    header: "Date",
    sortable: true,
    render: (call) => (
      <div className="flex items-center gap-1 text-zinc-400">
        <Calendar className="h-3 w-3" />
        {formatDate(call.created_at)}
      </div>
    ),
  },
];

// ============================================================================
// CALLS PAGE
// ============================================================================

export default function CallsPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [outcome, setOutcome] = React.useState<string>("");
  const [offset, setOffset] = React.useState(0);
  const [selectedCallId, setSelectedCallId] = React.useState<string | null>(
    null,
  );
  const limit = 20;

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { calls, total, loading, error, refetch } = useCalls({
    search: debouncedSearch,
    outcome: outcome || undefined,
    limit,
    offset,
  });

  const { call: selectedCall, loading: loadingDetail } =
    useCall(selectedCallId);

  // Handle row click
  const handleRowClick = (call: Call) => {
    setSelectedCallId(call.id);
  };

  // Close detail
  const handleCloseDetail = () => {
    setSelectedCallId(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Call History
          </h1>
          <p className="text-sm text-muted-foreground">{total} total calls</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value);
            setOffset(0);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Outcomes</option>
          <option value="booking">Booking</option>
          <option value="inquiry">Inquiry</option>
          <option value="support">Support</option>
          <option value="escalation">Escalated</option>
          <option value="hangup">Hangup</option>
        </select>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <Filter className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : calls.length === 0 && !loading ? (
            <EmptyState
              icon={Phone}
              title="No calls found"
              description={
                search
                  ? "Try adjusting your search"
                  : "Call history will appear here"
              }
            />
          ) : (
            <DataTable<Call>
              columns={columns}
              data={calls}
              keyExtractor={(call) => call.id}
              isLoading={loading}
              onRowClick={handleRowClick}
              selectedIds={
                selectedCallId ? new Set([selectedCallId]) : undefined
              }
            />
          )}
        </div>

        {/* Detail Panel */}
        {selectedCallId && (
          <div className="w-[400px] border-l border-border overflow-auto">
            <CallDetail
              call={selectedCall}
              loading={loadingDetail}
              onClose={handleCloseDetail}
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="border-t border-border px-6 py-3">
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
          />
        </div>
      )}
    </div>
  );
}
