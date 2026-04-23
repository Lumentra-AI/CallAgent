"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { get } from "@/lib/api/client";

export interface ChatSession {
  id: string;
  session_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  messages?: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  message_count: number;
  status: string;
  source_url: string | null;
  created_at: string;
  last_message_at: string;
  closed_at: string | null;
}

export interface ChatSessionsResponse {
  sessions: ChatSession[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChatSessionStats {
  totalSessions: number;
  activeSessions: number;
  avgMessages: number;
  leadsCaptured: number;
  sessionsToday: number;
  sessionsThisWeek: number;
}

interface UseChatSessionsOptions {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  pollInterval?: number;
}

export function useChatSessions(options: UseChatSessionsOptions = {}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchSessions = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const params: Record<string, string> = {};
        if (options.status) params.status = options.status;
        if (options.startDate) params.start_date = options.startDate;
        if (options.endDate) params.end_date = options.endDate;
        if (options.search) params.search = options.search;
        if (options.limit) params.limit = options.limit.toString();
        if (options.offset) params.offset = options.offset.toString();

        const response = await get<ChatSessionsResponse>(
          "/api/chat-sessions",
          params,
        );
        setSessions(response.sessions);
        setTotal(response.total);
        hasLoadedRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch chat sessions",
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [
      options.status,
      options.startDate,
      options.endDate,
      options.search,
      options.limit,
      options.offset,
    ],
  );

  useEffect(() => {
    fetchSessions(!hasLoadedRef.current);
  }, [fetchSessions]);

  // Auto-polling (silent)
  useEffect(() => {
    const interval = options.pollInterval ?? 15000;
    if (interval <= 0) return;

    const timer = setInterval(() => {
      fetchSessions(false);
    }, interval);

    return () => clearInterval(timer);
  }, [fetchSessions, options.pollInterval]);

  return { sessions, total, loading, error, refetch: fetchSessions };
}

export function useChatSession(id: string | null) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setSession(null);
      return;
    }

    const fetchSession = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await get<ChatSession>(`/api/chat-sessions/${id}`);
        setSession(response);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch chat session",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  return { session, loading, error };
}

export function useChatSessionStats() {
  const [stats, setStats] = useState<ChatSessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await get<ChatSessionStats>(
          "/api/chat-sessions/stats",
        );
        setStats(response);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch chat stats",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}
