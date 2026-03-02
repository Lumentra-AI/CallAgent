import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Section } from "@/lib/docs/sections";

interface DocsPrevNextProps {
  prev: Section | null;
  next: Section | null;
}

export function DocsPrevNext({ prev, next }: DocsPrevNextProps) {
  if (!prev && !next) return null;

  return (
    <div className="flex items-stretch gap-4 mt-12 pt-6 border-t border-border">
      {prev ? (
        <Link
          href={`/docs/${prev.guideSlug}/${prev.slug}`}
          className="flex-1 group flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/30 hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <div className="text-right flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Previous</p>
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {prev.title}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <Link
          href={`/docs/${next.guideSlug}/${next.slug}`}
          className="flex-1 group flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Next</p>
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {next.title}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
