"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check, Code, Globe } from "lucide-react";

interface EmbedCodeTabProps {
  tenantId: string;
}

interface PlatformInstruction {
  id: string;
  name: string;
  icon: string;
  steps: string[];
}

const PLATFORMS: PlatformInstruction[] = [
  {
    id: "wordpress",
    name: "WordPress",
    icon: "WP",
    steps: [
      "Go to Appearance > Theme File Editor (or use a plugin like Insert Headers and Footers).",
      "Open your theme's footer.php file.",
      "Paste the embed code just before the closing </body> tag.",
      "Click Update File to save.",
      'Alternatively, install the "WPCode" plugin and add the snippet as a site-wide footer script.',
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: "S",
    steps: [
      "Go to Online Store > Themes in your Shopify admin.",
      "Click the three dots next to your theme and select Edit code.",
      "Open the theme.liquid file under Layout.",
      "Paste the embed code just before the closing </body> tag.",
      "Click Save.",
    ],
  },
  {
    id: "wix",
    name: "Wix",
    icon: "W",
    steps: [
      "In the Wix Editor, go to Settings > Custom Code (under Advanced).",
      "Click + Add Custom Code.",
      "Paste the embed code in the code snippet field.",
      "Set it to load on All Pages, in the Body - end position.",
      "Click Apply.",
    ],
  },
  {
    id: "squarespace",
    name: "Squarespace",
    icon: "Sq",
    steps: [
      "Go to Settings > Advanced > Code Injection.",
      "Paste the embed code in the Footer section.",
      "Click Save.",
      "The widget will appear on all pages of your site.",
    ],
  },
];

export default function EmbedCodeTab({ tenantId }: EmbedCodeTabProps) {
  const [copied, setCopied] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  const embedCode = `<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://app.lumentraai.com/widget/lumentra-chat.js';
    s.async = true;
    s.onload = function() {
      new LumentraChat({ tenantId: '${tenantId}' });
    };
    document.body.appendChild(s);
  })();
</script>`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [embedCode]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Embed snippet */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Code className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Embed Code</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Add this code to your website, just before the closing{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
            &lt;/body&gt;
          </code>{" "}
          tag.
        </p>

        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300 font-mono">
            <code>{embedCode}</code>
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="absolute right-2 top-2 h-7 gap-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Platform instructions */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Platform Instructions</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Step-by-step guides for popular website platforms
        </p>

        <div className="space-y-2">
          {PLATFORMS.map((platform) => {
            const isExpanded = expandedPlatform === platform.id;
            return (
              <div key={platform.id} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPlatform(isExpanded ? null : platform.id)
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
                    {platform.icon}
                  </div>
                  <span className="text-sm font-medium">{platform.name}</span>
                  <svg
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180",
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-3">
                    <ol className="space-y-2">
                      {platform.steps.map((step, idx) => (
                        <li
                          key={idx}
                          className="flex gap-2.5 text-xs text-muted-foreground"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
