"use client";

import Link from "next/link";
import { guides } from "@/lib/docs/config";
import { getIcon } from "@/lib/docs/icons";
import { BookOpen } from "lucide-react";

// Section counts per guide (pre-computed to avoid fs on client)
const sectionCounts: Record<string, number> = {
  admin: 24,
  "voice-agent": 33,
  crm: 30,
  deployment: 22,
  technical: 26,
  troubleshooting: 14,
};

export default function DocsLandingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Documentation
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Everything you need to configure, deploy, and manage the Lumentra
          voice AI platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guides.map((guide) => {
          const Icon = getIcon(guide.iconName);
          const count = sectionCounts[guide.slug] || 0;

          return (
            <Link
              key={guide.slug}
              href={`/docs/${guide.slug}`}
              className="group rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {guide.title}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {guide.description}
              </p>
              <p className="text-xs text-muted-foreground">{count} sections</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
