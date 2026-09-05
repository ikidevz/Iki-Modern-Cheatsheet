import { renderMarkdown } from "@/lib/markdown";

export async function MarkdownContent({ source }: { source: string }) {
	const content = await renderMarkdown(source);
	return <div className='markdown-content max-w-none'>{content}</div>;
}
