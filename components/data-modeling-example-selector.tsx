"use client";

import { useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type Example = {
	id: string;
	title: string;
	content: string | null;
};

export function DataModelingExampleSelector({
	examples,
}: {
	examples: Example[];
}) {
	const [selectedId, setSelectedId] = useState(examples[0]?.id ?? "");
	const selectedExample =
		examples.find((example) => example.id === selectedId) ?? examples[0];

	return (
		<div className='border-y border-border py-4 mb-8'>
			<label
				className='text-sm font-medium mb-3 block'
				htmlFor='data-modeling-example'>
				Choose an example
			</label>
			<Select
				value={selectedExample?.id}
				onValueChange={(value) => value && setSelectedId(value)}>
				<SelectTrigger id='data-modeling-example' className='w-full max-w-md'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{examples.map((example, index) => (
						<SelectItem key={example.id} value={example.id}>
							{String(index + 1).padStart(2, "0")} - {example.title}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<div className='px-3 pt-4' aria-live='polite'>
				{selectedExample?.content ? (
					<MarkdownContent source={selectedExample.content} />
				) : (
					<p className='text-muted-foreground'>
						Example content is unavailable.
					</p>
				)}
			</div>
		</div>
	);
}
