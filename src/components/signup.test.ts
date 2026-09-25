import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LifeFlowApp } from "./life-flow-app";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn()
}));
vi.mock("@/lib/supabase-client", () => ({
  hasSupabaseConfig: true,
  getSupabaseBrowserClient: () => ({ auth })
}));

beforeEach(() => {
  vi.resetAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange.mockReturnValue({ data: { listener: null, subscription: { unsubscribe: vi.fn() } } });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(cleanup);

async function fillSignup(confirm = "StrongPassword123!") {
  render(createElement(LifeFlowApp));
  fireEvent.click(await screen.findByRole("button", { name: "처음이신가요? 회원가입" }));
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "StrongPassword123!" } });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
}

it("비밀번호가 다르면 가입 요청을 보내지 않는다", async () => {
  await fillSignup("Different123!");
  expect(screen.getByRole("alert")).toHaveTextContent("비밀번호가 일치하지 않습니다.");
  expect(auth.signUp).not.toHaveBeenCalled();
});

it("실제 가입 API를 호출하고 세션이 없으면 이메일 인증을 안내한다", async () => {
  await fillSignup();
  await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({
    email: "member@example.com", password: "StrongPassword123!",
    options: { emailRedirectTo: `${window.location.origin}/` }
  }));
  expect(await screen.findByRole("status")).toHaveTextContent("가입 확인 메일");
  expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  expect(screen.queryByRole("heading", { name: "좋은 아침이에요" })).not.toBeInTheDocument();
});

it("인증 세션이 반환되면 앱으로 진입한다", async () => {
  auth.signUp.mockResolvedValue({ data: { session: { user: { id: "test-user" } } }, error: null });
  await fillSignup();
  expect(await screen.findByRole("button", { name: "할 일" })).toBeInTheDocument();
});

it("메일 전송 제한 시 성공 안내 대신 재시도 안내를 표시한다", async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: { code: "over_email_send_rate_limit", status: 429 } });
  await fillSignup();
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 기다린 뒤");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "회원가입" })).toBeEnabled();
});

it("인증되지 않은 계정의 로그인에 이메일 인증 안내를 표시한다", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", status: 400 } });
  render(createElement(LifeFlowApp));
  fireEvent.change(await screen.findByLabelText("이메일"), { target: { value: "member@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "StrongPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("이메일 인증이 필요합니다");
});
