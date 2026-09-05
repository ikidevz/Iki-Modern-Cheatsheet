import { isNested, CAT_CLASS, type Category } from "@/lib/types";
import { slugOf } from "@/lib/content";
import { SheetRow } from "@/components/sheet-row";

export function CategoryView({ category }: { category: Category }) {
  const cat = CAT_CLASS[category.key] ?? CAT_CLASS.db;

  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-2.5">
        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
        Category
      </div>
      <h1 className="text-2xl md:text-[27px] font-semibold tracking-tight mb-7">
        {category.label}
      </h1>

      {!isNested(category)
        ? category.items.map((it, idx) => (
            <SheetRow
              key={it.id}
              href={`/${category.key}/${slugOf(it.id, category.key)}`}
              name={it.name}
              tagline={it.tagline}
              status={it.status}
              first={idx === 0}
            />
          ))
        : category.subcategories.map((sub, idx) => (
            <SheetRow
              key={sub.key}
              href={`/${category.slug}/${sub.slug}`}
              name={sub.label}
              tagline={sub.tagline}
              status={sub.status}
              bold
              first={idx === 0}
            />
          ))}
    </div>
  );
}
