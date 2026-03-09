"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  RefreshCw,
  AlertTriangle,
  Trophy,
  TrendingUp,
  Users,
  Phone,
  UserPlus,
  CheckCircle,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsGrowth,
  fetchTopTenants,
  fetchAtRiskTenants,
  type AnalyticsOverview,
  type GrowthData,
  type TopTenant,
  type AtRiskTenant,
} from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROWTH_PERIODS = [
  { label: "7d", range: 7 },
  { label: "30d", range: 30 },
  { label: "90d", range: 90 },
] as const;

const TIER_COLORS: Record<string, string> = {
  starter: "#a1a1aa", // zinc-400
  professional: "#52525b", // zinc-600
  enterprise: "#18181b", // zinc-950
};

const RISK_BADGE_STYLES: Record<string, string> = {
  "No calls 7d": "bg-amber-50 text-amber-700 border-amber-200",
  "Setup incomplete": "bg-zinc-100 text-zinc-600 border-zinc-200",
  "High failure rate": "bg-red-50 text-red-700 border-red-200",
};

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-zinc-200 ${className}`} />
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="mt-4 h-8 w-24" />
      <SkeletonBlock className="mt-3 h-3 w-32" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
  isLoading: boolean;
}

function KpiCard({ label, value, note, icon, isLoading }: KpiCardProps) {
  if (isLoading) return <KpiSkeleton />;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </p>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="mt-2 text-sm text-zinc-600">{note}</p>
    </div>
  );
}

function getRiskBadgeStyle(reason: string): string {
  for (const [key, style] of Object.entries(RISK_BADGE_STYLES)) {
    if (reason.toLowerCase().includes(key.toLowerCase())) {
      return style;
    }
  }
  return "bg-zinc-100 text-zinc-600 border-zinc-200";
}

// ---------------------------------------------------------------------------
// Custom tooltip for growth chart
// ---------------------------------------------------------------------------

interface GrowthTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function GrowthTooltip({ active, payload, label }: GrowthTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-md">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-1 text-sm text-zinc-900">
          <span
            className="mr-2 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminOverviewPage() {
  // Data
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [topTenants, setTopTenants] = useState<TopTenant[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskTenant[]>([]);

  // Loading / error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Growth chart period
  const [growthRange, setGrowthRange] = useState<number>(30);
  const [growthLoading, setGrowthLoading] = useState(false);

  // -------------------------------------------------------------------
  // Fetch all data on mount
  // -------------------------------------------------------------------

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [overviewRes, growthRes, topRes, riskRes] = await Promise.all([
        fetchAnalyticsOverview(),
        fetchAnalyticsGrowth("daily", growthRange),
        fetchTopTenants("calls", 5),
        fetchAtRiskTenants(),
      ]);

      setOverview(overviewRes);
      setGrowth(growthRes);
      setTopTenants(topRes);
      setAtRisk(riskRes);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [growthRange]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // -------------------------------------------------------------------
  // Reload growth chart when period changes (after initial load)
  // -------------------------------------------------------------------

  const loadGrowth = useCallback(async (range: number) => {
    setGrowthLoading(true);
    try {
      const data = await fetchAnalyticsGrowth("daily", range);
      setGrowth(data);
    } catch {
      // Keep existing data on error
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  const handlePeriodChange = useCallback(
    (range: number) => {
      setGrowthRange(range);
      if (!isLoading) {
        void loadGrowth(range);
      }
    },
    [isLoading, loadGrowth],
  );

  // -------------------------------------------------------------------
  // Derived chart data
  // -------------------------------------------------------------------

  const growthChartData = useMemo(() => {
    if (!growth) return [];

    const callMap = new Map(growth.calls.map((d) => [d.date, d.count]));
    const signupMap = new Map(growth.signups.map((d) => [d.date, d.count]));

    const allDates = new Set([
      ...growth.calls.map((d) => d.date),
      ...growth.signups.map((d) => d.date),
    ]);

    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date: formatDate(date),
        Calls: callMap.get(date) ?? 0,
        Signups: signupMap.get(date) ?? 0,
      }));
  }, [growth]);

  const industryChartData = useMemo(() => {
    if (!overview) return [];
    return overview.top_industries.slice(0, 6).map((item) => ({
      name: item.industry || "Unknown",
      count: item.count,
    }));
  }, [overview]);

  // -------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------

  if (error && !overview) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm font-medium text-red-800">
              Failed to load dashboard
            </p>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-zinc-400" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950">Overview</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Platform health at a glance.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        aria-label="Key metrics"
      >
        <KpiCard
          label="Total Tenants"
          value={overview?.total_tenants?.toLocaleString() ?? "--"}
          note={`${overview?.suspended_tenants ?? 0} suspended`}
          icon={<Users className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Active Tenants"
          value={overview?.active_tenants?.toLocaleString() ?? "--"}
          note={`${overview?.active_rate != null ? Math.round(overview.active_rate) : "--"}% active rate`}
          icon={<Activity className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Calls Today"
          value={overview?.total_calls_today?.toLocaleString() ?? "--"}
          note={`${overview?.total_calls_week?.toLocaleString() ?? "--"} this week`}
          icon={<Phone className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Calls This Month"
          value={overview?.total_calls_month?.toLocaleString() ?? "--"}
          note={`${overview?.avg_calls_per_tenant_month?.toFixed(1) ?? "--"} avg per tenant`}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          label="New This Month"
          value={overview?.new_signups_this_month?.toLocaleString() ?? "--"}
          note={`${overview?.new_signups_this_week ?? "--"} this week`}
          icon={<UserPlus className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Setup Completion"
          value={
            overview?.setup_completion_rate != null
              ? `${Math.round(overview.setup_completion_rate)}%`
              : "--"
          }
          note={`${overview?.total_users?.toLocaleString() ?? "--"} total users`}
          icon={<CheckCircle className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </section>

      {/* Growth Chart */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Growth
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">
              Calls and Signups
            </h2>
          </div>

          <div
            className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1"
            role="group"
            aria-label="Growth period selector"
          >
            {GROWTH_PERIODS.map((period) => (
              <button
                key={period.range}
                type="button"
                onClick={() => handlePeriodChange(period.range)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  growthRange === period.range
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
                aria-pressed={growthRange === period.range}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-72">
          {isLoading || growthLoading ? (
            <div className="flex h-full items-center justify-center">
              <SkeletonBlock className="h-full w-full" />
            </div>
          ) : growthChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">
              No growth data available for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={growthChartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e4e4e7" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<GrowthTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Calls"
                  stroke="#52525b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#52525b" }}
                />
                <Line
                  type="monotone"
                  dataKey="Signups"
                  stroke="#a1a1aa"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#a1a1aa" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend */}
        {!isLoading && !growthLoading && growthChartData.length > 0 && (
          <div className="mt-4 flex items-center gap-6 border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="inline-block h-2 w-2 rounded-full bg-zinc-600" />
              Calls
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="inline-block h-2 w-2 rounded-full bg-zinc-400" />
              Signups
            </div>
          </div>
        )}
      </section>

      {/* Industry + Tier Distribution */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Industry Breakdown */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Industries
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">
            Industry Breakdown
          </h2>

          {isLoading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : industryChartData.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">
              No industry data available.
            </p>
          ) : (
            <div className="mt-6 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={industryChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#a1a1aa" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#52525b" }}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    cursor={{ fill: "#f4f4f5" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e4e4e7",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {industryChartData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={index === 0 ? "#18181b" : "#a1a1aa"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tier Distribution */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Tiers
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">
            Tier Distribution
          </h2>

          {isLoading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !overview?.tier_distribution?.length ? (
            <p className="mt-6 text-sm text-zinc-400">
              No tier data available.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {/* Stacked bar */}
              {(() => {
                const total = overview.tier_distribution.reduce(
                  (sum, t) => sum + t.count,
                  0,
                );
                if (total === 0) return null;

                return (
                  <div className="flex h-6 w-full overflow-hidden rounded-full">
                    {overview.tier_distribution.map((item) => {
                      const pct = (item.count / total) * 100;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={item.tier}
                          className="transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              TIER_COLORS[item.tier] || "#d4d4d8",
                          }}
                          title={`${item.tier}: ${item.count} (${Math.round(pct)}%)`}
                        />
                      );
                    })}
                  </div>
                );
              })()}

              {/* Tier breakdown list */}
              <div className="space-y-3 pt-2">
                {overview.tier_distribution.map((item) => {
                  const total = overview.tier_distribution.reduce(
                    (sum, t) => sum + t.count,
                    0,
                  );
                  const pct =
                    total > 0 ? Math.round((item.count / total) * 100) : 0;

                  return (
                    <div
                      key={item.tier}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              TIER_COLORS[item.tier] || "#d4d4d8",
                          }}
                        />
                        <span className="text-sm font-medium capitalize text-zinc-900">
                          {item.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-zinc-950">
                          {item.count}
                        </span>
                        <span className="w-10 text-right text-xs text-zinc-500">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* At-Risk Tenants + Top Tenants */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* At-Risk Tenants */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Attention
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                At-Risk Tenants
              </h2>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : atRisk.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                No at-risk tenants detected.
              </div>
            ) : (
              <div className="space-y-2">
                {atRisk.map((tenant) => (
                  <Link
                    key={tenant.tenant_id}
                    href={`/admin/tenants/${tenant.tenant_id}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {tenant.business_name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {tenant.industry}
                        {tenant.detail ? ` -- ${tenant.detail}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRiskBadgeStyle(tenant.reason)}`}
                    >
                      {tenant.reason}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Tenants Leaderboard */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Leaderboard
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                Top Tenants by Calls
              </h2>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topTenants.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                No call data available yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200">
                {/* Header */}
                <div className="grid grid-cols-[2rem,1fr,auto] items-center gap-3 bg-zinc-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  <span>#</span>
                  <span>Tenant</span>
                  <span>Calls</span>
                </div>

                {/* Rows */}
                {topTenants.map((tenant, index) => (
                  <Link
                    key={tenant.tenant_id}
                    href={`/admin/tenants/${tenant.tenant_id}`}
                    className="grid grid-cols-[2rem,1fr,auto] items-center gap-3 border-t border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                  >
                    <span className="text-sm font-semibold text-zinc-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {tenant.business_name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {tenant.industry}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-zinc-950">
                      {tenant.metric_value.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
