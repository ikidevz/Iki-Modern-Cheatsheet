import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
	CAT_CLASS,
	statusDotClass,
	statusLabel,
	type Category,
	type Sheet,
	type Subcategory,
} from "@/lib/types";
import { MarkdownContent } from "@/components/markdown-content";
import { CUSTOMIZED_COMPONENTS } from "@/content/customize";

export function ItemView({
	category,
	sub,
	item,
	body,
}: {
	category: Category;
	sub?: Subcategory;
	item: Sheet;
	body: string | null;
}) {
	const cat = CAT_CLASS[category.key] ?? CAT_CLASS.db;
	const isPlanned = item.status === "planned";
	const pathLine = item.slug
		? `/${"slug" in category ? category.slug : category.key}${sub ? `/${sub.slug}` : ""}/${item.slug}`
		: item.file;
	const categorySlug = "slug" in category ? category.slug : category.key;
	const CustomizedComponent = item.customizedComponent
		? CUSTOMIZED_COMPONENTS[item.id]
		: undefined;

	return (
		<div>
			<div className='mb-3.5'>
				<Link
					href='/'
					className='flex items-center gap-1.5 text-foreground-faint hover:text-foreground text-sm w-fit'>
					<ChevronLeft className='w-3 h-3' />
					All cheatsheets
				</Link>
			</div>

			<div className='flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-2.5'>
				<span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
				{category.label}
				{sub && (
					<>
						<span className='text-foreground-faint'>/</span>
						<Link
							href={`/${categorySlug}/${sub.slug}`}
							className='hover:text-foreground'>
							{sub.label}
						</Link>
					</>
				)}
			</div>

			<h1 className='text-2xl md:text-[27px] font-semibold tracking-tight mb-1.5'>
				{item.name}
			</h1>

			{pathLine && (
				<div className='font-mono text-xs text-foreground-faint mb-4'>
					{pathLine}
					{isPlanned && <span className='italic'> — not written yet</span>}
				</div>
			)}

			<div className='inline-flex items-center gap-2 rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground mb-6'>
				<span
					className={`w-1.5 h-1.5 rounded-full ${statusDotClass(item.status)}`}
				/>
				{statusLabel(item.status)}
			</div>

			<p className='text-base md:text-[16.5px] text-muted-foreground mb-7'>
				{item.tagline}
			</p>

			{CustomizedComponent ? (
				<CustomizedComponent item={item} body={body} />
			) : body ? (
				<MarkdownContent source={body} />
			) : (
				<PlannedSections item={item} isPlanned={isPlanned} />
			)}
		</div>
	);
}

function PlannedSections({
	item,
	isPlanned,
}: {
	item: Sheet;
	isPlanned: boolean;
}) {
	const coverTitle = isPlanned ? "Planned scope" : "What it covers";
	const extendTitle = isPlanned ? "Should include" : "Could extend";

	return (
		<>
			<div className='mb-7'>
				<div className='text-xs font-semibold text-muted-foreground mb-2.5'>
					{coverTitle}
				</div>
				<p className='text-[15px] leading-relaxed'>{item.covers}</p>
			</div>

			{item.fixes.length > 0 && (
				<div className='mb-7'>
					<div className='text-xs font-semibold text-muted-foreground mb-2.5'>
						Worth fixing
					</div>
					<ul className='list-none p-0 m-0'>
						{item.fixes.map((f, i) => (
							<li
								key={i}
								className='flex gap-2.5 text-[15px] leading-relaxed py-1.5'>
								<span className='text-status-flag font-semibold shrink-0'>
									!
								</span>
								{f}
							</li>
						))}
					</ul>
				</div>
			)}

			<div className='mb-2'>
				<div className='text-xs font-semibold text-muted-foreground mb-2.5'>
					{extendTitle}
				</div>
				<ul className='list-none p-0 m-0'>
					{item.extend.map((e, i) => (
						<li
							key={i}
							className='flex gap-2.5 text-[15px] leading-relaxed py-1.5'>
							<span className='text-foreground-faint shrink-0'>–</span>
							{e}
						</li>
					))}
				</ul>
			</div>
		</>
	);
}
