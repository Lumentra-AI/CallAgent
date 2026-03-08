"use client";

import { useConfig } from "@/context/ConfigContext";
import { CreditCard } from "lucide-react";

export default function BillingTab() {
  const { config } = useConfig();

  if (!config) return null;

  return (
    <div className="max-w-2xl">
      <section className="relative rounded-2xl border border-border bg-card p-8">
        <span className="absolute right-4 top-4 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Coming Soon
        </span>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <CreditCard className="h-7 w-7 text-muted-foreground" />
          </div>

          <h3 className="mt-5 text-lg font-semibold text-foreground">
            Billing & Subscription
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Billing management coming soon.
          </p>

          <p className="mt-4 text-sm text-muted-foreground">
            Contact{" "}
            <a
              href="mailto:support@lumentra.ai"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              support@lumentra.ai
            </a>{" "}
            for subscription changes or billing inquiries.
          </p>
        </div>
      </section>
    </div>
  );
}
