"use client";

import { SetupIncompleteBanner } from "@/components/dashboard";
import OperationsBoard from "@/components/dashboard/OperationsBoard";

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4">
        <SetupIncompleteBanner />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <OperationsBoard />
      </div>
    </div>
  );
}
