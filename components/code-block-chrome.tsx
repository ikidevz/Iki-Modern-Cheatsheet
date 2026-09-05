"use client";

import { useRef, useState } from "react";

/**
 * Wraps a single rendered <pre><code>...</code></pre> (already syntax-highlighted
 * by Shiki via rehype-pretty-code) in the same card chrome used by the static
 * "Format preview" block on the overview page: a bordered card, a header row
 * with a language pill, and — the one bit that needs real interactivity — a
 * working copy button.
 *
 * This is a Client Component, but only this small piece. The actual markdown
 * content is still rendered entirely on the server; this just adds the one
 * button that needs onClick + clipboard access.
 */
export function CodeBlockChrome({
  language,
  children,
}: {
  language?: string;
  children: React.ReactNode;
}) {
  const preRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — fail quietly,
      // the code is still selectable/copyable by hand.
    }
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card my-4">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-background">
        <span className="font-mono text-[11px] text-muted-foreground bg-accent border border-input rounded-full px-2.5 py-0.5">
          {language || "text"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[11px] text-foreground-faint hover:text-foreground transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div ref={preRef} className="[&>pre]:m-0 [&>pre]:px-4 [&>pre]:py-3.5 [&>pre]:overflow-x-auto [&>pre]:text-[13px] [&>pre]:leading-6">
        {children}
      </div>
    </div>
  );
}
