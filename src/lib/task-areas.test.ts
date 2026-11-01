import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { taskAreaLabel, useTaskAreas } from "./task-areas";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it("계정마다 추가 구분을 분리하고 이전 성당 구분을 유지한다", () => {
  const { result, rerender } = renderHook(({ owner }) => useTaskAreas(owner, ["church"]), { initialProps: { owner: "user-a" } });
  expect(result.current.areas).toEqual(["company", "personal", "church"]);
  expect(taskAreaLabel("church")).toBe("성당");
  expect(() => result.current.addArea("성당")).toThrow("이미 있는 구분");
  act(() => { result.current.addArea("공부"); });
  expect(result.current.areas).toContain("공부");
  rerender({ owner: "user-b" });
  expect(result.current.areas).not.toContain("공부");
  rerender({ owner: "user-a" });
  expect(result.current.areas).toContain("공부");
});

it("손상된 저장값 빈 이름 예약값 과도한 길이를 처리한다", () => {
  localStorage.setItem("life-flow:task-areas:v1:user-a", "not-json");
  const { result } = renderHook(() => useTaskAreas("user-a", []));
  expect(result.current.areas).toEqual(["company", "personal"]);
  expect(() => result.current.addArea("  ")).toThrow("이름을 입력");
  expect(() => result.current.addArea("all")).toThrow("이미 있는 구분");
  expect(() => result.current.addArea("a".repeat(33))).toThrow("32자");
});

it("브라우저 저장 실패를 성공으로 표시하지 않는다", () => {
  const { result } = renderHook(() => useTaskAreas("user-a", []));
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  try {
    expect(() => result.current.addArea("공부")).toThrow("저장하지 못했습니다");
    expect(result.current.areas).not.toContain("공부");
  } finally { storage.mockRestore(); }
});
