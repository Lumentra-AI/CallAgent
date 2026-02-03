"use client";

import {
  SystemHealth,
  Waveform,
  ActivityLog,
  SetupIncompleteBanner,
} from "@/components/dashboard";

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Setup Incomplete Banner - shows when tenant setup is incomplete */}
      <div className="flex-shrink-0 px-4 pt-4">
        <SetupIncompleteBanner />
      </div>

      {/* Main Dashboard Grid */}
      <div className="flex-1 grid grid-cols-[240px_1fr_300px] overflow-hidden">
        <div className="overflow-hidden border-r border-border">
          <SystemHealth />
        </div>
        <div className="overflow-hidden">
          <Waveform />
        </div>
        <div className="overflow-hidden">
          <ActivityLog />
        </div>
      </div>
    </div>
  );
}
