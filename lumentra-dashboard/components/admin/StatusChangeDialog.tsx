"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { TenantStatus } from "@/lib/api/admin";

const STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "draft", label: "Draft" },
  { value: "pending_verification", label: "Pending Verification" },
];

interface StatusChangeDialogProps {
  isOpen: boolean;
  currentStatus: TenantStatus;
  tenantName: string;
  onClose: () => void;
  onConfirm: (newStatus: TenantStatus, reason?: string) => Promise<void>;
}

export function StatusChangeDialog({
  isOpen,
  currentStatus,
  tenantName,
  onClose,
  onConfirm,
}: StatusChangeDialogProps) {
  const [selectedStatus, setSelectedStatus] =
    useState<TenantStatus>(currentStatus);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (selectedStatus === currentStatus) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(
        selectedStatus,
        selectedStatus === "suspended" ? reason : undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedStatus, currentStatus, reason, onConfirm, onClose]);

  if (!isOpen) return null;

  const isSuspending = selectedStatus === "suspended";
  const isChanged = selectedStatus !== currentStatus;

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
        className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-dialog-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="status-dialog-title"
            className="text-lg font-semibold text-zinc-900"
          >
            Change Status
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
          Update the status for{" "}
          <span className="font-medium text-zinc-900">{tenantName}</span>.
        </p>

        <div className="mt-4 space-y-4">
          {/* Status selector */}
          <div>
            <label
              htmlFor="new-status"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              New status
            </label>
            <select
              id="new-status"
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as TenantStatus)
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.value === currentStatus ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Warning for suspension */}
          {isSuspending && currentStatus !== "suspended" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Suspending this tenant
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    The voice agent will stop answering calls for this business.
                    All dashboard access will be blocked.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason field for suspension */}
          {isSuspending && currentStatus !== "suspended" && (
            <div>
              <label
                htmlFor="status-reason"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Reason (optional)
              </label>
              <textarea
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why is this tenant being suspended?"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
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
