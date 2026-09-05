import { notFound } from "next/navigation";
import { DATA } from "@/content/data";
import { isNested } from "@/lib/types";
import { resolvePath, ALL_ENTRIES } from "@/lib/content";
import { getSheetBody } from "@/lib/get-sheet-body";
import { Overview } from "@/components/overview";
import { CategoryView } from "@/components/category-view";
import { SubcategoryView } from "@/components/subcategory-view";
import { ItemView } from "@/components/item-view";

export function generateStaticParams() {
  const categoryPaths = DATA.map((group) => ({
    slug: [isNested(group) ? group.slug : group.key],
  }));
  const entryPaths = ALL_ENTRIES.map((e) => ({
    slug: e.urlPath.replace(/^\//, "").split("/"),
  }));
  return [{ slug: [] }, ...categoryPaths, ...entryPaths];
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const result = resolvePath(slug ?? []);
  if (!result) notFound();

  switch (result.type) {
    case "overview":
      return <Overview />;
    case "category":
      return <CategoryView category={result.category} />;
    case "subcategory":
      return <SubcategoryView category={result.category} sub={result.sub} />;
    case "item": {
      const body = await getSheetBody(result.item.id);
      return (
        <ItemView
          category={result.category}
          sub={result.sub}
          item={result.item}
          body={body}
        />
      );
    }
  }
}
