import { MarkdownContent } from "@/components/markdown-content";
import type { CustomizedComponentProps } from ".";

export function Clustering({ item, body }: CustomizedComponentProps) {
	return (
		<div className='grid grid-cols-1 md:grid-cols-2 gap-6 items-start'>
			<div className='min-w-0 col-span-1'>
				{body ? <MarkdownContent source={body} /> : null}
			</div>
			<div className='min-w-0 col-span-1'>
				<div className='text-xs font-semibold text-muted-foreground mb-2.5'>
					What it covers
				</div>
				<p className='text-[15px] leading-relaxed'>{item.covers}</p>
			</div>
		</div>
	);
}
