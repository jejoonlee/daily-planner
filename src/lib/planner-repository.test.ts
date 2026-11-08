import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createPlannerRepository, fromTaskRow, toKoreaInstant, toKoreaLocal } from "./planner-repository";

describe("per-user repository", () => {
  it("한국 날짜/시간을 UTC로 왕복 변환하고 자정의 날짜를 보존한다", () => {
    expect(toKoreaInstant("2026-11-08T00:15")).toBe("2026-11-07T15:15:00.000Z");
    expect(toKoreaLocal("2026-11-07T15:15:00+00:00")).toBe("2026-11-08T00:15");
    expect(fromTaskRow({ id: "t", scheduled_date: "2026-11-08", due_at: "2026-11-07T15:15:00Z" }).dueDate).toBe("2026-11-08");
  });

  it("목록 500건 이후도 읽고 모든 조회에 소유자 필터를 붙인다", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const u = new URL(String(url));
      expect(u.searchParams.get("user_id")).toBe("eq.owner-a");
      const data = u.pathname.endsWith("/tasks") && u.searchParams.get("offset") === "0" ? Array.from({ length: 500 }, (_, id) => ({ id: String(id), scheduled_date: "2026-11-08" })) : [];
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    });
    const client = createClient("https://test.supabase.co", "test-key", { global: { fetch: fetcher }, auth: { persistSession: false } });
    const result = await createPlannerRepository(client, "owner-a").load();
    expect(result.tasks).toHaveLength(500);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("offset=500"))).toBe(true);
  });

  it("수정 삭제에는 소유자와 변경 버전을 조건으로 걸고 충돌을 실패로 전달한다", async () => {
    const requests: { url: URL; method: string }[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: new URL(String(url)), method: init?.method ?? "GET" });
      return new Response(JSON.stringify({ code: "PGRST116", message: "0 rows" }), { status: 406, headers: { "Content-Type": "application/json" } });
    });
    const client = createClient("https://test.supabase.co", "test-key", { global: { fetch: fetcher }, auth: { persistSession: false } });
    await expect(createPlannerRepository(client, "owner-a").remove("task", { id: "task-id", updatedAt: "2026-11-08T01:00:00Z" })).rejects.toMatchObject({ code: "PGRST116" });
    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url.searchParams.get("user_id")).toBe("eq.owner-a");
    expect(requests[0].url.searchParams.get("updated_at")).toBe("eq.2026-11-08T01:00:00Z");
  });
});
