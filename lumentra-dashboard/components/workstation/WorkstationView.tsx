"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useIndustry } from "@/context/IndustryContext";
import { getTemplateConfig } from "@/lib/templates";
import { useWorkstationData } from "@/hooks/useWorkstationData";
import { TodayPanel, type ScheduleItem } from "./TodayPanel";
import { QuickActions } from "./QuickActions";
import { ActivityFeed, type Activity } from "./ActivityFeed";
import { StatsSummary } from "./StatsSummary";
import { ContextPanel, InfoRow, Section } from "./ContextPanel";
import { WaitingRoom } from "./WaitingRoom";
import { ProviderAvailability } from "./ProviderAvailability";
import { RoomGrid } from "./RoomGrid";
import { VIPAlerts } from "./VIPAlerts";
import { Phone, Calendar, FileText, Edit, Loader2 } from "lucide-react";

interface WorkstationViewProps {
  className?: string;
}

// Union type for items that can be displayed in the context panel
type ContextItem = ScheduleItem | Activity;

// Type guard to check if an item is a ScheduleItem
function isScheduleItem(item: ContextItem): item is ScheduleItem {
  return "entityPhone" in item;
}

export function WorkstationView({ className }: WorkstationViewProps) {
  const { industry, tenant } = useIndustry();
  const router = useRouter();
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContextItem | null>(null);

  // Get template configuration based on industry
  const templateConfig = useMemo(() => getTemplateConfig(industry), [industry]);

  // Fetch real data from API
  const {
    todayBookings,
    recentActivity,
    stats,
    rooms,
    staffResources,
    waitingPatients,
    vipAlerts,
    primaryMetricValue,
    isLoading,
    error,
    refetch,
  } = useWorkstationData(tenant?.timezone);

  // Handle item selection from schedule - must be declared before early returns
  const handleScheduleItemClick = useCallback((item: ScheduleItem) => {
    setSelectedItem(item);
    setContextPanelOpen(true);
  }, []);

  // Handle item selection from activity feed - must be declared before early returns
  const handleActivityClick = useCallback((item: Activity) => {
    setSelectedItem(item);
    setContextPanelOpen(true);
  }, []);

  // Handle call action - must be declared before early returns
  const handleCallClick = useCallback((item: ScheduleItem) => {
    if (item.entityPhone) {
      window.open(`tel:${item.entityPhone}`);
    }
  }, []);

  // Close context panel - must be declared before early returns
  const closeContextPanel = useCallback(() => {
    setContextPanelOpen(false);
    setSelectedItem(null);
  }, []);

  // Render widget based on type
  const renderWidget = (widgetConfig: {
    type: string;
    title: string;
    size: string;
  }) => {
    const sizeClasses = {
      sm: "col-span-1",
      md: "col-span-1 md:col-span-1",
      lg: "col-span-1 md:col-span-2",
      xl: "col-span-1 md:col-span-2 lg:col-span-3",
      full: "col-span-full",
    };

    const sizeClass =
      sizeClasses[widgetConfig.size as keyof typeof sizeClasses] ||
      "col-span-1";

    switch (widgetConfig.type) {
      case "today-schedule":
        return (
          <TodayPanel
            key={widgetConfig.type}
            title={widgetConfig.title}
            items={todayBookings}
            onItemClick={handleScheduleItemClick}
            onCallClick={handleCallClick}
            className={sizeClass}
          />
        );
      case "quick-actions":
        return (
          <QuickActions
            key={widgetConfig.type}
            title={widgetConfig.title}
            actions={templateConfig.quickActions}
            className={sizeClass}
          />
        );
      case "activity-feed":
        return (
          <ActivityFeed
            key={widgetConfig.type}
            title={widgetConfig.title}
            activities={recentActivity}
            onActivityClick={handleActivityClick}
            className={sizeClass}
          />
        );
      case "stats-summary":
        return (
          <StatsSummary
            key={widgetConfig.type}
            title={widgetConfig.title}
            stats={stats}
            className={sizeClass}
          />
        );
      case "recent-calls":
        return (
          <ActivityFeed
            key={widgetConfig.type}
            title={widgetConfig.title}
            activities={recentActivity}
            maxItems={5}
            className={sizeClass}
          />
        );
      // Specialized widgets
      case "room-grid":
        return (
          <RoomGrid
            key={widgetConfig.type}
            title={widgetConfig.title}
            rooms={rooms}
            className={sizeClass}
          />
        );
      case "waitlist":
        return (
          <WaitingRoom
            key={widgetConfig.type}
            title={widgetConfig.title}
            patients={waitingPatients}
            className={sizeClass}
          />
        );
      case "availability":
        return (
          <ProviderAvailability
            key={widgetConfig.type}
            title={widgetConfig.title}
            providers={staffResources}
            className={sizeClass}
          />
        );
      case "notifications":
        return (
          <VIPAlerts
            key={widgetConfig.type}
            title={widgetConfig.title}
            alerts={vipAlerts}
            className={sizeClass}
          />
        );
      // Placeholder for widgets still in development
      case "table-map":
      case "escalation-queue":
        return (
          <div
            key={widgetConfig.type}
            className={cn(
              "card-soft flex items-center justify-center p-8",
              sizeClass,
            )}
          >
            <p className="text-sm text-muted-foreground">
              {widgetConfig.title} - Coming soon
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  // Context panel actions - only show call action for schedule items
  const contextPanelActions = selectedItem
    ? [
        ...(isScheduleItem(selectedItem) && selectedItem.entityPhone
          ? [
              {
                id: "call",
                label: "Call",
                icon: Phone,
                onClick: () => handleCallClick(selectedItem),
                variant: "primary" as const,
              },
            ]
          : []),
        {
          id: "edit",
          label: "Edit",
          icon: Edit,
          onClick: () => {
            router.push("/contacts");
            closeContextPanel();
          },
        },
      ]
    : [];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {templateConfig.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tenant?.business_name || "Your Business"} -{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Primary metric */}
        <div className="hidden sm:block text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {templateConfig.primaryMetric.label}
          </p>
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {isLoading ? (
              <Loader2 className="inline h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              primaryMetricValue
            )}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={refetch}
            className="text-xs font-medium text-red-500 hover:text-red-400 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading workstation data...
            </p>
          </div>
        </div>
      )}

      {/* Widget Grid -- render even while loading after first fetch for smooth updates */}
      {(!isLoading ||
        todayBookings.length > 0 ||
        recentActivity.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templateConfig.widgets
            .filter((w) => w.enabled)
            .sort((a, b) => a.order - b.order)
            .map(renderWidget)}
        </div>
      )}

      {/* Context Panel */}
      <ContextPanel
        open={contextPanelOpen}
        onClose={closeContextPanel}
        title={
          selectedItem
            ? isScheduleItem(selectedItem)
              ? selectedItem.entityName
              : selectedItem.title
            : "Details"
        }
        subtitle={selectedItem?.type || ""}
        actions={contextPanelActions}
      >
        {selectedItem && isScheduleItem(selectedItem) && (
          <div className="space-y-0">
            <Section title="Contact Information">
              {selectedItem.entityPhone && (
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={selectedItem.entityPhone}
                  onClick={() => handleCallClick(selectedItem)}
                />
              )}
              <InfoRow
                icon={Calendar}
                label="Scheduled"
                value={`${selectedItem.time} - ${selectedItem.type || "Appointment"}`}
              />
              <InfoRow
                icon={FileText}
                label="Status"
                value={
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      selectedItem.status === "completed" &&
                        "bg-green-500/10 text-green-500",
                      selectedItem.status === "in-progress" &&
                        "bg-amber-500/10 text-amber-500",
                      selectedItem.status === "confirmed" &&
                        "bg-blue-500/10 text-blue-500",
                      selectedItem.status === "pending" &&
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {selectedItem.status
                      .replace("-", " ")
                      .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </span>
                }
              />
            </Section>

            {selectedItem.notes && (
              <Section title="Notes">
                <p className="text-sm text-foreground">{selectedItem.notes}</p>
              </Section>
            )}

            <Section
              title="History"
              action={{
                label: "View all",
                onClick: () => router.push("/calls"),
              }}
            >
              <p className="text-sm text-muted-foreground">
                Previous visits and interactions will appear here.
              </p>
            </Section>
          </div>
        )}
        {selectedItem && !isScheduleItem(selectedItem) && (
          <div className="space-y-0">
            <Section title="Activity Details">
              <InfoRow
                icon={FileText}
                label="Type"
                value={selectedItem.type.replace(/_/g, " ")}
              />
              {selectedItem.description && (
                <InfoRow
                  icon={Calendar}
                  label="Description"
                  value={selectedItem.description}
                />
              )}
            </Section>
          </div>
        )}
      </ContextPanel>
    </div>
  );
}
