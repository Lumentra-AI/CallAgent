"use client";

import React, { useEffect, useState, useCallback } from "react";
import { get, put, post, del } from "@/lib/api/client";
import { useFeatures, type FeatureKey } from "@/context/FeatureContext";
import {
  Users,
  Check,
  Loader2,
  Shield,
  Mail,
  Clock,
  X,
  Send,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  allowed_pages: string[] | null;
  email: string | null;
  created_at: string;
  accepted_at: string | null;
}

// Page labels for the checkboxes
const PAGE_LABELS: Record<FeatureKey, string> = {
  dashboard: "Dashboard",
  workstation: "Workstation",
  calls: "Calls",
  contacts: "Contacts",
  chats: "Chats",
  escalations: "Escalations",
  pending: "Pending",
  calendar: "Calendar",
  deals: "Deals",
  tasks: "Tasks",
  analytics: "Analytics",
  resources: "Resources",
  notifications: "Notifications",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "readonly", label: "Read Only" },
];

export default function TeamTab() {
  const { features } = useFeatures();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [invitePages, setInvitePages] = useState<string[] | null>(null);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await get<{ members: TeamMember[] }>("/api/team");
      setMembers(data.members || []);
    } catch (err) {
      setError("Failed to load team members");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setInviting(true);
    try {
      const result = await post<{
        existing_user?: boolean;
        email_sent?: boolean;
      }>("/api/team/invite", {
        email,
        role: inviteRole,
        allowed_pages: invitePages,
      });
      if (result.existing_user) {
        setSuccessMsg(
          result.email_sent
            ? `Notification sent to ${email} -- they need to log in and accept`
            : `${email} was added (pending). Email could not be sent -- let them know to log in.`,
        );
      } else {
        setSuccessMsg(`Invite sent to ${email}`);
      }
      setInviteEmail("");
      setInviteRole("member");
      setInvitePages(null);
      setShowPagePicker(false);
      await fetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (memberId: string) => {
    clearMessages();
    setResending(memberId);
    try {
      await post(`/api/team/${memberId}/resend-invite`);
      setSuccessMsg("Invite resent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setResending(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    clearMessages();
    setRemoving(memberId);
    try {
      await del(`/api/team/${memberId}`);
      setSuccessMsg("Member removed");
      await fetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(null);
    }
  };

  const handleTogglePage = async (
    member: TeamMember,
    page: FeatureKey,
    checked: boolean,
  ) => {
    setSaving(member.id);
    clearMessages();

    const currentPages = member.allowed_pages || [...features];
    let newPages: string[];

    if (checked) {
      newPages = [...new Set([...currentPages, page])];
    } else {
      newPages = currentPages.filter((p) => p !== page);
    }

    const allChecked = features.every((f) => newPages.includes(f));

    try {
      await put(`/api/team/${member.id}`, {
        allowed_pages: allChecked ? null : newPages,
      });

      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, allowed_pages: allChecked ? null : newPages }
            : m,
        ),
      );
    } catch (err) {
      setError("Failed to update permissions");
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const handleToggleFullAccess = async (member: TeamMember) => {
    setSaving(member.id);
    clearMessages();

    const isCurrentlyFull = member.allowed_pages === null;
    const newPages = isCurrentlyFull ? [...features].slice(0, 3) : null;

    try {
      await put(`/api/team/${member.id}`, { allowed_pages: newPages });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, allowed_pages: newPages } : m,
        ),
      );
    } catch (err) {
      setError("Failed to update permissions");
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const isPageChecked = (member: TeamMember, page: FeatureKey): boolean => {
    if (member.allowed_pages === null) return true;
    return member.allowed_pages.includes(page);
  };

  const toggleInvitePage = (page: string) => {
    if (invitePages === null) {
      // Switching from full access to restricted
      setInvitePages(features.filter((f) => f !== page));
    } else {
      const has = invitePages.includes(page);
      const newPages = has
        ? invitePages.filter((p) => p !== page)
        : [...invitePages, page];
      // If all selected, revert to null (full access)
      setInvitePages(
        features.every((f) => newPages.includes(f)) ? null : newPages,
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Categorize members
  const owners = members.filter((m) => m.role === "owner");
  const acceptedMembers = members.filter(
    (m) => m.role !== "owner" && m.accepted_at !== null,
  );
  const pendingMembers = members.filter(
    (m) => m.role !== "owner" && m.accepted_at === null,
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Team Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Invite team members and control their page access.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Invite Form */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">
          Invite a team member
        </h3>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Invite
            </button>
          </div>

          {/* Page access toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowPagePicker(!showPagePicker)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showPagePicker ? "Hide" : "Customize"} page access
              {invitePages !== null && (
                <span className="ml-1 text-primary">
                  ({invitePages.length} pages)
                </span>
              )}
            </button>
            {showPagePicker && (
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-2 sm:grid-cols-4">
                {features.map((page) => {
                  const checked =
                    invitePages === null || invitePages.includes(page);
                  return (
                    <label
                      key={page}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                    >
                      <div
                        className={cn(
                          "flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background",
                        )}
                      >
                        {checked && <Check className="h-2.5 w-2.5" />}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleInvitePage(page)}
                      />
                      <span className="text-foreground">
                        {PAGE_LABELS[page] || page}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Owners */}
      {owners.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Owners (full access)
          </h3>
          {owners.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {member.email || "Unknown"}
              </span>
              <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Owner
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {pendingMembers.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Pending invites
          </h3>
          <div className="space-y-2">
            {pendingMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3"
              >
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-foreground">
                  {member.email || "Unknown"}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {member.role}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => handleResendInvite(member.id)}
                    disabled={resending === member.id}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Resend invite"
                  >
                    {resending === member.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Resend
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removing === member.id}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                    title="Revoke invite"
                  >
                    {removing === member.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted members */}
      {acceptedMembers.length === 0 && pendingMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No team members yet. Use the form above to invite someone.
          </p>
        </div>
      ) : (
        acceptedMembers.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Team members
            </h3>
            <div className="space-y-4">
              {acceptedMembers.map((member) => (
                <div
                  key={member.id}
                  className="rounded-lg border border-border bg-card"
                >
                  {/* Member header */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {member.email || "Unknown"}
                      </span>
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {member.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {saving === member.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      <button
                        onClick={() => handleToggleFullAccess(member)}
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                          member.allowed_pages === null
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {member.allowed_pages === null
                          ? "Full Access"
                          : "Restricted"}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removing === member.id}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Remove member"
                      >
                        {removing === member.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Page checkboxes */}
                  <div className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-3">
                    {features.map((page) => {
                      const checked = isPageChecked(member, page);
                      const disabled =
                        member.allowed_pages === null || saving === member.id;

                      return (
                        <label
                          key={page}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                            disabled ? "opacity-50" : "hover:bg-muted",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background",
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) =>
                              handleTogglePage(member, page, e.target.checked)
                            }
                          />
                          <span className="text-foreground">
                            {PAGE_LABELS[page] || page}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
