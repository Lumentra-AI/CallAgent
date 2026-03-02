"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/lib/docs/sections";

interface DocsTOCProps {
  headings: TocItem[];
}

export function DocsTOC({ headings }: DocsTOCProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px", threshold: 0.1 },
    );

    const allIds = headings.flatMap((h) => [
      h.id,
      ...h.children.map((c) => c.id),
    ]);

    for (const id of allIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div className="w-56 shrink-0 hidden xl:block">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          On this page
        </p>
        <ul className="space-y-1">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={cn(
                  "block text-[13px] py-1 transition-colors",
                  activeId === h.id
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {h.text}
              </a>
              {h.children.length > 0 && (
                <ul className="ml-3 space-y-0.5">
                  {h.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        className={cn(
                          "block text-xs py-0.5 transition-colors",
                          activeId === child.id
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {child.text}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
