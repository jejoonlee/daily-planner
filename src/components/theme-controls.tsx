"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isThemeMode, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

const THEME_EVENT = "life-flow-theme-changed";
const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "데이", icon: "☀" },
  { value: "dark", label: "나이트", icon: "☾" },
  { value: "system", label: "자동", icon: "◐" }
];

function getMode(): ThemeMode {
  const value = document.documentElement.dataset.themeMode;
  return isThemeMode(value) ? value : "light";
}

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", dark ? "#242422" : "#f7f6f2"));
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(notify: () => void) {
  window.addEventListener(THEME_EVENT, notify);
  return () => window.removeEventListener(THEME_EVENT, notify);
}

export function ThemeRuntime() {
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Keep the current session's choice when storage is unavailable. */ }
    applyTheme(isThemeMode(saved) ? saved : getMode());
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if (getMode() === "system") applyTheme("system"); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(isThemeMode(event.newValue) ? event.newValue : "light");
    };
    media?.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

export function ThemeControls() {
  const mode = useSyncExternalStore(subscribe, getMode, () => "light");
  return <div className="theme-controls" role="group" aria-label="화면 모드">
    {themeOptions.map((option) => <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => {
      applyTheme(option.value);
      try { window.localStorage.setItem(THEME_STORAGE_KEY, option.value); } catch { /* The selected theme still works for this session. */ }
    }}><span aria-hidden="true">{option.icon}</span>{option.label}</button>)}
  </div>;
}
