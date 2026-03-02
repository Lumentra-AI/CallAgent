"use client";

import Link from "next/link";
import { ArrowLeft, Search, Zap } from "lucide-react";

interface DocsHeaderProps {
  onSearchOpen: () => void;
}

export function DocsHeader({ onSearchOpen }: DocsHeaderProps) {
  return (
    <header className="h-14 sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Lumentra</span>
          </Link>
          <span className="text-border">/</span>
          <Link
            href="/docs"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Documentation
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground rounded-lg border border-border hover:border-primary/30 hover:bg-muted transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search docs...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
