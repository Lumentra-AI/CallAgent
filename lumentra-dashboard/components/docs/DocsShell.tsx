"use client";

import { useState, useEffect } from "react";
import { DocsHeader } from "./DocsHeader";
import { DocsSearch } from "./DocsSearch";
import { DocsSidebar } from "./DocsSidebar";
import type { SearchEntry } from "@/lib/docs/search-index";
import type { GuideWithSections } from "@/lib/docs/sections";

interface DocsShellProps {
  searchEntries: SearchEntry[];
  allGuides: GuideWithSections[];
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function DocsShell({
  searchEntries,
  allGuides,
  children,
  hideSidebar,
}: DocsShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <DocsHeader onSearchOpen={() => setSearchOpen(true)} />
      <DocsSearch
        entries={searchEntries}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      <div className="flex">
        {!hideSidebar && <DocsSidebar allGuides={allGuides} />}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </>
  );
}
