export type ThemeMode = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "life-flow:theme:v1";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

// Run before the page is painted so a saved night mode never flashes white.
// This script contains only fixed application code, never user-provided content.
export const themeInitScript = `(function(){var mode='light';try{var saved=localStorage.getItem('${THEME_STORAGE_KEY}');if(saved==='light'||saved==='dark'||saved==='system')mode=saved;}catch(e){}var dark=mode==='dark'||(mode==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.themeMode=mode;document.documentElement.dataset.theme=dark?'dark':'light';})();`;
