import {
	CAT_CLASS,
	statusDotClass,
	statusLabel,
	type Category,
	type Subcategory,
} from "@/lib/types";
import { SheetRow } from "@/components/sheet-row";

export function SubcategoryView({
	category,
	sub,
}: {
	category: Category;
	sub: Subcategory;
}) {
	const cat = CAT_CLASS[category.key] ?? CAT_CLASS.db;
	const slug = "slug" in category ? category.slug : category.key;

	return (
		<div>
			<div className='flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-2.5'>
				<span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
				{category.label}
			</div>
			<h1 className='text-2xl md:text-[27px] font-semibold tracking-tight mb-1.5'>
				{sub.label}
			</h1>
			<div className='font-mono text-xs text-foreground-faint mb-4'>
				/{slug}/{sub.slug}
			</div>
			<div className='inline-flex items-center gap-2 rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground mb-6'>
				<span
					className={`w-1.5 h-1.5 rounded-full ${statusDotClass(sub.status)}`}
				/>
				{statusLabel(sub.status)}
			</div>
			<p className='text-base md:text-[16.5px] text-muted-foreground mb-7'>
				{sub.tagline}
			</p>

			<div className='mb-7'>
				<div className='text-xs font-semibold text-muted-foreground mb-2.5'>
					Planned scope
				</div>
				<p className='text-[15px] leading-relaxed'>{sub.covers}</p>
			</div>

			<div className='mb-2'>
				<div className='text-xs font-semibold text-muted-foreground mb-2.5'>
					Patterns in this family
				</div>
				{sub.items.map((it, idx) => (
					<SheetRow
						key={it.id}
						href={`/${slug}/${sub.slug}/${it.slug}`}
						name={it.name}
						tagline={it.tagline}
						status={it.status}
						first={idx === 0}
					/>
				))}
			</div>
		</div>
	);
}
