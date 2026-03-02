"use client";

import * as React from "react";
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  User,
  Mail,
  Phone,
  Globe,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Column } from "@/components/crm/shared/DataTable";
import { Pagination } from "@/components/crm/shared/Pagination";
import {
  useChatSessions,
  useChatSession,
  useChatSessionStats,
  type ChatSession,
} from "@/hooks/useChatSessions";
import { cn } from "@/lib/utils";

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        isActive
          ? "border-green-500/20 bg-green-500/10 text-green-600"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-green-500" : "bg-muted-foreground",
        )}
      />
      {isActive ? "Active" : "Closed"}
    </span>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

// ============================================================================
// CHAT DETAIL PANEL
// ============================================================================

function ChatDetail({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { session, loading } = useChatSession(sessionId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Session not found
      </div>
    );
  }

  const visitorLabel =
    session.visitor_name ||
    session.visitor_email ||
    session.visitor_phone ||
    "Anonymous Visitor";

  return (
    <div className="border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{visitorLabel}</div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {session.visitor_email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {session.visitor_email}
                </span>
              )}
              {session.visitor_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {session.visitor_phone}
                </span>
              )}
              {session.source_url && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {new URL(session.source_url).pathname}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto p-6">
        <div className="space-y-3">
          {session.messages?.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              <p>{msg.content}</p>
              <p className="mt-1 text-[10px] opacity-60">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
          {(!session.messages || session.messages.length === 0) && (
            <p className="text-center text-sm text-muted-foreground">
              No messages in this session
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ChatsPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [offset, setOffset] = React.useState(0);
  const [limit, setLimit] = React.useState(20);
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset offset when filters change
  React.useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, statusFilter]);

  const { sessions, total, loading, error } = useChatSessions({
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    limit,
    offset,
  });

  const { stats } = useChatSessionStats();

  const columns: Column<ChatSession>[] = [
    {
      key: "visitor",
      header: "Visitor",
      render: (session) => {
        const name =
          session.visitor_name ||
          session.visitor_email ||
          session.visitor_phone;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className={cn(!name && "italic text-muted-foreground")}>
              {name || "Anonymous"}
            </span>
          </div>
        );
      },
    },
    {
      key: "messages",
      header: "Messages",
      width: "100px",
      align: "center",
      render: (session) => (
        <span className="text-sm text-muted-foreground">
          {session.message_count}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (session) => {
        if (!session.source_url)
          return <span className="text-muted-foreground">-</span>;
        try {
          const url = new URL(session.source_url);
          return (
            <span
              className="text-sm text-muted-foreground"
              title={session.source_url}
            >
              {url.pathname}
            </span>
          );
        } catch {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
      },
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (session) => <StatusBadge status={session.status} />,
    },
    {
      key: "last_message",
      header: "Last Message",
      width: "160px",
      render: (session) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(session.last_message_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Chat Sessions</h1>
              <p className="text-sm text-muted-foreground">
                Review conversations from your website chat widget
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 border-b border-border px-6 py-4 md:grid-cols-4">
          <StatCard
            label="Today"
            value={stats.sessionsToday}
            icon={MessageSquare}
          />
          <StatCard
            label="This Week"
            value={stats.sessionsThisWeek}
            icon={Clock}
          />
          <StatCard
            label="Avg Messages"
            value={stats.avgMessages}
            icon={MessageSquare}
          />
          <StatCard
            label="Leads Captured"
            value={stats.leadsCaptured}
            icon={User}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        <DataTable
          columns={columns}
          data={sessions}
          keyExtractor={(s) => s.id}
          isLoading={loading}
          emptyMessage="No chat sessions yet. Enable the chat widget in Settings to get started."
          onRowClick={(session) =>
            setSelectedSessionId(
              selectedSessionId === session.id ? null : session.id,
            )
          }
        />
      </div>

      {/* Detail Panel */}
      {selectedSessionId && (
        <ChatDetail
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="border-t border-border px-6 py-3">
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
            onLimitChange={setLimit}
          />
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
