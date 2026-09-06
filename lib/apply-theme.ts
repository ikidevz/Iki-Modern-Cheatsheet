import { THEMES } from "./themes";

export const THEME_STORAGE_KEY = "cheatsheets-theme";
export const THEME_TYPE_STORAGE_KEY = "cheatsheets-theme-type";
export const DEFAULT_LIGHT = "paper";
export const DEFAULT_DARK = "slate";

export function applyTheme(key: string) {
	const theme = THEMES.find((t) => t.key === key) ?? THEMES[0];
	const root = document.documentElement.style;
	for (const [k, v] of Object.entries(theme.vars))
		root.setProperty(k, String(v));
	document.documentElement.classList.toggle("dark", theme.themeType === "dark");
	document.documentElement.dataset.theme = theme.key;

	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute("content", `hsl(${theme.vars["--card"]})`);
}

export function themeInitScript(): string {
	return `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var key = stored || (prefersDark ? ${JSON.stringify(DEFAULT_DARK)} : ${JSON.stringify(DEFAULT_LIGHT)});
    var themes = ${JSON.stringify(THEMES)};
    var theme = themes.find(function (t) { return t.key === key; }) || themes[0];
    var root = document.documentElement;
    for (var k in theme.vars) root.style.setProperty(k, theme.vars[k]);
    root.classList.toggle('dark', theme.themeType === 'dark');
    root.dataset.theme = theme.key;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', 'hsl(' + theme.vars['--card'] + ')');
  } catch (e) {}
})();
`.trim();
}
