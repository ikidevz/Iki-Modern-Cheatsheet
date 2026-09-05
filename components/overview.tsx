import { DATA } from "@/content/data";
import { isNested, CAT_CLASS } from "@/lib/types";
import { ALL_ENTRIES, slugOf } from "@/lib/content";
import { SheetRow } from "@/components/sheet-row";

export function Overview() {
  const solid = ALL_ENTRIES.filter((e) => e.status === "solid").length;
  const flagged = ALL_ENTRIES.filter((e) => e.status === "flagged").length;
  const planned = ALL_ENTRIES.filter((e) => e.status === "planned").length;

  return (
    <div>
      <h1 className="text-2xl md:text-[27px] font-semibold tracking-tight mb-2.5">
        Cheatsheet Index
      </h1>
      <p className="text-base text-muted-foreground max-w-[56ch] mb-6">
        A working set of reference sheets for databases, Python data libraries,
        infrastructure, data science, engineering fundamentals, and AWS — kept in
        one consistent table-of-contents / quick-reference / gotchas format. Built
        sheets are checked line by line; planned ones are scoped and waiting to be
        written.
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-3 py-4 border-y border-border mb-9">
        <Stat value={ALL_ENTRIES.length} label="pages" />
        <Stat value={solid} label="solid" />
        <Stat value={flagged} label="need a look" />
        <Stat value={planned} label="planned" />
      </div>

      {DATA.map((group) => {
        const cat = CAT_CLASS[group.key] ?? CAT_CLASS.db;
        return (
          <div key={group.key} className="mb-8">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground mb-2.5">
              <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
              {group.label}
            </div>

            {!isNested(group)
              ? group.items.map((it, idx) => (
                  <SheetRow
                    key={it.id}
                    href={`/${group.key}/${slugOf(it.id, group.key)}`}
                    name={it.name}
                    tagline={it.tagline}
                    status={it.status}
                    first={idx === 0}
                  />
                ))
              : group.subcategories.map((sub, subIdx) => (
                  <div key={sub.key}>
                    <SheetRow
                      href={`/${group.slug}/${sub.slug}`}
                      name={sub.label}
                      tagline={sub.tagline}
                      status={sub.status}
                      bold
                      first={subIdx === 0}
                    />
                    {sub.items.map((it) => (
                      <SheetRow
                        key={it.id}
                        href={`/${group.slug}/${sub.slug}/${it.slug}`}
                        name={it.name}
                        tagline={it.tagline}
                        status={it.status}
                        indent
                      />
                    ))}
                  </div>
                ))}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-xl font-mono font-semibold">{value}</div>
      <div className="text-xs text-foreground-faint mt-0.5">{label}</div>
    </div>
  );
}
