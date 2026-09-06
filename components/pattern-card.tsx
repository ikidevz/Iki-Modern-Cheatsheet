"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, Code2 } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export type PatternCardData = {
	name: string;
	tags: string[];
	definition: string;
	whenToUse: string;
	pros: string[];
	cons: string[];
	examples: Record<string, string>;
};

type Tab = "learn" | "code";

export function PatternCard({
	index,
	pattern,
	codeByStack,
}: {
	index: number;
	pattern: PatternCardData;
	codeByStack: Record<string, ReactNode>;
}) {
	const [activeTab, setActiveTab] = useState<Tab>("learn");
	const [selectedStack, setSelectedStack] = useState(
		Object.keys(pattern.examples)[0],
	);

	return (
		<details className='group w-full rounded-lg border border-border bg-card open:shadow-sm'>
			<summary className='flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden'>
				<span className='font-mono text-xs text-foreground-faint'>
					{String(index + 1).padStart(2, "0")}
				</span>
				<span className='flex-1 text-sm font-semibold text-foreground'>
					{pattern.name}
				</span>
				<ChevronDown className='size-4 text-foreground-faint transition-transform group-open:rotate-180' />
			</summary>

			<div className='border-t border-border px-4 pb-5 pt-4'>
				<div className='mb-4 flex flex-wrap gap-1.5'>
					{pattern.tags.map((tag) => (
						<span
							key={tag}
							className='rounded-full border border-primary/20 bg-accent px-2.5 py-1 text-[11px] font-medium text-primary'>
							{tag}
						</span>
					))}
				</div>

				<div className='mb-4 flex gap-1 border-b border-border'>
					<TabButton
						active={activeTab === "learn"}
						onClick={() => setActiveTab("learn")}>
						<BookOpen className='size-3.5' /> Learn
					</TabButton>
					<TabButton
						active={activeTab === "code"}
						onClick={() => setActiveTab("code")}>
						<Code2 className='size-3.5' /> Code
					</TabButton>
				</div>

				{activeTab === "learn" ? (
					<div className='grid gap-5 md:grid-cols-2'>
						<InfoBlock title='Definition' text={pattern.definition} />
						<InfoBlock title='When to use' text={pattern.whenToUse} />
						<ProsCons title='Pros' items={pattern.pros} positive />
						<ProsCons title='Cons' items={pattern.cons} />
					</div>
				) : (
					<div className='w-full'>
						<label
							className='mb-2 block text-xs font-medium text-muted-foreground'
							htmlFor={`stack-${index}`}>
							Example stack
						</label>
						<Select
							value={selectedStack}
							onValueChange={(value) => {
								if (value !== null) setSelectedStack(value);
							}}>
							<SelectTrigger
								id={`stack-${index}`}
								aria-label='Example stack'
								className='mb-3 w-full max-w-xs bg-background'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.keys(pattern.examples).map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className='w-full overflow-x-auto rounded-md bg-muted p-4'>
							{codeByStack[selectedStack]}
						</div>
					</div>
				)}
			</div>
		</details>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
				active
					? "border-primary text-primary"
					: "border-transparent text-muted-foreground hover:text-foreground"
			}`}>
			{children}
		</button>
	);
}

function InfoBlock({ title, text }: { title: string; text: string }) {
	return (
		<div>
			<div className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
				{title}
			</div>
			<p className='text-sm leading-relaxed text-foreground'>{text}</p>
		</div>
	);
}

function ProsCons({
	title,
	items,
	positive = false,
}: {
	title: string;
	items: string[];
	positive?: boolean;
}) {
	return (
		<div>
			<div
				className={`mb-2 text-sm font-semibold ${positive ? "text-status-solid" : "text-status-flag"}`}>
				{positive ? "✅" : "⚠️"} {title}
			</div>
			<ul className='space-y-1.5 text-sm leading-relaxed text-muted-foreground'>
				{items.map((item) => (
					<li key={item} className='flex gap-2'>
						<span className='text-foreground-faint'>•</span>
						<span>{item}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
