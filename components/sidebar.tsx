"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { DATA } from "@/content/data";
import {
	isNested,
	CAT_CLASS,
	statusDotClass,
	type ThemeType,
} from "@/lib/types";
import { slugOf } from "@/lib/content";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
import { THEMES } from "@/lib/themes";

function textMatch(q: string, ...fields: (string | undefined)[]) {
	if (!q) return true;
	const hay = fields.filter(Boolean).join(" ").toLowerCase();
	return hay.includes(q.toLowerCase());
}

export function Sidebar() {
	const pathname = usePathname();
	const [query, setQuery] = useState("");
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [themeType, setThemeType] = useState<ThemeType>("light");

	useEffect(() => {
		const key = document.documentElement.dataset.theme ?? THEMES[0].key;
		setThemeType(
			THEMES.find((theme) => theme.key === key)?.themeType ?? "light",
		);
	}, []);

	const logoSrc =
		themeType === "light"
			? "/assets/img/header_logo_dark.png"
			: "/assets/img/header_logo_light.png";

	const q = query.trim();

	function toggleGroup(key: string) {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	function closeDrawer() {
		setDrawerOpen(false);
	}

	useEffect(() => {
		if (!drawerOpen) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") closeDrawer();
		}
		document.addEventListener("keydown", onKeyDown);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [drawerOpen]);

	const nav = useMemo(
		() =>
			DATA.map((group) => {
				if (!isNested(group)) {
					const visible = group.items.filter((it) =>
						textMatch(q, it.name, it.file, it.tagline),
					);
					return { group, visible, kind: "flat" as const };
				}
				const subs = group.subcategories
					.map((sub) => {
						const subLabelMatches = !q || textMatch(q, sub.label);
						const items = subLabelMatches
							? sub.items
							: sub.items.filter((it) => textMatch(q, it.name, it.tagline));
						return { sub, items, subLabelMatches };
					})
					.filter((s) => !q || s.subLabelMatches || s.items.length > 0);
				return { group, subs, kind: "nested" as const };
			}),
		[q],
	);

	const anyVisible = nav.some((group) =>
		group.kind === "flat" ? group.visible.length > 0 : group.subs.length > 0,
	);

	return (
		<>
			{/* Mobile top bar */}
			<div
				className='flex md:hidden items-center justify-between px-4 border-b border-border bg-card shrink-0'
				style={{
					paddingTop: "env(safe-area-inset-top)",
					height: "var(--mobile-bar-h)",
				}}>
				<Link
					href='/'
					className='group flex h-10 w-25 items-center overflow-hidden transition-opacity hover:opacity-90'>
					{/* Logo */}
					<img src={logoSrc} alt='Logo' className='w-full h-full' />
				</Link>
				<button
					type='button'
					onClick={() => setDrawerOpen(true)}
					className='flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-xs min-h-11'>
					<Menu className='w-4 h-4' />
					Categories
				</button>
			</div>

			{/* Mobile overlay */}
			{drawerOpen && (
				<div
					className='fixed bottom-0 inset-x-0 z-30 bg-black/40 md:hidden'
					style={{ top: "var(--mobile-bar-h)" }}
					onClick={closeDrawer}
				/>
			)}

			<aside
				className={cn(
					"fixed bottom-0 left-0 z-40 w-75 transition-transform duration-200 motion-reduce:transition-none",
					"sidebar-scrollbar border-r border-border bg-card overflow-y-auto flex flex-col",
					"md:static md:top-0! md:bottom-auto md:left-auto md:z-auto md:w-75 md:translate-x-0 md:transition-none md:shrink-0",
					drawerOpen ? "translate-x-0" : "-translate-x-full",
				)}
				style={{
					top: "var(--mobile-bar-h)",
					paddingBottom: "env(safe-area-inset-bottom)",
				}}>
				<div className='px-5 pt-6 pb-4 border-b border-border'>
					<div className='flex items-center justify-between'>
						<div>
							<Link
								href='/'
								className='group flex h-30 w-full items-center overflow-hidden transition-opacity hover:opacity-90'>
								{/* Logo */}
								<img src={logoSrc} alt='Logo' className='object-contain' />
							</Link>
						</div>
						<button
							type='button'
							onClick={closeDrawer}
							className='md:hidden text-foreground-faint flex items-center justify-center w-11 h-11 -mr-2'
							aria-label='Close'>
							<X className='w-4 h-4' />
						</button>
					</div>

					<div className='mt-3.5'>
						<ThemeSwitcher onThemeTypeChange={setThemeType} />
					</div>

					<div className='relative mt-3'>
						<Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-faint pointer-events-none' />
						<input
							type='text'
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder='Search cheatsheets'
							autoComplete='off'
							className='w-full rounded-md border border-input bg-background text-foreground placeholder:text-foreground-faint text-base md:text-sm pl-8 pr-3 py-2.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card'
						/>
					</div>
				</div>

				<nav className='flex-1 py-1.5 pb-7'>
					{nav.map(({ group, ...rest }) => {
						if (rest.kind === "flat" && rest.visible.length === 0 && q)
							return null;
						if (rest.kind === "nested" && rest.subs.length === 0 && q)
							return null;

						const isCollapsed = collapsed.has(group.key) && !q;
						const cat = CAT_CLASS[group.key] ?? CAT_CLASS.db;
						const count =
							rest.kind === "flat"
								? rest.visible.length
								: rest.subs.reduce((n, s) => n + s.items.length, 0);

						return (
							<div key={group.key}>
								<button
									type='button'
									onClick={() => toggleGroup(group.key)}
									aria-expanded={!isCollapsed}
									className='flex items-center gap-2 w-full text-left px-5 pt-4 pb-2.5 md:pt-3.5 md:pb-1.5'>
									<span
										className={cn("w-1.5 h-1.5 rounded-full shrink-0", cat.dot)}
									/>
									<span className='flex-1 text-xs font-semibold text-muted-foreground'>
										{group.label}
									</span>
									<span className='font-mono text-[11px] text-foreground-faint'>
										{count}
									</span>
									<ChevronDown
										className={cn(
											"w-2.5 h-2.5 text-foreground-faint transition-transform duration-150",
											isCollapsed && "-rotate-90",
										)}
									/>
								</button>

								<div className={cn("pb-1", isCollapsed && "hidden")}>
									{rest.kind === "flat"
										? rest.visible.map((it) => {
												const href = `/${group.key}/${slugOf(it.id, group.key)}`;
												const active = pathname === href;
												return (
													<Link
														key={it.id}
														href={href}
														onClick={closeDrawer}
														className={cn(
															"flex items-center gap-2 w-full text-left pl-7 pr-5 py-2.5 md:py-1.5 font-mono text-sm border-l-2",
															active
																? cn(cat.border, "bg-accent")
																: "border-transparent hover:bg-background",
														)}>
														<span
															className={cn(
																"w-1.5 h-1.5 rounded-full shrink-0",
																statusDotClass(it.status),
															)}
														/>
														<span className='flex-1 truncate'>{it.name}</span>
													</Link>
												);
											})
										: rest.subs.map(({ sub, items }) => {
												const subHref = `/${isNested(group) ? group.slug : group.key}/${sub.slug}`;
												const subActive = pathname === subHref;
												return (
													<div key={sub.key}>
														<Link
															href={subHref}
															onClick={closeDrawer}
															className={cn(
																"flex items-center gap-2 w-full text-left pl-7 pr-5 py-2.5 md:py-1.5 font-mono text-sm font-semibold border-l-2",
																subActive
																	? cn(cat.border, "bg-accent")
																	: "border-transparent hover:bg-background",
															)}>
															<span
																className={cn(
																	"w-1.5 h-1.5 rounded-full shrink-0",
																	statusDotClass(sub.status),
																)}
															/>
															<span className='flex-1 truncate'>
																{sub.label}
															</span>
														</Link>
														{items.map((it) => {
															const href = `${subHref}/${it.slug}`;
															const active = pathname === href;
															return (
																<Link
																	key={it.id}
																	href={href}
																	onClick={closeDrawer}
																	className={cn(
																		"flex items-center gap-2 w-full text-left pl-10 pr-5 py-2.5 md:py-1.5 font-mono text-sm border-l-2",
																		active
																			? cn(cat.border, "bg-accent")
																			: "border-transparent hover:bg-background",
																	)}>
																	<span
																		className={cn(
																			"w-1.5 h-1.5 rounded-full shrink-0",
																			statusDotClass(it.status),
																		)}
																	/>
																	<span className='flex-1 truncate'>
																		{it.name}
																	</span>
																</Link>
															);
														})}
													</div>
												);
											})}
								</div>
							</div>
						);
					})}

					{q && !anyVisible && (
						<div className='px-5 py-3.5 text-sm text-foreground-faint'>
							No matches for &ldquo;{query}&rdquo;.
							<br />
							<button
								type='button'
								onClick={() => setQuery("")}
								className='mt-2 text-primary underline'>
								Clear the search
							</button>
						</div>
					)}
				</nav>
			</aside>
		</>
	);
}
