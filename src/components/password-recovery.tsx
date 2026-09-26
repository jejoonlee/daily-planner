"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loginSchema } from "@/lib/validation";

export function PasswordRecovery({ client, mode, onClose }: {
  client: SupabaseClient | null;
  mode: "forgot" | "reset";
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || complete) return;
    setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const value = String(values.get(mode === "forgot" ? "email" : "password") ?? "");
    const validation = (mode === "forgot" ? loginSchema.shape.email : loginSchema.shape.password).safeParse(value);
    if (!validation.success) { setError(validation.error.issues[0].message); return; }
    if (mode === "reset" && value !== values.get("confirm")) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (!client) { setError("인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."); return; }
    pending.current = true;
    setBusy(true);
    try {
      const result = mode === "forgot"
        ? await client.auth.resetPasswordForEmail(validation.data, { redirectTo: `${window.location.origin}/` })
        : await client.auth.updateUser({ password: value });
      if (result.error) {
        const { code, status } = result.error;
        setError(status === 429 ? "요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요."
          : code === "same_password" ? "기존 비밀번호와 다른 비밀번호를 입력해 주세요."
          : code === "weak_password" ? "더 안전한 비밀번호를 입력해 주세요."
          : code === "email_address_not_authorized" ? "메일 발송 설정이 필요합니다. 관리자에게 문의해 주세요."
          : mode === "reset" ? "비밀번호를 변경하지 못했습니다. 인증 링크가 만료되었다면 재설정 메일을 다시 요청해 주세요."
          : "재설정 메일을 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      form.reset();
      setComplete(true);
    } catch {
      setError("인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <main className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="brand"><span className="brand-mark">L</span><span>Life Flow</span></div>
    <h1>{mode === "forgot" ? "비밀번호 찾기" : "새 비밀번호 설정"}</h1>
    <p>{mode === "forgot" ? "가입한 이메일로 비밀번호 재설정 링크를 요청하세요." : "새 비밀번호를 8자 이상 입력해 주세요."}</p>
    {!complete && (mode === "forgot"
      ? <label><span>이메일</span><input name="email" type="email" autoComplete="email" required disabled={busy} /></label>
      : <><label><span>새 비밀번호</span><input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={busy} /></label><label><span>새 비밀번호 확인</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required disabled={busy} /></label></>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    {complete && <p role="status">{mode === "forgot" ? "등록된 이메일이면 재설정 안내를 받을 수 있습니다. 받은편지함과 스팸함을 확인해 주세요." : "비밀번호가 변경되었습니다."}</p>}
    {!complete && <button className="primary-button full-button" type="submit" disabled={busy || !client}>{busy ? "처리 중…" : mode === "forgot" ? "재설정 메일 보내기" : "비밀번호 변경"}</button>}
    <button className="text-button" type="button" disabled={busy} onClick={onClose}>{mode === "reset" ? "앱으로 돌아가기" : "로그인으로 돌아가기"}</button>
  </form></main>;
}
