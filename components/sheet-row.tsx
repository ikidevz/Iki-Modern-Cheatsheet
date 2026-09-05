import Link from "next/link";
import { statusDotClass } from "@/lib/types";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SheetRow({
  href,
  name,
  tagline,
  status,
  bold = false,
  indent = false,
  first = false,
}: {
  href: string;
  name: string;
  tagline: string;
  status: Status;
  bold?: boolean;
  indent?: boolean;
  first?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-wrap md:flex-nowrap items-baseline gap-x-3 w-full text-left py-2.5",
        !first && "border-t border-border",
        indent && "pl-4"
      )}
    >
      <span
        className={cn(
          "font-mono text-sm text-foreground shrink-0 group-hover:text-primary",
          bold && "font-semibold",
          indent ? "w-full md:w-[174px]" : "w-full md:w-[190px]"
        )}
      >
        {name}
      </span>
      <span className="text-sm text-muted-foreground flex-1 md:truncate order-3 md:order-none w-full md:w-auto">
        {tagline}
      </span>
      <span className="w-3.5 shrink-0 flex justify-center">
        <span className={cn("inline-block w-1.5 h-1.5 rounded-full", statusDotClass(status))} />
      </span>
    </Link>
  );
}
