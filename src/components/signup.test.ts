import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LifeFlowApp } from "./life-flow-app";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn()
}));
vi.mock("@/lib/supabase-client", () => ({
  hasSupabaseConfig: true,
  getSupabaseBrowserClient: () => ({ auth })
}));

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange.mockReturnValue({ data: { listener: null, subscription: { unsubscribe: vi.fn() } } });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(cleanup);

it("재설정 메일 안내에서 계정 등록 여부를 노출하지 않는다", async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  render(createElement(LifeFlowApp));
  fireEvent.click(await screen.findByRole("button", { name: "비밀번호 찾기" }));
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "재설정 메일 보내기" }));
  expect(await screen.findByRole("status")).toHaveTextContent("등록된 이메일이면");
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("member@example.com", { redirectTo: `${window.location.origin}/` });
});

it("재설정 메일 전송 오류를 성공으로 표시하지 않는다", async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } });
  render(createElement(LifeFlowApp));
  fireEvent.click(await screen.findByRole("button", { name: "비밀번호 찾기" }));
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "재설정 메일 보내기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 기다린 뒤");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("복구 인증 이벤트는 새 비밀번호 화면을 열고 일치하는 값만 저장한다", async () => {
  auth.updateUser.mockResolvedValue({ error: null });
  render(createElement(LifeFlowApp));
  await screen.findByRole("button", { name: "비밀번호 찾기" });
  act(() => auth.onAuthStateChange.mock.calls[0][0]("PASSWORD_RECOVERY", { user: { id: "test-user" } }));
  expect(screen.getByRole("heading", { name: "새 비밀번호 설정" })).toBeInTheDocument();
  expect(window.location.hash).toBe("#reset-password");
  fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "NewPassword123!" } });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "Different123!" } });
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
  expect(auth.updateUser).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "NewPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
  expect(await screen.findByRole("status")).toHaveTextContent("비밀번호가 변경되었습니다.");
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "NewPassword123!" });
  fireEvent.click(screen.getByRole("button", { name: "앱으로 돌아가기" }));
  expect(window.location.hash).toBe("");
});

it("복구 세션 없이 재설정 주소를 열면 비밀번호 변경을 허용하지 않는다", async () => {
  window.history.replaceState(null, "", "/#reset-password");
  render(createElement(LifeFlowApp));
  expect(await screen.findByRole("alert")).toHaveTextContent("재설정 링크가 만료되었습니다");
  expect(screen.queryByLabelText("새 비밀번호")).not.toBeInTheDocument();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it("인증된 복구 화면은 새로고침 후에도 유지되고 저장 실패 시 재시도할 수 있다", async () => {
  window.history.replaceState(null, "", "/#reset-password");
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: "test-user" } } }, error: null });
  auth.updateUser.mockResolvedValue({ error: { code: "same_password", status: 422 } });
  render(createElement(LifeFlowApp));
  fireEvent.change(await screen.findByLabelText("새 비밀번호"), { target: { value: "NewPassword123!" } });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "NewPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("기존 비밀번호와 다른");
  expect(screen.getByRole("button", { name: "비밀번호 변경" })).toBeEnabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

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
