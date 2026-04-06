"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConfig } from "@/context/ConfigContext";
import { useAdmin } from "@/context/AdminContext";
import { useFeatures, type FeatureKey } from "@/context/FeatureContext";
import { useEscalation } from "@/context/EscalationContext";
import type { ViewType } from "@/types";
import {
  LayoutDashboard,
  Phone,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Calendar,
  Bell,
  Package,
  Headphones,
  PhoneForwarded,
  User,
  Target,
  CheckSquare,
  Shield,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIndustry } from "@/context/IndustryContext";
import { useTenant } from "@/context/TenantContext";

// Route mapping for navigation
const VIEW_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  workstation: "/workstation",
  calls: "/calls",
  analytics: "/analytics",
  escalations: "/escalations",
  contacts: "/contacts",
  deals: "/deals",
  tasks: "/tasks",
  chats: "/chats",
  calendar: "/calendar",
  notifications: "/notifications",
  resources: "/resources",
  pending: "/pending",
  settings: "/settings",
  profile: "/profile",
  admin: "/admin/overview",
};

interface NavItem {
  id: string;
  featureKey?: FeatureKey;
  label: string;
  icon: React.ElementType;
  badge?: number;
  alwaysShow?: boolean;
}

// All possible nav items -- filtered by features at render time
const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: "workstation",
    featureKey: "workstation",
    label: "Workstation",
    icon: Headphones,
  },
  {
    id: "dashboard",
    featureKey: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  { id: "calls", featureKey: "calls", label: "Calls", icon: Phone },
  { id: "contacts", featureKey: "contacts", label: "Contacts", icon: Users },
  { id: "chats", featureKey: "chats", label: "Chats", icon: MessageSquare },
  {
    id: "escalations",
    featureKey: "escalations",
    label: "Escalations",
    icon: PhoneForwarded,
  },
  {
    id: "pending",
    featureKey: "pending",
    label: "Pending",
    icon: ClipboardList,
  },
  { id: "calendar", featureKey: "calendar", label: "Calendar", icon: Calendar },
  { id: "deals", featureKey: "deals", label: "Deals", icon: Target },
  { id: "tasks", featureKey: "tasks", label: "Tasks", icon: CheckSquare },
  {
    id: "analytics",
    featureKey: "analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    id: "resources",
    featureKey: "resources",
    label: "Resources",
    icon: Package,
  },
  {
    id: "notifications",
    featureKey: "notifications",
    label: "Notifications",
    icon: Bell,
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "profile", label: "Profile", icon: User, alwaysShow: true },
  { id: "settings", label: "Settings", icon: Settings, alwaysShow: true },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { config, uiState, setView, toggleSidebar } = useConfig();
  const { isPlatformAdmin } = useAdmin();
  const { hasFeature } = useFeatures();
  const { waitingCount } = useEscalation();
  const { dealPluralLabel, preset } = useIndustry();
  const { sidebarCollapsed } = uiState;

  // Filter nav items by enabled features
  const visibleNavItems = React.useMemo(() => {
    return ALL_NAV_ITEMS.filter((item) => {
      if (!item.featureKey) return true;
      return hasFeature(item.featureKey);
    });
  }, [hasFeature]);

  // Industry-specific label overrides
  const getLabel = (item: NavItem): string => {
    if (item.id === "contacts" && preset?.terminology?.customerPlural) {
      return preset.terminology.customerPlural;
    }
    if (item.id === "deals") return dealPluralLabel;
    if (item.id === "calendar" && preset?.terminology?.transactionPlural) {
      return preset.terminology.transactionPlural;
    }
    return item.label;
  };

  // Badge counts
  const getBadge = (item: NavItem): number | undefined => {
    if (item.id === "escalations" && waitingCount > 0) return waitingCount;
    return item.badge;
  };

  // Determine active state from pathname
  const currentPath = React.useMemo(() => {
    return pathname?.replace("/", "") || "dashboard";
  }, [pathname]);

  const handleNavClick = (viewId: string) => {
    const route = VIEW_ROUTES[viewId];
    if (!route) return;

    // Update ConfigContext view for ViewType items
    const viewTypeItems = [
      "dashboard",
      "calls",
      "analytics",
      "contacts",
      "deals",
      "tasks",
      "calendar",
      "notifications",
      "resources",
      "settings",
    ];
    if (viewTypeItems.includes(viewId)) {
      setView(viewId as ViewType);
    }
    router.push(route);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.id === "admin"
        ? Boolean(pathname?.startsWith("/admin"))
        : currentPath === item.id;
    const Icon = item.icon;
    const label = getLabel(item);
    const badge = getBadge(item);

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          sidebarCollapsed && "justify-center px-2",
        )}
        title={sidebarCollapsed ? label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed && <span className="flex-1 text-left">{label}</span>}
        {!sidebarCollapsed && badge !== undefined && badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
            {badge}
          </span>
        )}
      </button>
    );
  };

  // Build bottom items with conditional admin
  const bottomItems = React.useMemo(() => {
    const items = [...BOTTOM_ITEMS];
    if (isPlatformAdmin) {
      items.push({
        id: "admin",
        label: "Admin Panel",
        icon: Shield,
        alwaysShow: true,
      });
    }
    return items;
  }, [isPlatformAdmin]);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-56",
      )}
    >
      {/* Logo Area */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sidebar-foreground">
              Lumentra
            </span>
          </div>
        )}
        {sidebarCollapsed && <Zap className="mx-auto h-5 w-5 text-primary" />}
      </div>

      {/* Main Navigation -- flat list, no section groupings */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
        {visibleNavItems.map(renderNavItem)}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        {bottomItems.map(renderNavItem)}

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Business Info + Tenant Switcher */}
      {!sidebarCollapsed && config && (
        <TenantSwitcher
          businessName={config.businessName}
          agentName={config.agentName}
        />
      )}
    </aside>
  );
}

// -----------------------------------------------------------------------
// Tenant Switcher (shown at sidebar bottom)
// -----------------------------------------------------------------------
function TenantSwitcher({
  businessName,
  agentName,
}: {
  businessName: string;
  agentName: string;
}) {
  const { tenants, currentTenant, selectTenant } = useTenant();
  const [open, setOpen] = React.useState(false);

  // Only show switcher if user has multiple tenants
  const hasMultiple = tenants.length > 1;

  return (
    <div className="relative border-t border-sidebar-border p-4">
      <button
        type="button"
        onClick={() => hasMultiple && setOpen(!open)}
        className={cn(
          "w-full text-left",
          hasMultiple &&
            "cursor-pointer rounded-lg p-1 -m-1 hover:bg-sidebar-accent/50 transition-colors",
        )}
      >
        <div className="mb-1 truncate text-sm font-medium text-sidebar-foreground">
          {businessName}
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-xs text-muted-foreground">
            {agentName} Agent
          </span>
          {hasMultiple && (
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </div>
      </button>

      {open && hasMultiple && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 z-50 mb-1 rounded-xl border border-sidebar-border bg-sidebar p-1 shadow-lg">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Switch workspace
            </p>
            {tenants.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  selectTenant(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  currentTenant?.id === t.id
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-primary" />
                </div>
                <span className="truncate">{t.business_name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
