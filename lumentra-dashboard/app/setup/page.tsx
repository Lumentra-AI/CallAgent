"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfig } from "@/context/ConfigContext";
import { SetupConversation } from "@/components/setup";
import { Loader2 } from "lucide-react";

export default function SetupPage() {
  const { isConfigured, isLoading } = useConfig();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isConfigured) {
      router.replace("/dashboard");
    }
  }, [isConfigured, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isConfigured) {
    return null; // Will redirect
  }

  return <SetupConversation />;
}
