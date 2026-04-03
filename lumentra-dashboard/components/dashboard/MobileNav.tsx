"use client";

import { useRouter, usePathname } from "next/navigation";
import { useIndustry } from "@/context/IndustryContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Phone,
  Calendar,
  Users,
  Settings,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

export default function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { preset } = useIndustry();

  const NAV_ITEMS: NavItem[] = [
    {
      id: "dashboard",
      label: "Home",
      icon: LayoutDashboard,
      href: "/dashboard",
    },
    { id: "calls", label: "Calls", icon: Phone, href: "/calls" },
    {
      id: "calendar",
      label: preset?.navLabels?.calendarTab || "Bookings",
      icon: Calendar,
      href: "/calendar",
    },
    {
      id: "contacts",
      label: preset?.terminology?.customerPlural || "Guests",
      icon: Users,
      href: "/contacts",
    },
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-inset">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
