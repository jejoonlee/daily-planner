"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const DEFAULT_TASK_AREAS = ["company", "personal"];
const CHANGE_EVENT = "life-flow-task-areas-changed";

export function taskAreaLabel(area: string) {
  if (area === "company") return "회사";
  if (area === "personal") return "개인";
  // Preserve labels on records created before custom categories were introduced.
  if (area === "church") return "성당";
  return area;
}

function normalize(value: string) {
  return value.normalize("NFKC").trim();
}

function decodeAreas(raw: string) {
  try {
    const values: unknown = JSON.parse(raw);
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && normalize(value).length > 0 && normalize(value).length <= 32).map(normalize) : [];
  } catch {
    return [];
  }
}

export function useTaskAreas(ownerId: string, usedAreas: string[]) {
  const storageKey = `life-flow:task-areas:v1:${encodeURIComponent(ownerId)}`;
  const subscribe = useCallback((notify: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) notify();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, notify);
    };
  }, [storageKey]);
  const getSnapshot = useCallback(() => {
    try { return window.localStorage.getItem(storageKey) ?? "[]"; }
    catch { return "[]"; }
  }, [storageKey]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const customAreas = useMemo(() => decodeAreas(raw), [raw]);
  const areas = Array.from(new Set([...DEFAULT_TASK_AREAS, ...customAreas, ...usedAreas]));

  function addArea(input: string) {
    const name = normalize(input);
    if (!name) throw new Error("새 구분 이름을 입력해 주세요.");
    if (name.length > 32) throw new Error("구분은 32자 이내로 입력해 주세요.");
    const current = decodeAreas(getSnapshot());
    const reserved = ["전체", "all", "company", "personal", "church"];
    if ([...reserved, ...areas.map(taskAreaLabel), ...current].some((value) => normalize(value).toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error("이미 있는 구분입니다. 다른 이름을 입력해 주세요.");
    }
    try { window.localStorage.setItem(storageKey, JSON.stringify([...current, name])); }
    catch { throw new Error("구분을 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요."); }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return name;
  }

  return { areas, addArea };
}
