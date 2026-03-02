import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface DocsBreadcrumbsProps {
  guideTitle: string;
  guideSlug: string;
  sectionTitle?: string;
}

export function DocsBreadcrumbs({
  guideTitle,
  guideSlug,
  sectionTitle,
}: DocsBreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
      <Link href="/docs" className="hover:text-foreground transition-colors">
        Docs
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <Link
        href={`/docs/${guideSlug}`}
        className="hover:text-foreground transition-colors"
      >
        {guideTitle}
      </Link>
      {sectionTitle && (
        <>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[300px]">
            {sectionTitle}
          </span>
        </>
      )}
    </nav>
  );
}
