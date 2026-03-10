// Escalation Event Bus
// In-memory pub/sub for real-time escalation queue updates
// Dashboard SSE endpoint subscribes per-tenant; tool actions publish events

export type EscalationEventType =
  | "transfer_created"
  | "callback_queued"
  | "transfer_status_changed"
  | "queue_item_updated";

export interface EscalationEvent {
  type: EscalationEventType;
  tenantId: string;
  queueId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type Listener = (event: EscalationEvent) => void;

class EscalationEventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(tenantId: string, listener: Listener): () => void {
    if (!this.listeners.has(tenantId)) {
      this.listeners.set(tenantId, new Set());
    }
    this.listeners.get(tenantId)!.add(listener);

    return () => {
      const tenantListeners = this.listeners.get(tenantId);
      if (tenantListeners) {
        tenantListeners.delete(listener);
        if (tenantListeners.size === 0) {
          this.listeners.delete(tenantId);
        }
      }
    };
  }

  publish(event: EscalationEvent): void {
    const tenantListeners = this.listeners.get(event.tenantId);
    if (!tenantListeners || tenantListeners.size === 0) return;

    for (const listener of tenantListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[ESCALATION_EVENTS] Listener error:", err);
      }
    }
  }

  getSubscriberCount(tenantId: string): number {
    return this.listeners.get(tenantId)?.size ?? 0;
  }
}

export const escalationEvents = new EscalationEventBus();
