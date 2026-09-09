import type { Metadata } from "next";
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

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const result = resolvePath(slug ?? []);
	const siteTitle = "Iki's Modern Data Cheatsheets";

	if (!result || result.type === "overview") {
		return {
			title: siteTitle,
			description: "A working index of reference sheets for data work.",
		};
	}

	if (result.type === "category") {
		return {
			title: `${result.category.label} | ${siteTitle}`,
			description: `Reference sheets for ${result.category.label.toLowerCase()}.`,
		};
	}

	if (result.type === "subcategory") {
		return {
			title: `${result.sub.label} | ${siteTitle}`,
			description: result.sub.tagline,
		};
	}

	return {
		title: `${result.item.name} | ${siteTitle}`,
		description: `${result.item.tagline}. ${result.item.covers}`,
	};
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
			const body = await getSheetBody(result.item.file);
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
