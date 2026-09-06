export type Status = "solid" | "flagged" | "planned";
export type ThemeType = "light" | "dark";

export type Theme = {
	key: string;
	themeType: ThemeType;
	label: string;
	swatch: string;
	vars: Record<string, string>;
};

export type Sheet = {
	id: string;
	name: string;
	file?: string;
	slug?: string;
	customizedComponent: boolean;
	status: Status;
	tagline: string;
	covers: string;
	fixes: string[];
	extend: string[];
	body?: string | null;
};

export type Subcategory = {
	key: string;
	label: string;
	slug: string;
	status: Status;
	tagline: string;
	covers: string;
	items: Sheet[];
};

export type FlatCategory = {
	key: string;
	label: string;
	items: Sheet[];
};

export type NestedCategory = {
	key: string;
	label: string;
	slug: string;
	subcategories: Subcategory[];
};

export type Category = FlatCategory | NestedCategory;

export function isNested(c: Category): c is NestedCategory {
	return "subcategories" in c;
}

/** Category color-class pairs, keyed by category key. */
export const CAT_CLASS: Record<string, { dot: string; border: string }> = {
	db: { dot: "bg-cat-db", border: "border-cat-db" },
	py: { dot: "bg-cat-py", border: "border-cat-py" },
	infra: { dot: "bg-cat-infra", border: "border-cat-infra" },
	ds: { dot: "bg-cat-ds", border: "border-cat-ds" },
	eng: { dot: "bg-cat-eng", border: "border-cat-eng" },
	aws: { dot: "bg-cat-aws", border: "border-cat-aws" },
	dsa: { dot: "bg-cat-dsa", border: "border-cat-dsa" },
	designpatterns: { dot: "bg-cat-eng", border: "border-cat-eng" },
};

export function statusDotClass(status: Status): string {
	if (status === "solid") return "bg-status-solid";
	if (status === "flagged") return "bg-status-flag";
	return "bg-status-planned";
}

export function statusLabel(status: Status): string {
	if (status === "solid") return "Solid";
	if (status === "flagged") return "Needs a look";
	return "Planned";
}
