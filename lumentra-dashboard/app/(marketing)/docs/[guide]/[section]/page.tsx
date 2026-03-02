import { notFound } from "next/navigation";
import { guides } from "@/lib/docs/config";
import {
  getSections,
  getSection,
  getAdjacentSections,
} from "@/lib/docs/sections";
import { processMarkdown } from "@/lib/docs/markdown";
import { DocsBreadcrumbs } from "@/components/docs/DocsBreadcrumbs";
import { DocsPrevNext } from "@/components/docs/DocsPrevNext";
import { DocsTOC } from "@/components/docs/DocsTOC";

export function generateStaticParams() {
  const params: { guide: string; section: string }[] = [];
  for (const guide of guides) {
    const sections = getSections(guide);
    for (const section of sections) {
      params.push({ guide: guide.slug, section: section.slug });
    }
  }
  return params;
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ guide: string; section: string }>;
}) {
  const { guide: guideSlug, section: sectionSlug } = await params;
  const result = getSection(guideSlug, sectionSlug);
  if (!result) notFound();

  const { section, guideConfig } = result;
  const html = await processMarkdown(section.markdown);
  const { prev, next } = getAdjacentSections(guideSlug, sectionSlug);

  return (
    <div className="flex">
      <article className="flex-1 min-w-0 max-w-3xl px-6 py-8">
        <DocsBreadcrumbs
          guideTitle={guideConfig.title}
          guideSlug={guideSlug}
          sectionTitle={section.title}
        />

        <div
          className="docs-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <DocsPrevNext prev={prev} next={next} />
      </article>

      <DocsTOC headings={section.headings} />
    </div>
  );
}
