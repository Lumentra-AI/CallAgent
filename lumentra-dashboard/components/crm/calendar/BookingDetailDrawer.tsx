"use client";

import * as React from "react";
import {
  Phone,
  Mail,
  Clock,
  Calendar as CalendarIcon,
  Tag,
  Hash,
  User,
  PhoneCall,
  FileText,
  PlayCircle,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ui/source-badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { getBookingDetail, type BookingDetail } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDateTime(date?: string | null, time?: string | null): string {
  if (!date) return "--";
  const iso = time ? `${date}T${time}` : date;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "cancelled":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "completed":
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    default:
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
  }
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="text-sm text-zinc-100 break-words">{value || "--"}</div>
      </div>
    </div>
  );
}

export function BookingDetailDrawer({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<BookingDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!open || !bookingId) {
      setDetail(null);
      setError(null);
      setTranscriptExpanded(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBookingDetail(bookingId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="full"
        className="max-h-[90vh] overflow-hidden flex flex-col"
      >
        {loading && (
          <div className="flex flex-1 items-center justify-center py-16 text-zinc-500">
            Loading booking...
          </div>
        )}

        {error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-red-400">
            <AlertCircle className="h-6 w-6" />
            <div>{error}</div>
          </div>
        )}

        {detail && !loading && !error && (
          <>
            <ModalHeader className="flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <ModalTitle className="flex items-center gap-2 truncate">
                    {detail.booking.customer_name}
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 text-xs font-medium",
                        statusTone(detail.booking.status),
                      )}
                    >
                      {detail.booking.status}
                    </span>
                    {detail.booking.source && (
                      <SourceBadge source={detail.booking.source} />
                    )}
                  </ModalTitle>
                  <ModalDescription>
                    {detail.booking.booking_type} ·{" "}
                    {formatDateTime(
                      detail.booking.booking_date,
                      detail.booking.booking_time,
                    )}
                  </ModalDescription>
                </div>
              </div>
            </ModalHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
              {/* Quick Facts */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  icon={Phone}
                  label="Phone"
                  value={
                    detail.booking.customer_phone ? (
                      <a
                        href={`tel:${detail.booking.customer_phone}`}
                        className="text-indigo-300 hover:underline"
                      >
                        {detail.booking.customer_phone}
                      </a>
                    ) : null
                  }
                />
                <Field
                  icon={Mail}
                  label="Email"
                  value={
                    detail.booking.customer_email ? (
                      <a
                        href={`mailto:${detail.booking.customer_email}`}
                        className="text-indigo-300 hover:underline"
                      >
                        {detail.booking.customer_email}
                      </a>
                    ) : null
                  }
                />
                <Field
                  icon={Tag}
                  label="Booked for"
                  value={detail.booking.booking_type}
                />
                <Field
                  icon={CalendarIcon}
                  label="Date & Time"
                  value={formatDateTime(
                    detail.booking.booking_date,
                    detail.booking.booking_time,
                  )}
                />
                <Field
                  icon={Clock}
                  label="Duration"
                  value={
                    detail.booking.duration_minutes
                      ? `${detail.booking.duration_minutes} min`
                      : null
                  }
                />
                <Field
                  icon={Hash}
                  label="Confirmation Code"
                  value={
                    <span className="font-mono">
                      {detail.booking.confirmation_code || null}
                    </span>
                  }
                />
              </div>

              {detail.booking.notes && (
                <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                    <FileText className="h-3.5 w-3.5" />
                    Booking notes
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-zinc-200">
                    {detail.booking.notes}
                  </div>
                </section>
              )}

              {/* Contact context */}
              {detail.contact && (
                <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                    <User className="h-3.5 w-3.5" />
                    Customer history
                  </div>
                  <div className="flex items-center gap-6 text-sm text-zinc-200">
                    <div>
                      <span className="font-semibold text-zinc-100">
                        {detail.contact.total_bookings}
                      </span>{" "}
                      total bookings
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-100">
                        {detail.contact.total_calls}
                      </span>{" "}
                      total calls
                    </div>
                  </div>
                  {detail.contact.notes && (
                    <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">
                      {detail.contact.notes}
                    </div>
                  )}
                </section>
              )}

              {/* Linked call: summary + transcript */}
              {detail.call ? (
                <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                      <PhoneCall className="h-3.5 w-3.5" />
                      Linked call · {formatDateTime(
                        detail.call.started_at,
                      )} · {formatDuration(detail.call.duration_seconds)}
                    </div>
                    {detail.call.recording_url && (
                      <a
                        href={detail.call.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:underline"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Recording
                      </a>
                    )}
                  </div>

                  {detail.call.summary ? (
                    <div className="border-b border-zinc-800 p-4">
                      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                        AI summary
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-zinc-100">
                        {detail.call.summary}
                      </div>
                    </div>
                  ) : null}

                  {detail.call.transcript ? (
                    <div className="p-4">
                      <button
                        type="button"
                        onClick={() => setTranscriptExpanded((v) => !v)}
                        className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
                      >
                        Transcript {transcriptExpanded ? "(hide)" : "(show)"}
                      </button>
                      {transcriptExpanded && (
                        <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs text-zinc-300">
                          {detail.call.transcript}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-zinc-500">
                      No transcript captured.
                    </div>
                  )}
                </section>
              ) : (
                <section className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
                  Booking was not created from a phone call. No transcript or AI
                  summary available.
                </section>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-6 py-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
