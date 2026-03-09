"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { TenantStatus, TenantTier } from "@/lib/api/admin";

const STATUS_OPTIONS: { value: TenantStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "draft", label: "Draft" },
  { value: "pending_verification", label: "Pending" },
];

const TIER_OPTIONS: { value: TenantTier | ""; label: string }[] = [
  { value: "", label: "All tiers" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

const INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All industries" },
  { value: "hotel", label: "Hotel" },
  { value: "motel", label: "Motel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "medical", label: "Medical" },
  { value: "dental", label: "Dental" },
  { value: "salon", label: "Salon" },
  { value: "auto_service", label: "Auto Service" },
  { value: "pending_setup", label: "Pending Setup" },
];

interface TenantFiltersProps {
  search: string;
  status: TenantStatus | "";
  tier: TenantTier | "";
  industry: string;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: TenantStatus | "") => void;
  onTierChange: (tier: TenantTier | "") => void;
  onIndustryChange: (industry: string) => void;
}

export function TenantFilters({
  search,
  status,
  tier,
  industry,
  onSearchChange,
  onStatusChange,
  onTierChange,
  onIndustryChange,
}: TenantFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Sync external search changes
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = (value: string) => {
    setLocalSearch(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  const hasActiveFilters =
    search !== "" || status !== "" || tier !== "" || industry !== "";

  const clearAllFilters = () => {
    setLocalSearch("");
    onSearchChange("");
    onStatusChange("");
    onTierChange("");
    onIndustryChange("");
  };

  const selectClasses =
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400";

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-10 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
        />
        {localSearch && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-400 transition hover:text-zinc-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as TenantStatus | "")}
          className={selectClasses}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={tier}
          onChange={(e) => onTierChange(e.target.value as TenantTier | "")}
          className={selectClasses}
          aria-label="Filter by tier"
        >
          {TIER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={industry}
          onChange={(e) => onIndustryChange(e.target.value)}
          className={selectClasses}
          aria-label="Filter by industry"
        >
          {INDUSTRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
