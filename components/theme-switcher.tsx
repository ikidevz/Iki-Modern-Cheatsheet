"use client";

import { useEffect, useState } from "react";
import { THEMES } from "@/lib/themes";
import { applyTheme, THEME_STORAGE_KEY } from "@/lib/apply-theme";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export function ThemeSwitcher() {
	const [current, setCurrent] = useState<string>(THEMES[0].label);

	useEffect(() => {
		const theme = document.documentElement.dataset.theme ?? THEMES[0].key;
		setCurrent(theme.charAt(0).toUpperCase() + theme.slice(1));
	}, []);
	function handleChange(key: string | null) {
		if (key === null) return;

		let themeKey = key.toLowerCase();
		applyTheme(themeKey);
		localStorage.setItem(THEME_STORAGE_KEY, themeKey);
		setCurrent(key);
	}

	const active = THEMES.find((t) => t.key === current) ?? THEMES[0];

	return (
		<Select value={current} onValueChange={handleChange}>
			<SelectTrigger aria-label='Theme' className='w-full'>
				<span className='flex items-center gap-2 truncate'>
					<span
						className='w-2 h-2 rounded-full shrink-0'
						style={{ backgroundColor: `${active.swatch}` }}
					/>
					<SelectValue />
				</span>
			</SelectTrigger>
			<SelectContent>
				{THEMES.map((t) => (
					<SelectItem key={t.key} value={t.label}>
						<span className='flex items-center gap-2'>
							<span
								className='w-2 h-2 rounded-full shrink-0'
								style={{ backgroundColor: `hsl(${t.swatch})` }}
							/>
							{t.label}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
