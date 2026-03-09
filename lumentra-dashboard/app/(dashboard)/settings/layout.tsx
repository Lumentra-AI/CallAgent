"use client";

import SettingsSidebar from "@/components/settings/SettingsSidebar";
import { useConfig } from "@/context/ConfigContext";
import { Settings } from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { config } = useConfig();
  const userRole = config?.userRole;
  const isStaff = userRole === "staff";

  // Staff gets no settings access
  if (isStaff) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Settings className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Settings Access Restricted
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Contact your administrator to modify agent settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <SettingsSidebar />
      <main className="flex-1 overflow-y-auto bg-background p-8 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
