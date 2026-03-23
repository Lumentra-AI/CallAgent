"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, DollarSign, RefreshCw } from "lucide-react";
import { fetchVapiUsage, type VapiUsageItem } from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey =
  | "total_cost"
  | "total_minutes"
  | "total_calls"
  | "business_name"
  | "last_call_at";
type SortOrder = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentCycle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatMinutes(value: number): string {
  return value.toFixed(1);
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatPhone(phone: string): string {
  if (!phone) return "--";
  // Format +1XXXXXXXXXX as (XXX) XXX-XXXX
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

/** Generate an array of YYYY-MM strings from 2026-01 to current month */
function generateCycleOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Go back 12 months max
  for (let i = 0; i < 12; i++) {
    let month = currentMonth - i;
    let year = currentYear;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    options.push(`${year}-${String(month).padStart(2, "0")}`);
  }

  return options;
}

function formatCycleLabel(cycle: string): string {
  const [year, month] = cycle.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-200" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column header (sortable)
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentOrder: SortOrder;
  onSort: (key: SortKey) => void;
  className?: string;
}

function ColumnHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
  className = "",
}: ColumnHeaderProps) {
  const isActive = currentSort === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`group inline-flex items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 transition hover:text-zinc-700 ${className}`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 transition ${
          isActive ? "text-zinc-900" : "text-zinc-300 group-hover:text-zinc-400"
        }`}
      />
      {isActive && (
        <span className="sr-only">
          {currentOrder === "asc" ? "ascending" : "descending"}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pipeline badge
// ---------------------------------------------------------------------------

function PipelineBadge({ pipeline }: { pipeline: string }) {
  const styles: Record<string, string> = {
    vapi: "bg-violet-50 text-violet-700 border-violet-200",
    livekit: "bg-sky-50 text-sky-700 border-sky-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        styles[pipeline] || "bg-zinc-100 text-zinc-600 border-zinc-200"
      }`}
    >
      {pipeline}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function VapiUsagePage() {
  const [usage, setUsage] = useState<VapiUsageItem[]>([]);
  const [cycle, setCycle] = useState(getCurrentCycle);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("total_cost");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const cycleOptions = useMemo(() => generateCycleOptions(), []);

  // -------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------

  const loadUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchVapiUsage(cycle);
      setUsage(result.usage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load Vapi usage data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [cycle]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  // -------------------------------------------------------------------
  // Sort logic
  // -------------------------------------------------------------------

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortOrder("desc");
      }
    },
    [sortKey],
  );

  const sortedUsage = useMemo(() => {
    const sorted = [...usage].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortKey) {
        case "business_name":
          aVal = (a.business_name || "").toLowerCase();
          bVal = (b.business_name || "").toLowerCase();
          break;
        case "last_call_at":
          aVal = a.last_call_at || "";
          bVal = b.last_call_at || "";
          break;
        default:
          aVal = a[sortKey];
          bVal = b[sortKey];
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [usage, sortKey, sortOrder]);

  // -------------------------------------------------------------------
  // Summary totals
  // -------------------------------------------------------------------

  const summary = useMemo(() => {
    return usage.reduce(
      (acc, item) => ({
        totalCost: acc.totalCost + item.total_cost,
        totalMinutes: acc.totalMinutes + item.total_minutes,
        totalCalls: acc.totalCalls + item.total_calls,
      }),
      { totalCost: 0, totalMinutes: 0, totalCalls: 0 },
    );
  }, [usage]);

  // -------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------

  if (error && usage.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          cycle={cycle}
          cycleOptions={cycleOptions}
          onCycleChange={setCycle}
          onRefresh={loadUsage}
          isLoading={isLoading}
          tenantCount={0}
        />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">
            Failed to load usage data
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadUsage()}
            className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        cycle={cycle}
        cycleOptions={cycleOptions}
        onCycleChange={setCycle}
        onRefresh={loadUsage}
        isLoading={isLoading}
        tenantCount={usage.length}
      />

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Usage summary">
        <SummaryCard
          label="Total Spend"
          value={formatCurrency(summary.totalCost)}
          isLoading={isLoading}
        />
        <SummaryCard
          label="Total Minutes"
          value={formatMinutes(summary.totalMinutes)}
          isLoading={isLoading}
        />
        <SummaryCard
          label="Total Calls"
          value={summary.totalCalls.toLocaleString()}
          isLoading={isLoading}
        />
      </section>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5">
            <TableSkeleton />
          </div>
        ) : sortedUsage.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-500">
            No Vapi usage data for {formatCycleLabel(cycle)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-5 py-3 text-left">
                    <ColumnHeader
                      label="Business"
                      sortKey="business_name"
                      currentSort={sortKey}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-5 py-3 text-left">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Phone
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right">
                    <ColumnHeader
                      label="Cost"
                      sortKey="total_cost"
                      currentSort={sortKey}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="px-5 py-3 text-right">
                    <ColumnHeader
                      label="Minutes"
                      sortKey="total_minutes"
                      currentSort={sortKey}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="px-5 py-3 text-right">
                    <ColumnHeader
                      label="Calls"
                      sortKey="total_calls"
                      currentSort={sortKey}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="px-5 py-3 text-left">
                    <ColumnHeader
                      label="Last Call"
                      sortKey="last_call_at"
                      currentSort={sortKey}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-5 py-3 text-left">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Pipeline
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsage.map((item, index) => (
                  <tr
                    key={item.tenant_id}
                    className={`border-b border-zinc-100 transition hover:bg-zinc-50 ${
                      index % 2 === 1 ? "bg-zinc-50/50" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-zinc-950">
                        {item.business_name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600">
                      {formatPhone(item.phone_number)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-zinc-950">
                      {formatCurrency(item.total_cost)}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-700">
                      {formatMinutes(item.total_minutes)}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-700">
                      {item.total_calls.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-zinc-600">
                      {formatDateTime(item.last_call_at)}
                    </td>
                    <td className="px-5 py-3">
                      <PipelineBadge pipeline={item.voice_pipeline} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                  <td className="px-5 py-3 text-zinc-950">
                    Total ({sortedUsage.length} tenants)
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-right text-zinc-950">
                    {formatCurrency(summary.totalCost)}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-700">
                    {formatMinutes(summary.totalMinutes)}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-700">
                    {summary.totalCalls.toLocaleString()}
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header sub-component
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  cycle: string;
  cycleOptions: string[];
  onCycleChange: (cycle: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  tenantCount: number;
}

function PageHeader({
  cycle,
  cycleOptions,
  onCycleChange,
  onRefresh,
  isLoading,
  tenantCount,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-zinc-400" />
          <h1 className="text-2xl font-semibold text-zinc-950">Vapi Usage</h1>
          {!isLoading && tenantCount > 0 && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              {tenantCount} tenants
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Vapi voice pipeline cost and usage tracking per tenant.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Month selector */}
        <label htmlFor="cycle-select" className="sr-only">
          Billing cycle
        </label>
        <select
          id="cycle-select"
          value={cycle}
          onChange={(e) => onCycleChange(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          aria-label="Select billing cycle"
        >
          {cycleOptions.map((opt) => (
            <option key={opt} value={opt}>
              {formatCycleLabel(opt)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          aria-label="Refresh usage data"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card sub-component
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string;
  isLoading: boolean;
}

function SummaryCard({ label, value, isLoading }: SummaryCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="h-3 w-20 animate-pulse rounded-lg bg-zinc-200" />
        <div className="mt-4 h-8 w-24 animate-pulse rounded-lg bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}
