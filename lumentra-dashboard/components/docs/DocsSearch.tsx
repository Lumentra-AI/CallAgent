"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchEntry } from "@/lib/docs/search-index";

interface DocsSearchProps {
  entries: SearchEntry[];
  open: boolean;
  onClose: () => void;
}

export function DocsSearch({ entries, open, onClose }: DocsSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    if (query.length <= 1) return [];
    const q = query.toLowerCase();
    return entries
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.guide.toLowerCase().includes(q) ||
          e.headings.some((h) => h.toLowerCase().includes(q)) ||
          e.excerpt.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, entries]);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
      setQuery("");
    },
    [router, onClose],
  );

  // Reset state when dialog opens/closes
  const prevOpen = useRef(open);
  useEffect(() => {
    if (open && !prevOpen.current) {
      // Just opened
      inputRef.current?.focus();
    }
    if (!open && prevOpen.current) {
      // Just closed - reset on next tick
      requestAnimationFrame(() => {
        setQuery("");
        setSelectedIndex(0);
      });
    }
    prevOpen.current = open;
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }

      if (!open) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        navigate(results[selectedIndex].path);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, results, selectedIndex, navigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-w-xl mx-auto mt-[15vh]">
        <div className="bg-background rounded-xl border border-border shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search documentation..."
              className="flex-1 py-3.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {query.length > 1 && (
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No results found for &quot;{query}&quot;
                </p>
              ) : (
                results.map((entry, i) => (
                  <button
                    key={entry.path}
                    onClick={() => navigate(entry.path)}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      i === selectedIndex
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-muted text-muted-foreground",
                    )}
                  >
                    <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.guide}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {query.length <= 1 && (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Type to search across all documentation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
