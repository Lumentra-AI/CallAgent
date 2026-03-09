"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { TenantFilters } from "@/components/admin/TenantFilters";
import { TenantTable } from "@/components/admin/TenantTable";
import {
  fetchAdminTenants,
  updateTenantStatus,
  type AdminTenantListItem,
  type TenantStatus,
  type TenantTier,
} from "@/lib/api/admin";

const PAGE_SIZE = 25;

export default function AdminTenantsPage() {
  // Data state
  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [tier, setTier] = useState<TenantTier | "">("");
  const [industry, setIndustry] = useState("");

  // Pagination
  const [page, setPage] = useState(0);

  // Quick action state
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const offset = page * PAGE_SIZE;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAdminTenants({
        search: search || undefined,
        status: status || undefined,
        tier: tier || undefined,
        industry: industry || undefined,
        limit: PAGE_SIZE,
        offset,
        sortBy: "created_at",
        sortOrder: "desc",
      });

      setTenants(result.tenants);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setIsLoading(false);
    }
  }, [search, status, tier, industry, offset]);

  // Load tenants on mount and when filters/pagination change
  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  // Reset to first page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleStatusChange = useCallback((value: TenantStatus | "") => {
    setStatus(value);
    setPage(0);
  }, []);

  const handleTierChange = useCallback((value: TenantTier | "") => {
    setTier(value);
    setPage(0);
  }, []);

  const handleIndustryChange = useCallback((value: string) => {
    setIndustry(value);
    setPage(0);
  }, []);

  // Quick toggle status (suspend/activate)
  const handleToggleStatus = useCallback(
    async (tenantId: string, currentStatus: TenantStatus) => {
      const newStatus: TenantStatus =
        currentStatus === "active" ? "suspended" : "active";

      setTogglingIds((prev) => new Set(prev).add(tenantId));

      try {
        await updateTenantStatus(tenantId, newStatus);

        // Update local state optimistically
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenantId
              ? {
                  ...t,
                  status: newStatus,
                  is_active: newStatus === "active",
                }
              : t,
          ),
        );
      } catch {
        // Reload on error to get correct state
        void loadTenants();
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(tenantId);
          return next;
        });
      }
    },
    [loadTenants],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-zinc-400" />
            <h1 className="text-2xl font-semibold text-zinc-950">Tenants</h1>
            {!isLoading && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                {total.toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Manage tenant lifecycle, subscription tiers, and platform access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTenants()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          aria-label="Refresh tenant list"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <TenantFilters
        search={search}
        status={status}
        tier={tier}
        industry={industry}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onTierChange={handleTierChange}
        onIndustryChange={handleIndustryChange}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">
            Failed to load tenants
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadTenants()}
            className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <TenantTable
          tenants={tenants}
          isLoading={isLoading}
          onToggleStatus={handleToggleStatus}
          togglingIds={togglingIds}
        />
      )}

      {/* Pagination */}
      {!error && !isLoading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3">
          <p className="text-sm text-zinc-600">
            Showing{" "}
            <span className="font-medium text-zinc-900">{showingFrom}</span>
            {" - "}
            <span className="font-medium text-zinc-900">{showingTo}</span>
            {" of "}
            <span className="font-medium text-zinc-900">
              {total.toLocaleString()}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>

            <span className="px-2 text-sm text-zinc-500">
              {page + 1} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
