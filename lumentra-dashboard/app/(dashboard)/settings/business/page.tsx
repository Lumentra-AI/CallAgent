"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/context/TenantContext";
import { put } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Building2, MapPin, Check, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import type { IndustryType } from "@/types";
import { INDUSTRY_PRESETS } from "@/lib/industryPresets";

interface BusinessSettings {
  business_name: string;
  industry: IndustryType | null;
  location_city: string;
  location_address: string;
}

export default function BusinessSettingsPage() {
  const { currentTenant, refreshTenants } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<BusinessSettings>({
    business_name: "",
    industry: null,
    location_city: "",
    location_address: "",
  });

  const industries = Object.values(INDUSTRY_PRESETS);

  useEffect(() => {
    if (currentTenant) {
      setFormData({
        business_name: currentTenant.business_name || "",
        industry: (currentTenant.industry as IndustryType) || null,
        location_city: currentTenant.location_city || "",
        location_address: currentTenant.location_address || "",
      });
      setIsLoading(false);
    }
  }, [currentTenant]);

  const handleSelectIndustry = (industry: IndustryType) => {
    setFormData((prev) => ({ ...prev, industry }));
    setSaveSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!currentTenant) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await put(`/api/tenants/${currentTenant.id}`, {
        business_name: formData.business_name,
        industry: formData.industry,
        location_city: formData.location_city,
        location_address: formData.location_address,
      });
      await refreshTenants();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    formData.business_name.trim() !== "" && formData.industry !== null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {/* Header */}
        <div>
          <Link
            href="/settings"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Business Information
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your business identity and location
          </p>
        </div>

        {/* Business name */}
        <div className="space-y-2">
          <Label htmlFor="business-name">Business Name</Label>
          <Input
            id="business-name"
            placeholder="Sunrise Dental"
            value={formData.business_name}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                business_name: e.target.value,
              }));
              setSaveSuccess(false);
              setError(null);
            }}
          />
        </div>

        {/* Industry selection - matches setup wizard style */}
        <div className="space-y-4">
          <Label>Industry</Label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry) => {
              const isSelected = formData.industry === industry.id;

              return (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => handleSelectIndustry(industry.id)}
                  className={cn(
                    "relative w-full rounded-xl border p-4 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "mb-3 flex h-10 w-10 items-center justify-center rounded-lg",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>

                  <h3 className="text-base font-semibold text-foreground">
                    {industry.label}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {industry.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city">City / Region</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="city"
                placeholder="Austin, TX"
                value={formData.location_city}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    location_city: e.target.value,
                  }));
                  setSaveSuccess(false);
                  setError(null);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">
              Full Address{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="address"
              placeholder="123 Main St, Austin, TX 78701"
              value={formData.location_address}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  location_address: e.target.value,
                }));
                setSaveSuccess(false);
                setError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Used to give directions to callers
            </p>
          </div>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-600">
            Settings saved successfully
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            size="lg"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
