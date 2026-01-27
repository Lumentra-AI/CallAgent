"use client";

import { SystemHealth, Waveform, ActivityLog } from "@/components/dashboard";

export default function DashboardPage() {
  return (
    <div className="grid h-full grid-cols-[240px_1fr_300px] overflow-hidden">
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
  );
}
