import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Shield,
  Phone,
  Users,
  Server,
  Code,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { guides, getGuideBySlug } from "@/lib/docs/config";
import { getSections } from "@/lib/docs/sections";
import { DocsBreadcrumbs } from "@/components/docs/DocsBreadcrumbs";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Shield,
  Phone,
  Users,
  Server,
  Code,
  AlertTriangle,
};

export function generateStaticParams() {
  return guides.map((g) => ({ guide: g.slug }));
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ guide: string }>;
}) {
  const { guide: guideSlug } = await params;
  const guideConfig = getGuideBySlug(guideSlug);
  if (!guideConfig) notFound();

  const sections = getSections(guideConfig);
  const Icon = iconMap[guideConfig.iconName] || FileText;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <DocsBreadcrumbs guideTitle={guideConfig.title} guideSlug={guideSlug} />

      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {guideConfig.title}
        </h1>
      </div>
      <p className="text-muted-foreground mb-8">{guideConfig.description}</p>

      <div className="space-y-1">
        {sections.map((section, i) => (
          <Link
            key={section.slug}
            href={`/docs/${guideSlug}/${section.slug}`}
            className="group flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono w-6">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {section.title}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>

      {sections.length > 0 && (
        <div className="mt-8">
          <Link
            href={`/docs/${guideSlug}/${sections[0].slug}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Start Reading
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
