"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/context/TenantContext";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { useToast } from "@/context/ToastContext";
import { put } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Check, Phone, Loader2 } from "lucide-react";

export default function GeneralTab() {
  const { refreshCurrentTenant } = useTenant();
  const { toast } = useToast();
  const { tenant, error, clearError, updateSettings } = useTenantConfig();

  // Phone number local state (separate save logic)
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Initialize phone number from tenant
  useEffect(() => {
    if (tenant?.phone_number) {
      setPhoneNumber(tenant.phone_number);
    }
  }, [tenant?.phone_number]);

  const handlePhoneSave = async () => {
    if (!tenant) return;

    setPhoneSaving(true);
    setPhoneError(null);
    setPhoneSuccess(false);

    try {
      await put(`/api/tenants/${tenant.id}/phone`, {
        phone_number: phoneNumber,
      });
      setPhoneSuccess(true);
      toast.success(
        "Phone number updated",
        "Your business phone has been saved.",
      );
      await refreshCurrentTenant();
      setTimeout(() => setPhoneSuccess(false), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update phone number";
      setPhoneError(message);
      toast.error("Failed to save", message);
    } finally {
      setPhoneSaving(false);
    }
  };

  if (!tenant) return null;

  const isPhoneChanged = phoneNumber !== (tenant.phone_number || "");
  const isOwner = tenant.role === "owner";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Business Info
          </h3>
          <p className="text-sm text-muted-foreground">
            Your business name, address, and contact details
          </p>
        </div>
        {error && (
          <button
            onClick={clearError}
            className="text-sm text-destructive hover:underline"
          >
            {error}
          </button>
        )}
      </div>

      {/* Business Identity */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">
            Business Details
          </h4>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Business Name</Label>
            <Input
              value={tenant.business_name || ""}
              onChange={(e) =>
                updateSettings({ business_name: e.target.value })
              }
              placeholder="Your business name"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">City / Region</Label>
            <Input
              value={tenant.location_city || ""}
              onChange={(e) =>
                updateSettings({ location_city: e.target.value })
              }
              placeholder="e.g., Dallas, TX"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground">Address (optional)</Label>
          <Input
            value={tenant.location_address || ""}
            onChange={(e) =>
              updateSettings({ location_address: e.target.value })
            }
            placeholder="Street address"
          />
        </div>
      </section>

      {/* Phone Number */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Phone className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">Phone Number</h4>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground">Business Phone Number</Label>
          <div className="flex gap-2">
            <Input
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setPhoneError(null);
                setPhoneSuccess(false);
              }}
              placeholder="+1 (555) 123-4567"
              disabled={!isOwner}
            />
            <Button
              onClick={handlePhoneSave}
              disabled={!isOwner || !isPhoneChanged || phoneSaving}
              className="shrink-0"
            >
              {phoneSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : phoneSuccess ? (
                <Check className="h-4 w-4" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Incoming calls to this number are handled by your AI assistant.
          </p>
          {phoneError && (
            <p className="text-xs text-destructive">{phoneError}</p>
          )}
          {phoneSuccess && (
            <p className="text-xs text-green-600">Phone number updated</p>
          )}
          {!isOwner && (
            <p className="text-xs text-amber-600">
              Only the account owner can change the phone number.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
