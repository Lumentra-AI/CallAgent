"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { TenantTier } from "@/lib/api/admin";

const TIER_OPTIONS: { value: TenantTier; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

const TIER_FEATURES: Record<TenantTier, string[]> = {
  starter: [
    "Basic voice agent",
    "100 calls/month",
    "SMS confirmations",
    "Voicemail fallback",
  ],
  professional: [
    "Everything in Starter",
    "500 calls/month",
    "Live transfer",
    "Sentiment analysis",
    "Recording + transcription",
  ],
  enterprise: [
    "Everything in Professional",
    "Unlimited calls",
    "Custom integrations",
    "Priority support",
    "Dedicated SIP trunk",
  ],
};

interface TierChangeDialogProps {
  isOpen: boolean;
  currentTier: TenantTier;
  tenantName: string;
  onClose: () => void;
  onConfirm: (newTier: TenantTier) => Promise<void>;
}

export function TierChangeDialog({
  isOpen,
  currentTier,
  tenantName,
  onClose,
  onConfirm,
}: TierChangeDialogProps) {
  const [selectedTier, setSelectedTier] = useState<TenantTier>(currentTier);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (selectedTier === currentTier) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(selectedTier);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tier");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTier, currentTier, onConfirm, onClose]);

  if (!isOpen) return null;

  const isChanged = selectedTier !== currentTier;
  const isDowngrade =
    TIER_OPTIONS.findIndex((t) => t.value === selectedTier) <
    TIER_OPTIONS.findIndex((t) => t.value === currentTier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-dialog-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="tier-dialog-title"
            className="text-lg font-semibold text-zinc-900"
          >
            Change Subscription Tier
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition hover:text-zinc-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          Update the subscription tier for{" "}
          <span className="font-medium text-zinc-900">{tenantName}</span>.
        </p>

        <div className="mt-4 space-y-4">
          {/* Tier selector */}
          <div>
            <label
              htmlFor="new-tier"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              New tier
            </label>
            <select
              id="new-tier"
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as TenantTier)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            >
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.value === currentTier ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Feature summary */}
          {isChanged && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {selectedTier} tier includes
              </p>
              <ul className="mt-2 space-y-1">
                {TIER_FEATURES[selectedTier].map((feature) => (
                  <li key={feature} className="text-sm text-zinc-700">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Downgrade warning */}
          {isDowngrade && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Downgrading tier
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Some features may be disabled. Custom feature overrides will
                    be preserved, but features not available on the new tier may
                    stop working.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !isChanged}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Updating..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
