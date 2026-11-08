import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlannerData, Task } from "@/lib/types";
import { LifeFlowApp } from "./life-flow-app";

const fixture = vi.hoisted(() => ({ load: vi.fn(), saveTask: vi.fn(), remove: vi.fn(), authListener: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ hasSupabaseConfig: true, getSupabaseBrowserClient: () => ({ auth: {
  getSession: async () => ({ data: { session: { user: { id: "owner-a" } } }, error: null }),
  onAuthStateChange: (callback: unknown) => { fixture.authListener(callback); return { data: { subscription: { unsubscribe: vi.fn() } } }; }
} }) }));
vi.mock("@/lib/planner-repository", async (original) => ({ ...await original<typeof import("@/lib/planner-repository")>(), createPlannerRepository: () => ({ load: fixture.load, saveTask: fixture.saveTask, remove: fixture.remove }) }));

let data: PlannerData;
beforeEach(() => {
  vi.clearAllMocks();
  data = { projects: [], tasks: [], workouts: [], transactions: [], schedules: [], areas: [], notifications: { enabled: false, times: ["08:00"], days: [1,2,3,4,5,6,0] } };
  fixture.load.mockImplementation(async () => structuredClone(data));
});
afterEach(cleanup);
async function newTask() {
  render(createElement(LifeFlowApp));
  fireEvent.click(await screen.findByRole("button", { name: "할 일" }));
  fireEvent.click(screen.getByRole("button", { name: "+ 할 일" }));
  fireEvent.change(screen.getByLabelText("할 일 제목"), { target: { value: "실제 저장할 기록" } });
  fireEvent.click(screen.getByRole("button", { name: "할 일 저장" }));
}

it("서버 저장 실패를 성공으로 알리지 않고 입력 모달과 값을 유지한다", async () => {
  fixture.saveTask.mockRejectedValue(new Error("offline"));
  await newTask();
  expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("서버에 저장하지 못했습니다");
  expect(screen.getByLabelText("할 일 제목")).toHaveValue("실제 저장할 기록");
  expect(screen.queryByText("새 할 일을 저장했습니다.")).not.toBeInTheDocument();
});

it("저장 확인을 기다린 다음 목록에 추가하고 재실행 때 서버에서 복원한다", async () => {
  let resolve!: (value: Task) => void;
  let record!: Task;
  fixture.saveTask.mockImplementation((task: Task) => { record = { ...task, updatedAt: "2026-11-08T01:00:00Z" }; return new Promise<Task>((done) => { resolve = done; }); });
  await newTask();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("서버에 저장하고 있습니다…")).toBeInTheDocument();
  data.tasks = [record];
  await act(async () => resolve(record));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  cleanup();
  render(createElement(LifeFlowApp));
  fireEvent.click(await screen.findByRole("button", { name: "할 일" }));
  fireEvent.click(screen.getByRole("button", { name: "칸반" }));
  expect(screen.getByRole("button", { name: /실제 저장할 기록/ })).toBeInTheDocument();
});

it("읽기 오류 때 샘플 기록이나 다른 사용자 기록을 보여주지 않는다", async () => {
  fixture.load.mockRejectedValue(new Error("offline"));
  render(createElement(LifeFlowApp));
  expect(await screen.findByRole("alert")).toHaveTextContent("기록을 불러오지 못했습니다");
  expect(screen.queryByText("CJ ENM 대만 오픈")).not.toBeInTheDocument();
  expect(screen.queryByText("병원 예약하기")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();
});

it("계정을 바꾸면 이전 계정 데이터는 즉시 숨긴 뒤 새 계정 데이터를 읽는다", async () => {
  data.tasks = [{ id: "old-task", title: "이전 사용자 비공개", area: "personal", description: "private", status: "todo", priority: "P1", scheduledDate: "2026-11-08", dueDate: "2026-11-08", estimatedMinutes: 15 }];
  render(createElement(LifeFlowApp));
  await screen.findByRole("button", { name: "할 일" });
  fixture.load.mockImplementation(() => new Promise(() => {}));
  act(() => fixture.authListener.mock.calls[0][0]("SIGNED_IN", { user: { id: "owner-b" } }));
  await waitFor(() => expect(screen.getByText("내 기록을 불러오고 있습니다.")).toBeInTheDocument());
  expect(screen.queryByText("이전 사용자 비공개")).not.toBeInTheDocument();
});
