import React from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeReact from "rehype-react";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";

import { CodeBlockChrome } from "@/components/code-block-chrome";

const headingClass =
	"group scroll-mt-20 font-semibold tracking-tight text-foreground";

const anchorLinkProps = {
	behavior: "append" as const,
	properties: {
		className: [
			"ml-2",
			"opacity-0",
			"group-hover:opacity-100",
			"text-foreground-faint",
			"no-underline",
			"text-sm",
			"font-normal",
		],
		"aria-hidden": "true",
	},
	content: {
		type: "text" as const,
		value: " #",
	},
};

type BaseProps = {
	children?: React.ReactNode;
	className?: string;
	id?: string;
};

type CodeProps = BaseProps & {
	"data-language"?: string;
};

type HastNode = {
	type?: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
};

function normalizeHeadingIds() {
	return (tree: HastNode) => {
		function visit(node: HastNode) {
			if (
				node.type === "element" &&
				/^h[1-6]$/.test(node.tagName ?? "") &&
				typeof node.properties?.id === "string"
			) {
				node.properties.id = node.properties.id
					.replace(/^-+/, "")
					.replace(/---/g, "--");
			}

			for (const child of node.children ?? []) visit(child);
		}

		visit(tree);
	};
}

const components = {
	h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
		<h1
			{...props}
			className={`${headingClass} text-2xl md:text-[27px] mt-0 mb-3`}
		/>
	),

	h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
		<h2 {...props} className={`${headingClass} text-xl mt-9 mb-3`} />
	),

	h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
		<h3 {...props} className={`${headingClass} text-base mt-7 mb-2`} />
	),

	p: (props: React.ComponentPropsWithoutRef<"p">) => (
		<p
			{...props}
			className='text-[15px] leading-relaxed text-foreground mb-4'
		/>
	),

	a: (props: React.ComponentPropsWithoutRef<"a">) => {
		const isExternal = props.href?.startsWith("http");

		return (
			<a
				{...props}
				className='text-primary underline underline-offset-2 hover:no-underline'
				target={isExternal ? "_blank" : undefined}
				rel={isExternal ? "noreferrer" : undefined}
			/>
		);
	},

	/*
	 * We don't need to inspect <li> anymore.
	 *
	 * The parent determines whether the list is ordered or unordered:
	 *
	 * ol > li  = numbered
	 * ul > li  = dash
	 *
	 * Tailwind's arbitrary selectors handle this directly.
	 */
	ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
		<ul
			{...props}
			className="
        list-none
        p-0
        mb-4
        space-y-1.5

        [&>li]:flex
        [&>li]:gap-2.5
        [&>li]:text-[15px]
        [&>li]:leading-relaxed

        [&>li]:before:content-['–']
        [&>li]:before:text-foreground-faint
        [&>li]:before:shrink-0
      "
		/>
	),

	ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
		<ol
			{...props}
			className='
        list-decimal
        pl-5
        mb-4
        space-y-1.5
        text-[15px]
        leading-relaxed
      '
		/>
	),

	/*
	 * No special logic required.
	 */
	li: (props: React.ComponentPropsWithoutRef<"li">) => <li {...props} />,

	blockquote: (props: React.ComponentPropsWithoutRef<"blockquote">) => (
		<blockquote
			{...props}
			className='
        border-l-2
        border-primary/40
        pl-4
        italic
        text-muted-foreground
        my-4
        [&>p]:mb-0
      '
		/>
	),

	table: (props: React.ComponentPropsWithoutRef<"table">) => (
		<div className='overflow-x-auto my-5'>
			<table {...props} className='w-full text-sm border-collapse' />
		</div>
	),

	th: (props: React.ComponentPropsWithoutRef<"th">) => (
		<th
			{...props}
			className='
        text-left
        font-semibold
        border-b
        border-border
        py-2
        px-3
        bg-card
      '
		/>
	),

	td: (props: React.ComponentPropsWithoutRef<"td">) => (
		<td {...props} className='border-b border-border py-2 px-3' />
	),

	hr: (props: React.ComponentPropsWithoutRef<"hr">) => (
		<hr {...props} className='border-border my-8' />
	),

	/*
	 * Inline code vs fenced code.
	 *
	 * rehype-pretty-code adds data-language to fenced code.
	 */
	code: (props: CodeProps) => {
		const isCodeBlock = Boolean(props["data-language"]);

		if (isCodeBlock) {
			return <code {...props} />;
		}

		return (
			<code
				{...props}
				className='
          font-mono
          text-[13px]
          bg-muted
          px-1.5
          py-0.5
          rounded
        '
			/>
		);
	},

	pre: (
		props: React.ComponentPropsWithoutRef<"pre"> & {
			"data-language"?: string;
		},
	) => (
		<CodeBlockChrome language={props["data-language"]}>
			<pre {...props} />
		</CodeBlockChrome>
	),
};

export async function renderMarkdown(
	source: string,
): Promise<React.ReactElement> {
	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype)
		.use(rehypeSlug)
		.use(normalizeHeadingIds)
		.use(rehypeAutolinkHeadings, anchorLinkProps)
		.use(rehypePrettyCode, {
			theme: {
				light: "github-light",
				dark: "github-dark",
			},
			keepBackground: false,
		})
		.use(rehypeReact, {
			Fragment,
			jsx,
			jsxs,
			components,
		})
		.process(source);

	return file.result as React.ReactElement;
}
