"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationPreferences } from "@/lib/types";
import { createPlannerRepository } from "@/lib/planner-repository";
import { firstValidationError, notificationSchema } from "@/lib/validation";

export function vapidKeyBytes(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export async function activeWorker() {
  await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("앱을 다시 열고 알림 연결을 재시도해 주세요.")), 10000); })]);
  } finally { clearTimeout(timer); }
}

export function PushSettings({ client, ownerId, initial, onSaved }: { client: SupabaseClient | null; ownerId: string | null; initial: NotificationPreferences; onSaved: (value: NotificationPreferences) => void }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  function requireAccount() {
    if (!client || !ownerId) throw new Error("실제 계정으로 로그인한 뒤 알림을 연결해 주세요.");
    return { client, ownerId };
  }
  function connect() {
    // Request permission directly from this user gesture (required by iOS).
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("이 환경에서는 푸시를 지원하지 않습니다. 아이폰은 iOS 16.4 이상에서 홈 화면에 설치한 앱을 열어 주세요."); return;
    }
    const permission = Notification.requestPermission();
    void run(async () => {
      const account = requireAccount();
      if (await permission !== "granted") throw new Error("알림 권한을 허용해 주세요. 이미 차단했다면 기기 설정에서 변경해야 합니다.");
      const configResponse = await fetch("/api/push/config", { cache: "no-store" });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey) throw new Error("서버의 푸시 설정이 준비되지 않았습니다.");
      const registration = await activeWorker();
      const old = await registration.pushManager.getSubscription();
      if (old) {
        const { error: disableError } = await account.client.from("push_subscriptions").update({ active: false }).eq("user_id", account.ownerId).eq("endpoint", old.endpoint);
        if (disableError) throw new Error("기존 알림 연결을 갱신하지 못했습니다.");
        await old.unsubscribe();
      }
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(config.publicKey) });
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) { await subscription.unsubscribe(); throw new Error("기기 알림 키를 생성하지 못했습니다."); }
      const { error: saveError } = await account.client.from("push_subscriptions").upsert({ user_id: account.ownerId, endpoint: subscription.endpoint, p256dh: keys.p256dh, auth_key: keys.auth, device: navigator.userAgent.slice(0, 200), active: true, last_seen_at: new Date().toISOString() }, { onConflict: "user_id,endpoint" }).select("id").single();
      if (saveError) { await subscription.unsubscribe(); throw new Error("알림 구독을 서버에 저장하지 못했습니다. 다시 시도해 주세요."); }
      setMessage("이 기기의 알림을 연결했습니다. 시간과 요일을 선택하고 설정을 저장해 주세요.");
    });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const account = requireAccount();
      const parsed = notificationSchema.safeParse(value);
      if (!parsed.success) throw new Error(firstValidationError(parsed.error));
      if (value.enabled) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription || Notification.permission !== "granted") throw new Error("먼저 ‘이 기기 알림 연결’을 눌러 주세요.");
      }
      await createPlannerRepository(account.client, account.ownerId).saveNotifications(value);
      onSaved(value);
      setMessage(value.enabled ? "예약 알림 설정을 서버에 저장했습니다. 기기 상태에 따라 수신은 지연될 수 있습니다." : "예약 알림을 껐습니다.");
    });
  }
  function test() {
    void run(async () => {
      const account = requireAccount();
      const { data, error: sessionError } = await account.client.auth.getSession();
      if (sessionError || !data.session) throw new Error("로그인 상태를 확인한 뒤 다시 시도해 주세요.");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("먼저 ‘이 기기 알림 연결’을 눌러 주세요.");
      const response = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "서버 테스트 알림을 보내지 못했습니다.");
      setMessage("서버에서 테스트 알림을 발송했습니다. 휴대폰 알림함에서 수신을 확인해 주세요.");
    });
  }
  return <form className="panel settings-panel" onSubmit={save}>
    <div className="panel-heading"><strong>예약 푸시 알림</strong><span>한국 시간</span></div>
    <p>앱을 닫아도 서버에서 발송합니다. 채팅의 AI 일상 보고 시간과는 별도 설정입니다.</p>
    <fieldset disabled={busy} className="settings-fields">
      <label className="setting-row"><span>예약 알림 사용</span><input type="checkbox" checked={value.enabled} onChange={(e) => setValue({ ...value, enabled: e.target.checked })} /></label>
      <label className="field"><span>하루 알림 횟수</span><select value={value.times.length} onChange={(e) => setValue({ ...value, times: ["08:00", "13:00", "20:00"].slice(0, Number(e.target.value)).map((fallback, i) => value.times[i] ?? fallback) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}회</option>)}</select></label>
      {value.times.map((time, i) => <label className="field" key={i}><span>알림 시간 {i + 1}</span><input type="time" required value={time} onChange={(e) => setValue({ ...value, times: value.times.map((v, j) => i === j ? e.target.value : v) })} /></label>)}
      <div className="day-options">{[1, 2, 3, 4, 5, 6, 0].map((day, i) => <label key={day}><input type="checkbox" checked={value.days.includes(day)} onChange={(e) => setValue({ ...value, days: e.target.checked ? [...value.days, day] : value.days.filter((v) => v !== day) })} />{"월화수목금토일"[i]}</label>)}</div>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={connect}>이 기기 알림 연결</button><button className="primary-button" type="submit">설정 저장</button><button className="secondary-button" type="button" onClick={test}>테스트 알림</button></div>
    </fieldset>
    {busy && <p role="status">처리 중…</p>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </form>;
}
