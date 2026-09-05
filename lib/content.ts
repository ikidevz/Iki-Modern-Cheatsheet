import { DATA } from "@/content/data";
import { isNested, type Category, type Sheet, type Subcategory } from "./types";

export function slugOf(id: string, prefix: string): string {
	const p = `${prefix}-`;
	return id.startsWith(p) ? id.slice(p.length) : id;
}

export type FlatEntry = {
	kind: "item" | "subcategory-overview";
	id: string;
	name: string;
	status: Sheet["status"];
	tagline: string;
	covers: string;
	fixes: string[];
	extend: string[];
	file?: string;
	body?: string | null;
	urlPath: string;
	groupKey: string;
	groupLabel: string;
	subKey?: string;
	subLabel?: string;
	subItems?: Sheet[];
};

export const ALL_ENTRIES: FlatEntry[] = DATA.flatMap((group) => {
	if (!isNested(group)) {
		return group.items.map(
			(it): FlatEntry => ({
				kind: "item",
				...it,
				urlPath: `/${group.key}/${slugOf(it.id, group.key)}`,
				groupKey: group.key,
				groupLabel: group.label,
			}),
		);
	}

	return group.subcategories.flatMap((sub) => {
		const overview: FlatEntry = {
			kind: "subcategory-overview",
			id: `sub-${group.key}-${sub.key}`,
			name: sub.label,
			status: sub.status,
			tagline: sub.tagline,
			covers: sub.covers,
			fixes: [],
			extend: [],
			urlPath: `/${group.slug}/${sub.slug}`,
			groupKey: group.key,
			groupLabel: group.label,
			subKey: sub.key,
			subLabel: sub.label,
			subItems: sub.items,
		};
		const children: FlatEntry[] = sub.items.map((it) => ({
			kind: "item",
			...it,
			urlPath: `/${group.slug}/${sub.slug}/${it.slug}`,
			groupKey: group.key,
			groupLabel: group.label,
			subKey: sub.key,
			subLabel: sub.label,
		}));
		return [overview, ...children];
	});
});

export function matches(entry: FlatEntry, query: string): boolean {
	if (!query) return true;
	const hay =
		`${entry.name} ${entry.file ?? ""} ${entry.tagline}`.toLowerCase();
	return hay.includes(query.toLowerCase());
}

export type ResolveResult =
	| { type: "overview" }
	| { type: "category"; category: Category }
	| { type: "subcategory"; category: Category; sub: Subcategory }
	| { type: "item"; category: Category; sub?: Subcategory; item: Sheet };

export function resolvePath(segments: string[]): ResolveResult | null {
	if (segments.length === 0) return { type: "overview" };

	const [catSeg, a, b] = segments;
	const category = DATA.find((c) => (isNested(c) ? c.slug : c.key) === catSeg);
	if (!category) return null;

	if (!isNested(category)) {
		if (!a) return { type: "category", category };
		const item = category.items.find((i) => slugOf(i.id, category.key) === a);
		return item ? { type: "item", category, item } : null;
	}

	if (!a) return { type: "category", category };
	const sub = category.subcategories.find((s) => s.slug === a);
	if (!sub) return null;
	if (!b) return { type: "subcategory", category, sub };
	const item = sub.items.find((i) => i.slug === b);
	return item ? { type: "item", category, sub, item } : null;
}
