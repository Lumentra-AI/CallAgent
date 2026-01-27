"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getEscalationQueue,
  getEscalationStats,
  getWaitingCount,
  type MockEscalation,
  type EscalationStatus,
  type EscalationPriority,
} from "@/lib/mock/escalations";

interface UseEscalationsOptions {
  status?: EscalationStatus;
  priority?: EscalationPriority;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseEscalationsReturn {
  // Data
  escalations: MockEscalation[];
  waitingCount: number;
  stats: {
    totalWaiting: number;
    urgent: number;
    high: number;
    avgWaitTime: number;
    longestWait: number;
  };

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => void;
  getEscalationById: (id: string) => MockEscalation | undefined;
}

export function useEscalations(
  options: UseEscalationsOptions = {},
): UseEscalationsReturn {
  const {
    status,
    priority,
    limit,
    autoRefresh = false,
    refreshInterval = 5000,
  } = options;

  const [escalations, setEscalations] = useState<MockEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEscalations = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const queue = getEscalationQueue({ status, priority, limit });
      setEscalations(queue);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load escalations",
      );
      setEscalations([]);
    } finally {
      setIsLoading(false);
    }
  }, [status, priority, limit]);

  // Initial load
  useEffect(() => {
    loadEscalations();
  }, [loadEscalations]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadEscalations, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadEscalations]);

  // Get stats
  const stats = getEscalationStats();
  const waitingCount = getWaitingCount();

  // Get by ID
  const getEscalationById = useCallback(
    (id: string) => escalations.find((e) => e.id === id),
    [escalations],
  );

  return {
    escalations,
    waitingCount,
    stats,
    isLoading,
    error,
    refresh: loadEscalations,
    getEscalationById,
  };
}

// Hook for just the queue stats (lightweight)
export function useEscalationQueueStats() {
  const [stats, setStats] = useState(() => getEscalationStats());
  const [waitingCount, setWaitingCount] = useState(() => getWaitingCount());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getEscalationStats());
      setWaitingCount(getWaitingCount());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { ...stats, waitingCount };
}
