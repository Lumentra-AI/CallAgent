import fs from "fs";
import path from "path";
import { guides, type GuideConfig } from "./config";

export interface TocItem {
  id: string;
  text: string;
  level: number;
  children: TocItem[];
}

export interface Section {
  slug: string;
  title: string;
  markdown: string;
  headings: TocItem[];
  guideSlug: string;
}

export interface GuideWithSections {
  config: GuideConfig;
  sections: Section[];
}

function generateSlug(title: string): string {
  return title
    .replace(/^\d+\.\s*/, "") // strip leading number prefix "1. "
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{3,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/^\d+\.\d+\s*/, "").trim();
      const id = generateSlug(text);
      headings.push({ id, text, level, children: [] });
    }
  }

  // Nest h4s under their preceding h3
  const nested: TocItem[] = [];
  let currentH3: TocItem | null = null;

  for (const h of headings) {
    if (h.level === 3) {
      currentH3 = { ...h, children: [] };
      nested.push(currentH3);
    } else if (h.level === 4 && currentH3) {
      currentH3.children.push(h);
    } else {
      nested.push(h);
    }
  }

  return nested;
}

function getContentDir(): string {
  return path.join(process.cwd(), "content", "docs");
}

export function getSections(guideConfig: GuideConfig): Section[] {
  const filePath = path.join(getContentDir(), guideConfig.filename);
  const raw = fs.readFileSync(filePath, "utf-8");

  // Split by h2 headings
  const parts = raw.split(/\n(?=## )/);
  const sections: Section[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Extract the h2 title
    const titleMatch = part.match(/^## (.+)/);
    if (!titleMatch) {
      // First chunk before any h2 -- skip or treat as overview
      if (i === 0 && part.length > 100) {
        sections.push({
          slug: "overview",
          title: "Overview",
          markdown: part,
          headings: extractHeadings(part),
          guideSlug: guideConfig.slug,
        });
      }
      continue;
    }

    const title = titleMatch[1].trim();
    const slug = generateSlug(title);
    const headings = extractHeadings(part);

    sections.push({
      slug,
      title: title.replace(/^\d+\.\s*/, ""),
      markdown: part,
      headings,
      guideSlug: guideConfig.slug,
    });
  }

  return sections;
}

export function getAllGuidesWithSections(): GuideWithSections[] {
  return guides.map((config) => ({
    config,
    sections: getSections(config),
  }));
}

export function getSection(
  guideSlug: string,
  sectionSlug: string,
): { section: Section; guideConfig: GuideConfig } | null {
  const guideConfig = guides.find((g) => g.slug === guideSlug);
  if (!guideConfig) return null;

  const sections = getSections(guideConfig);
  const section = sections.find((s) => s.slug === sectionSlug);
  if (!section) return null;

  return { section, guideConfig };
}

export function getAdjacentSections(
  guideSlug: string,
  sectionSlug: string,
): { prev: Section | null; next: Section | null } {
  const allGuides = getAllGuidesWithSections();
  const flatSections: Section[] = allGuides.flatMap((g) => g.sections);

  const currentIndex = flatSections.findIndex(
    (s) => s.guideSlug === guideSlug && s.slug === sectionSlug,
  );

  return {
    prev: currentIndex > 0 ? flatSections[currentIndex - 1] : null,
    next:
      currentIndex < flatSections.length - 1
        ? flatSections[currentIndex + 1]
        : null,
  };
}
