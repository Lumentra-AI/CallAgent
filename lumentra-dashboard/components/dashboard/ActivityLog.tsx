"use client";

import React, { useRef, useEffect } from "react";
import { useLogs } from "@/context/ConfigContext";
import { formatTimestamp } from "@/lib/mockData";
import type { LogEntry, LogLevel, LogCategory } from "@/types";
import { cn } from "@/lib/utils";
import { Terminal, Pause, Play, Trash2 } from "lucide-react";

// ============================================================================
// LOG COLORS
// ============================================================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: "text-zinc-500",
  INFO: "text-blue-400",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
  CRITICAL: "text-red-500 font-bold",
};

const CATEGORY_COLORS: Record<LogCategory, string> = {
  SYSTEM: "text-zinc-400",
  CALL: "text-green-400",
  INTENT: "text-indigo-400",
  BOOKING: "text-emerald-400",
  PAYMENT: "text-yellow-400",
  TRANSFER: "text-violet-400",
  ERROR: "text-red-400",
  SECURITY: "text-orange-400",
};

// ============================================================================
// ACTIVITY LOG COMPONENT - Right Column
// ============================================================================

export default function ActivityLog() {
  const { logs, addLog } = useLogs();
  const [isPaused, setIsPaused] = React.useState(false);
  const [filter, setFilter] = React.useState<LogLevel | "ALL">("ALL");
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!isPaused && shouldScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0; // Logs are newest first
    }
  }, [logs, isPaused]);

  // Handle scroll to detect manual scrolling
  const handleScroll = () => {
    if (scrollRef.current) {
      shouldScrollRef.current = scrollRef.current.scrollTop < 50;
    }
  };

  // Filter logs
  const filteredLogs =
    filter === "ALL" ? logs : logs.filter((log) => log.level === filter);

  // Clear logs (add a clear marker)
  const handleClear = () => {
    addLog({
      level: "INFO",
      category: "SYSTEM",
      message: "--- LOG CLEARED ---",
    });
  };

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-500" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Activity Log
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogLevel | "ALL")}
            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400 focus:border-zinc-700 focus:outline-none"
          >
            <option value="ALL">ALL</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="DEBUG">DEBUG</option>
          </select>

          {/* Pause/Play */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <Play className="h-3 w-3" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            title="Clear"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Log Entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs scrollbar-thin"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-600">
            No log entries
          </div>
        ) : (
          <div className="space-y-0">
            {filteredLogs.map((log) => (
              <LogLine key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-1.5">
        <span className="text-[10px] text-zinc-600">
          {filteredLogs.length} entries
        </span>
        {isPaused && <span className="text-[10px] text-amber-500">PAUSED</span>}
      </div>
    </div>
  );
}

// ============================================================================
// LOG LINE COMPONENT
// ============================================================================

function LogLine({ log }: { log: LogEntry }) {
  return (
    <div className="group flex gap-2 border-b border-zinc-900 px-3 py-1.5 hover:bg-zinc-900/50">
      {/* Timestamp */}
      <span className="shrink-0 text-zinc-600">
        [{formatTimestamp(log.timestamp)}]
      </span>

      {/* Level */}
      <span className={cn("w-8 shrink-0", LEVEL_COLORS[log.level])}>
        {log.level.slice(0, 4)}
      </span>

      {/* Category */}
      <span className={cn("w-16 shrink-0", CATEGORY_COLORS[log.category])}>
        {log.category}
      </span>

      {/* Message */}
      <span className="truncate text-zinc-300">{log.message}</span>
    </div>
  );
}
