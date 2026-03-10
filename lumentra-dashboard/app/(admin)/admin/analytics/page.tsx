"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type PieLabelRenderProps,
} from "recharts";
import {
  fetchCallAnalytics,
  fetchTopTenants,
  type CallAnalytics,
  type TopTenant,
} from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DaysOption = 7 | 30 | 90 | 365;

const DAYS_OPTIONS: { label: string; value: DaysOption }[] = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "365d", value: 365 },
];

const OUTCOME_COLORS: Record<string, string> = {
  booking: "#10b981", // emerald-500
  inquiry: "#3b82f6", // blue-500
  support: "#f59e0b", // amber-500
  escalation: "#f43f5e", // rose-500
  hangup: "#a1a1aa", // zinc-400
  unknown: "#d4d4d8", // zinc-300
};

const FALLBACK_COLOR = "#71717a"; // zinc-500

type IndustrySortKey = "industry" | "count" | "success_rate";
type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function getTopOutcome(byOutcome: Record<string, number>): string {
  let topKey = "none";
  let topVal = 0;
  for (const [key, val] of Object.entries(byOutcome)) {
    if (val > topVal) {
      topVal = val;
      topKey = key;
    }
  }
  return topKey.charAt(0).toUpperCase() + topKey.slice(1);
}

function successRateColor(rate: number): string {
  if (rate >= 70) return "text-emerald-600";
  if (rate >= 40) return "text-amber-600";
  return "text-red-600";
}

function successRateBarColor(rate: number): string {
  if (rate >= 70) return "bg-emerald-500";
  if (rate >= 40) return "bg-amber-400";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function KPICardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
      <div className="mt-4 h-7 w-20 animate-pulse rounded bg-zinc-200" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}

function ChartSkeleton({ height = "h-72" }: { height?: string }) {
  return (
    <div className={`${height} w-full animate-pulse rounded-2xl bg-zinc-100`} />
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCSV(
  callData: CallAnalytics,
  tenants: TopTenant[],
  days: DaysOption,
) {
  const lines: string[] = [];

  // Industry section
  lines.push("--- Industry Performance ---");
  lines.push("Industry,Calls,Success Rate");
  for (const r of callData.by_industry) {
    lines.push(`"${r.industry}",${r.count},${r.success_rate}%`);
  }

  lines.push("");

  // Tenant section
  lines.push("--- Top Tenants ---");
  lines.push("Rank,Business,Industry,Calls");
  tenants.forEach((t, i) => {
    lines.push(
      `${i + 1},"${t.business_name}","${t.industry}",${t.metric_value}`,
    );
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lumentra-analytics-${days}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Custom recharts tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}

function HourTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-zinc-900">{label}</p>
      <p className="text-zinc-600">{payload[0].value.toLocaleString()} calls</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<DaysOption>(30);
  const [callData, setCallData] = useState<CallAnalytics | null>(null);
  const [tenants, setTenants] = useState<TopTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Industry table sort
  const [industrySortKey, setIndustrySortKey] =
    useState<IndustrySortKey>("count");
  const [industrySortDir, setIndustrySortDir] = useState<SortDirection>("desc");

  // ------- Data fetching -------

  const loadData = useCallback(async (d: DaysOption) => {
    setIsLoading(true);
    setError(null);

    try {
      const [analytics, topTenants] = await Promise.all([
        fetchCallAnalytics(d),
        fetchTopTenants("calls", 20),
      ]);
      setCallData(analytics);
      setTenants(topTenants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(days);
  }, [days, loadData]);

  // ------- Derived data -------

  const hourChartData = useMemo(() => {
    if (!callData) return [];
    return callData.by_hour.map((entry) => ({
      hour: formatHourLabel(entry.hour),
      count: entry.count,
    }));
  }, [callData]);

  const outcomeChartData = useMemo(() => {
    if (!callData) return [];
    return Object.entries(callData.by_outcome).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: OUTCOME_COLORS[name] ?? FALLBACK_COLOR,
    }));
  }, [callData]);

  const sortedIndustries = useMemo(() => {
    if (!callData) return [];
    const sorted = [...callData.by_industry];
    sorted.sort((a, b) => {
      const aVal = a[industrySortKey];
      const bVal = b[industrySortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return industrySortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal);
      const numB = Number(bVal);
      return industrySortDir === "asc" ? numA - numB : numB - numA;
    });
    return sorted;
  }, [callData, industrySortKey, industrySortDir]);

  // ------- Industry sort handler -------

  const handleIndustrySort = useCallback(
    (key: IndustrySortKey) => {
      if (industrySortKey === key) {
        setIndustrySortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setIndustrySortKey(key);
        setIndustrySortDir("desc");
      }
    },
    [industrySortKey],
  );

  function SortIcon({ columnKey }: { columnKey: IndustrySortKey }) {
    if (industrySortKey !== columnKey) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 text-zinc-400" />;
    }
    return industrySortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3 text-zinc-600" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3 text-zinc-600" />
    );
  }

  // ------- Render -------

  return (
    <div className="space-y-6">
      {/* ============ Header ============ */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-zinc-400" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950">
              Call Analytics
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Platform-wide call performance and tenant comparison.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div
            className="inline-flex overflow-hidden rounded-xl border border-zinc-200 bg-white"
            role="group"
            aria-label="Date range"
          >
            {DAYS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                className={`px-3.5 py-1.5 text-sm font-medium transition ${
                  days === opt.value
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
                aria-pressed={days === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Export */}
          <button
            type="button"
            onClick={() => {
              if (callData) exportCSV(callData, tenants, days);
            }}
            disabled={isLoading || !callData}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            aria-label="Export analytics data as CSV"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void loadData(days)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            aria-label="Refresh analytics data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </section>

      {/* ============ Error ============ */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">
            Failed to load analytics
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadData(days)}
            className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* ============ KPI Cards ============ */}
      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Key performance indicators"
      >
        {isLoading || !callData ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            {/* Total Calls */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Total Calls
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">
                {callData.total.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-zinc-600">Last {days} days</p>
            </div>

            {/* Avg Duration */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Avg Duration
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">
                {formatDuration(callData.avg_duration_seconds)}
              </p>
              <p className="mt-2 text-sm text-zinc-600">Per completed call</p>
            </div>

            {/* Failure Rate */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Failure Rate
              </p>
              <p
                className={`mt-3 text-2xl font-semibold ${
                  callData.failure_rate > 10 ? "text-red-600" : "text-zinc-950"
                }`}
              >
                {callData.failure_rate.toFixed(1)}%
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                {callData.failure_rate > 10
                  ? "Above 10% threshold"
                  : "Within normal range"}
              </p>
            </div>

            {/* Top Outcome */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Top Outcome
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">
                {getTopOutcome(callData.by_outcome)}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Most frequent call result
              </p>
            </div>
          </>
        )}
      </section>

      {/* ============ Charts Row ============ */}
      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        {/* Call Volume by Hour */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">
            Call Volume by Hour
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Distribution of calls across the day (last {days} days)
          </p>
          <div className="mt-4 h-72">
            {isLoading || !callData ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourChartData}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e4e4e7" }}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<HourTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="#52525b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Outcome Breakdown */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">
            Outcome Breakdown
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Call results distribution
          </p>
          <div className="mt-4 h-72">
            {isLoading || !callData ? (
              <ChartSkeleton />
            ) : outcomeChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                No outcome data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={(props: PieLabelRenderProps) => {
                      const n = String(props.name ?? "");
                      const p =
                        typeof props.percent === "number" ? props.percent : 0;
                      return `${n} ${(p * 100).toFixed(0)}%`;
                    }}
                    labelLine={{ stroke: "#a1a1aa", strokeWidth: 1 }}
                  >
                    {outcomeChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) =>
                      value != null ? value.toLocaleString() : "0"
                    }
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-xs text-zinc-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ============ Industry Performance Table ============ */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">
          Industry Performance
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Call volume and success rates by industry vertical
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleIndustrySort("industry")}
                    className="inline-flex items-center hover:text-zinc-700"
                  >
                    Industry
                    <SortIcon columnKey="industry" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleIndustrySort("count")}
                    className="inline-flex items-center hover:text-zinc-700"
                  >
                    Calls
                    <SortIcon columnKey="count" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleIndustrySort("success_rate")}
                    className="inline-flex items-center hover:text-zinc-700"
                  >
                    Success Rate
                    <SortIcon columnKey="success_rate" />
                  </button>
                </th>
                <th className="hidden px-4 py-3 sm:table-cell">
                  <span className="sr-only">Success rate bar</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading || !callData ? (
                <>
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                </>
              ) : sortedIndustries.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No industry data available
                  </td>
                </tr>
              ) : (
                sortedIndustries.map((row) => (
                  <tr
                    key={row.industry}
                    className="transition hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {row.industry}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                      {row.count.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${successRateColor(row.success_rate)}`}
                    >
                      {row.success_rate.toFixed(1)}%
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full transition-all ${successRateBarColor(row.success_rate)}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, row.success_rate))}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ Tenant Comparison Table ============ */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">
          Tenant Comparison
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Top 20 tenants by call volume (last 30 days)
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <th className="w-16 px-4 py-3 text-center">Rank</th>
                <th className="px-4 py-3">Business</th>
                <th className="hidden px-4 py-3 sm:table-cell">Industry</th>
                <th className="px-4 py-3 text-right">Calls (30d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <>
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                  <TableRowSkeleton cols={4} />
                </>
              ) : tenants.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No tenant data available
                  </td>
                </tr>
              ) : (
                tenants.map((t, i) => (
                  <tr key={t.tenant_id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3 text-center tabular-nums text-zinc-500">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tenants/${t.tenant_id}`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                      >
                        {t.business_name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                      {t.industry}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900">
                      {t.metric_value.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
