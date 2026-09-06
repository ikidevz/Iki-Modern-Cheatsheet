"use client";

import { useEffect, useState } from "react";
import { THEMES } from "@/lib/themes";
import { applyTheme, THEME_STORAGE_KEY } from "@/lib/apply-theme";
import type { ThemeType } from "@/lib/types";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type ThemeSwitcherProps = {
	onThemeTypeChange: (themeType: ThemeType) => void;
};

export function ThemeSwitcher({ onThemeTypeChange }: ThemeSwitcherProps) {
	const [current, setCurrent] = useState<string>(THEMES[0].label);

	useEffect(() => {
		const key = document.documentElement.dataset.theme ?? THEMES[0].key;
		const theme = THEMES.find((item) => item.key === key) ?? THEMES[0];
		setCurrent(theme.label);
		onThemeTypeChange(theme.themeType);
	}, [onThemeTypeChange]);

	function handleChange(label: string | null) {
		if (label === null) return;

		const theme = THEMES.find((item) => item.label === label);
		if (!theme) return;

		applyTheme(theme.key);
		localStorage.setItem(THEME_STORAGE_KEY, theme.key);
		setCurrent(theme.label);
		onThemeTypeChange(theme.themeType);
	}

	const active = THEMES.find((theme) => theme.label === current) ?? THEMES[0];

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
