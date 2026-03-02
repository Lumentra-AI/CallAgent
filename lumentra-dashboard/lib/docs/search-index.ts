import { getAllGuidesWithSections } from "./sections";

export interface SearchEntry {
  title: string;
  guide: string;
  guideSlug: string;
  sectionSlug: string;
  headings: string[];
  excerpt: string;
  path: string;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+.*/gm, "") // remove headings
    .replace(/```[\s\S]*?```/g, "") // remove code blocks
    .replace(/`[^`]+`/g, "") // remove inline code
    .replace(/\|[^\n]+\|/g, "") // remove table rows
    .replace(/[-*+]\s/g, "") // remove list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links to text
    .replace(/[*_~]{1,3}/g, "") // remove emphasis markers
    .replace(/\n{2,}/g, "\n") // collapse blank lines
    .trim();
}

export function buildSearchIndex(): SearchEntry[] {
  const allGuides = getAllGuidesWithSections();
  const entries: SearchEntry[] = [];

  for (const { config, sections } of allGuides) {
    for (const section of sections) {
      const plainText = stripMarkdown(section.markdown);
      const excerpt = plainText.slice(0, 200);
      const headings = section.headings.flatMap((h) => [
        h.text,
        ...h.children.map((c) => c.text),
      ]);

      entries.push({
        title: section.title,
        guide: config.title,
        guideSlug: config.slug,
        sectionSlug: section.slug,
        headings,
        excerpt,
        path: `/docs/${config.slug}/${section.slug}`,
      });
    }
  }

  return entries;
}
