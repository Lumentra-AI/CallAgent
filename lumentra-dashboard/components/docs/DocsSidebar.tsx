"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/docs/icons";
import type { GuideWithSections } from "@/lib/docs/sections";

interface DocsSidebarProps {
  allGuides: GuideWithSections[];
}

export function DocsSidebar({ allGuides }: DocsSidebarProps) {
  const pathname = usePathname();
  const activeGuideSlug = pathname.split("/")[2] || "";

  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of allGuides) {
      initial[g.config.slug] = g.config.slug === activeGuideSlug;
    }
    return initial;
  });

  function toggleGuide(slug: string) {
    setOpenGuides((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  return (
    <nav className="w-64 shrink-0 border-r border-border bg-background overflow-y-auto h-[calc(100vh-3.5rem)] sticky top-14">
      <div className="p-4">
        <Link
          href="/docs"
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          Documentation
        </Link>
      </div>

      <div className="px-2 pb-6">
        {allGuides.map(({ config, sections }) => {
          const Icon = getIcon(config.iconName);
          const isOpen = openGuides[config.slug];
          const isActiveGuide = config.slug === activeGuideSlug;

          return (
            <div key={config.slug} className="mb-1">
              <button
                onClick={() => toggleGuide(config.slug)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors",
                  isActiveGuide
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {config.title}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen && (
                <div className="ml-4 pl-3 border-l border-border mt-1 space-y-0.5">
                  {sections.map((section) => {
                    const href = `/docs/${config.slug}/${section.slug}`;
                    const isActive = pathname === href;

                    return (
                      <Link
                        key={section.slug}
                        href={href}
                        className={cn(
                          "block px-2 py-1.5 text-[13px] rounded-md transition-colors",
                          isActive
                            ? "text-primary font-medium bg-primary/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        )}
                      >
                        {section.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
