"use client";

import React, { useEffect, useState, useCallback } from "react";
import { get, put } from "@/lib/api/client";
import { useFeatures, type FeatureKey } from "@/context/FeatureContext";
import { Users, Check, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  allowed_pages: string[] | null;
  email: string | null;
  created_at: string;
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

export default function TeamTab() {
  const { features } = useFeatures();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleTogglePage = async (
    member: TeamMember,
    page: FeatureKey,
    checked: boolean,
  ) => {
    setSaving(member.id);
    setError(null);

    // Compute new pages
    const currentPages = member.allowed_pages || [...features];
    let newPages: string[];

    if (checked) {
      newPages = [...new Set([...currentPages, page])];
    } else {
      newPages = currentPages.filter((p) => p !== page);
    }

    // If all features are checked, set to null (full access)
    const allChecked = features.every((f) => newPages.includes(f));

    try {
      await put(`/api/team/${member.id}`, {
        allowed_pages: allChecked ? null : newPages,
      });

      // Update local state
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
    setError(null);

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Separate owners from editable members
  const owners = members.filter((m) => m.role === "owner");
  const editableMembers = members.filter((m) => m.role !== "owner");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Team Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Control which pages each team member can access.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Owners -- shown but not editable */}
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

      {/* Editable members */}
      {editableMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No team members to manage. Invite members from the tenant settings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {editableMembers.map((member) => (
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
      )}
    </div>
  );
}
