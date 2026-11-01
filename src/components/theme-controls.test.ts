import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeControls, ThemeRuntime } from "./theme-controls";
import { THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme";

let darkSystem = false;
let onMediaChange: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.themeMode;
  delete document.documentElement.dataset.theme;
  darkSystem = false;
  onMediaChange = undefined;
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return darkSystem; },
    addEventListener: (_: string, listener: () => void) => { onMediaChange = listener; },
    removeEventListener: vi.fn()
  })));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderTheme() {
  return render(createElement("div", null, createElement(ThemeRuntime), createElement(ThemeControls)));
}

it("기본은 데이 모드이며 나이트 선택을 저장하고 다시 열어도 유지한다", () => {
  darkSystem = true;
  const app = renderTheme();
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("button", { name: "데이" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "나이트" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  app.unmount();
  delete document.documentElement.dataset.themeMode;
  renderTheme();
  expect(screen.getByRole("button", { name: "나이트" })).toHaveAttribute("aria-pressed", "true");
});

it("자동 모드만 기기 모드 변경을 따르고 다른 탭 선택도 반영한다", () => {
  renderTheme();
  fireEvent.click(screen.getByRole("button", { name: "자동" }));
  act(() => { darkSystem = true; onMediaChange?.(); });
  expect(document.documentElement.dataset.theme).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "데이" }));
  act(() => { onMediaChange?.(); });
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => { window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" })); });
  expect(screen.getByRole("button", { name: "나이트" })).toHaveAttribute("aria-pressed", "true");
});

it("초기 표시 스크립트는 저장된 모드를 먼저 적용하고 잘못된 값은 데이로 복구한다", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  new Function(themeInitScript)();
  expect(document.documentElement.dataset.theme).toBe("dark");
  localStorage.setItem(THEME_STORAGE_KEY, "invalid");
  new Function(themeInitScript)();
  expect(document.documentElement.dataset.theme).toBe("light");
});
