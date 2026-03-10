"use client";

import SettingsSidebar from "@/components/settings/SettingsSidebar";
import TeamTab from "@/components/settings/TeamTab";

export default function TeamSettingsPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <SettingsSidebar />
      <div className="flex-1 overflow-y-auto">
        <TeamTab />
      </div>
    </div>
  );
}
