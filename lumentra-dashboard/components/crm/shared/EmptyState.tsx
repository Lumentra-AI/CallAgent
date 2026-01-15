"use client";

import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-zinc-900 p-4">
        <Icon className="h-8 w-8 text-zinc-500" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-zinc-200">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// PRESET EMPTY STATES
// ============================================================================

import { Users, Calendar, Bell, Package, Search, Filter } from "lucide-react";

export function EmptyContacts({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No contacts yet"
      description="Start building your contact list by adding your first contact."
      action={
        onAdd
          ? {
              label: "Add Contact",
              onClick: onAdd,
              icon: Users,
            }
          : undefined
      }
    />
  );
}

export function EmptyBookings({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No bookings scheduled"
      description="Create your first booking to get started."
      action={
        onAdd
          ? {
              label: "Create Booking",
              onClick: onAdd,
              icon: Calendar,
            }
          : undefined
      }
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={Bell}
      title="No notifications"
      description="Your notification queue is empty. Notifications will appear here when sent."
    />
  );
}

export function EmptyResources({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Package}
      title="No resources"
      description="Add staff members, rooms, or equipment to manage your resources."
      action={
        onAdd
          ? {
              label: "Add Resource",
              onClick: onAdd,
              icon: Package,
            }
          : undefined
      }
    />
  );
}

export function EmptySearchResults() {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description="Try adjusting your search terms or filters to find what you're looking for."
    />
  );
}

export function EmptyFilterResults({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={Filter}
      title="No matching results"
      description="No items match your current filters."
      action={
        onClear
          ? {
              label: "Clear Filters",
              onClick: onClear,
            }
          : undefined
      }
    />
  );
}
