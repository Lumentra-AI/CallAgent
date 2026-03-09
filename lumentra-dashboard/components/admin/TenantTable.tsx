"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantStatusBadge } from "./TenantStatusBadge";
import { TenantTierBadge } from "./TenantTierBadge";
import type { AdminTenantListItem, TenantStatus } from "@/lib/api/admin";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(dateStr);
}

function formatIndustry(industry: string): string {
  return industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TenantTableProps {
  tenants: AdminTenantListItem[];
  isLoading: boolean;
  onToggleStatus: (tenantId: string, currentStatus: TenantStatus) => void;
  togglingIds: Set<string>;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-zinc-100">
      <td className="px-4 py-3.5">
        <div className="h-4 w-36 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-5 w-16 rounded-full bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-5 w-14 rounded-full bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-5 w-20 rounded-full bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-4 w-28 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-4 w-10 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-4 w-16 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-4 w-20 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-7 w-7 rounded-lg bg-zinc-100" />
      </td>
    </tr>
  );
}

export function TenantTable({
  tenants,
  isLoading,
  onToggleStatus,
  togglingIds,
}: TenantTableProps) {
  const router = useRouter();

  const handleRowClick = useCallback(
    (tenantId: string) => {
      router.push(`/admin/tenants/${tenantId}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Business Name</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Calls (30d)</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-900">No tenants found</p>
        <p className="mt-1 text-sm text-zinc-500">
          Try adjusting your search or filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3">Business Name</th>
            <th className="px-4 py-3">Industry</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Calls (30d)</th>
            <th className="px-4 py-3">Last Active</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 w-16" />
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => {
            const isToggling = togglingIds.has(tenant.id);
            const canToggle =
              tenant.status === "active" || tenant.status === "suspended";

            return (
              <tr
                key={tenant.id}
                onClick={() => handleRowClick(tenant.id)}
                className="cursor-pointer border-t border-zinc-100 text-zinc-700 transition hover:bg-zinc-50"
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(tenant.id);
                  }
                }}
              >
                <td className="px-4 py-3.5">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {tenant.business_name}
                    </p>
                    {tenant.contact_email && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {tenant.contact_email}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                    {formatIndustry(tenant.industry)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <TenantStatusBadge status={tenant.status} />
                </td>
                <td className="px-4 py-3.5">
                  <TenantTierBadge tier={tenant.subscription_tier} />
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-zinc-600">
                  {tenant.phone_number.startsWith("pending_")
                    ? "Not set"
                    : tenant.phone_number}
                </td>
                <td className="px-4 py-3.5 tabular-nums text-zinc-600">
                  {parseInt(tenant.calls_30d, 10).toLocaleString()}
                </td>
                <td className="px-4 py-3.5 text-zinc-500">
                  {formatRelativeDate(tenant.last_call_at)}
                </td>
                <td className="px-4 py-3.5 text-zinc-500">
                  {formatDate(tenant.created_at)}
                </td>
                <td className="px-4 py-3.5">
                  {canToggle && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStatus(tenant.id, tenant.status);
                      }}
                      disabled={isToggling}
                      className={cn(
                        "rounded-lg p-1.5 transition",
                        tenant.status === "active"
                          ? "text-amber-600 hover:bg-amber-50"
                          : "text-emerald-600 hover:bg-emerald-50",
                        isToggling && "opacity-50",
                      )}
                      title={
                        tenant.status === "active"
                          ? "Suspend tenant"
                          : "Activate tenant"
                      }
                      aria-label={
                        tenant.status === "active"
                          ? `Suspend ${tenant.business_name}`
                          : `Activate ${tenant.business_name}`
                      }
                    >
                      {isToggling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : tenant.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
