"use client";

import { useEffect, useInsertionEffect, useRef } from "react";
import { API_BASE, getTenantId } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

export type EscalationEventType =
  | "transfer_created"
  | "callback_queued"
  | "transfer_status_changed"
  | "queue_item_updated"
  | "connected"
  | "heartbeat";

export interface EscalationSSEEvent {
  type: EscalationEventType;
  tenantId: string;
  queueId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface UseEscalationEventsOptions {
  onEvent: (event: EscalationSSEEvent) => void;
  enabled?: boolean;
}

const EVENT_TYPES: EscalationEventType[] = [
  "transfer_created",
  "callback_queued",
  "transfer_status_changed",
  "queue_item_updated",
];

export function useEscalationEvents({
  onEvent,
  enabled = true,
}: UseEscalationEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  useInsertionEffect(() => {
    onEventRef.current = onEvent;
  });

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    let disposed = false;

    async function connect() {
      if (disposed) return;

      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || disposed) return;

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const tenantId = getTenantId();
      const tenantParam = tenantId
        ? `&tenantId=${encodeURIComponent(tenantId)}`
        : "";
      const url = `${API_BASE}/api/escalation/events?token=${encodeURIComponent(token)}${tenantParam}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      for (const type of EVENT_TYPES) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const event = JSON.parse(e.data) as EscalationSSEEvent;
            onEventRef.current(event);
          } catch {
            // Ignore parse errors
          }
        });
      }

      es.addEventListener("connected", () => {
        reconnectAttempts.current = 0;
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (disposed) return;

        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          30_000,
        );
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          void connect();
        }, delay);
      };
    }

    void connect();

    return () => {
      disposed = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled]);
}
