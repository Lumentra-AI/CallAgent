"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import { formatCurrency, formatPercentage } from "@/lib/mockData";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Phone,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// SYSTEM HEALTH PANEL - Left Column
// ============================================================================

export default function SystemHealth() {
  const { config, metrics, industryMetrics, getTerminology } = useConfig();

  if (!config || !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="h-5 w-5 animate-pulse text-zinc-600" />
      </div>
    );
  }

  const terminology = getTerminology(config.industry);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 p-3">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          System Telemetry
        </h2>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {/* Revenue Card - Primary KPI */}
        <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-400">
              Revenue Rescued
            </span>
          </div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-white">
            {formatCurrency(metrics.business.revenueToday)}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            {metrics.business.transactionsToday}{" "}
            {terminology.transactionPlural.toLowerCase()} today
          </div>
        </div>

        {/* System Metrics */}
        <div className="mb-4 space-y-2">
          <MetricRow
            label="LATENCY"
            value={`${metrics.system.latency}ms`}
            status={metrics.system.latency < 50 ? "nominal" : "warning"}
          />
          <MetricRow
            label="UPTIME"
            value={formatPercentage(metrics.system.uptime)}
            status="nominal"
          />
          <MetricRow
            label="ACTIVE"
            value={String(metrics.system.activeCalls)}
            status={metrics.system.activeCalls > 0 ? "active" : "nominal"}
          />
          <MetricRow
            label="QUEUED"
            value={String(metrics.system.queuedCalls)}
            status={metrics.system.queuedCalls > 2 ? "warning" : "nominal"}
          />
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-zinc-800" />

        {/* Industry-Specific Metrics */}
        <div className="space-y-2">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            {config.industry} Metrics
          </div>
          {industryMetrics.map((metric) => (
            <MetricRow
              key={metric.id}
              label={metric.id.toUpperCase()}
              value={
                typeof metric.value === "number"
                  ? metric.id.includes("rate") ||
                    metric.id.includes("conversion")
                    ? formatPercentage(metric.value)
                    : metric.id.includes("rev") || metric.id.includes("adr")
                      ? formatCurrency(metric.value)
                      : String(Math.round(metric.value))
                  : String(metric.value)
              }
              trend={metric.trend}
              status={metric.status}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-zinc-800" />

        {/* Call Metrics */}
        <div className="space-y-2">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Call Performance
          </div>
          <MetricRow
            label="TODAY"
            value={String(metrics.calls.totalToday)}
            status="nominal"
          />
          <MetricRow
            label="AVG DURATION"
            value={`${Math.floor(metrics.calls.avgDuration / 60)}m ${metrics.calls.avgDuration % 60}s`}
            status="nominal"
          />
          <MetricRow
            label="ABANDON"
            value={formatPercentage(metrics.calls.abandonRate)}
            status={metrics.calls.abandonRate > 5 ? "warning" : "nominal"}
          />
          <MetricRow
            label="MISSED"
            value={String(metrics.business.missedOpportunities)}
            status={
              metrics.business.missedOpportunities > 0 ? "warning" : "nominal"
            }
          />
        </div>
      </div>

      {/* Footer Status */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">Last Updated</span>
          <span className="font-mono text-[10px] text-zinc-500">
            {new Date().toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// METRIC ROW COMPONENT
// ============================================================================

interface MetricRowProps {
  label: string;
  value: string;
  trend?: "up" | "down" | "stable";
  status?: "nominal" | "warning" | "critical" | "active";
}

function MetricRow({
  label,
  value,
  trend,
  status = "nominal",
}: MetricRowProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const statusColors = {
    nominal: "text-white",
    warning: "text-amber-500",
    critical: "text-red-500",
    active: "text-indigo-400",
  };

  return (
    <div className="flex items-center justify-between rounded-md bg-zinc-900/50 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {trend && (
          <TrendIcon
            className={cn(
              "h-3 w-3",
              trend === "up"
                ? "text-green-500"
                : trend === "down"
                  ? "text-red-500"
                  : "text-zinc-600",
            )}
          />
        )}
        <span
          className={cn("font-mono text-sm tabular-nums", statusColors[status])}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
