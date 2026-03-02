import { DocsShell } from "@/components/docs/DocsShell";
import { getAllGuidesWithSections } from "@/lib/docs/sections";
import { buildSearchIndex } from "@/lib/docs/search-index";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allGuides = getAllGuidesWithSections();
  const searchEntries = buildSearchIndex();

  return (
    <div className="min-h-screen bg-background">
      <DocsShell allGuides={allGuides} searchEntries={searchEntries}>
        {children}
      </DocsShell>
    </div>
  );
}
