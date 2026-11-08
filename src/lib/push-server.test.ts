import { expect, it } from "vitest";
import { isTrustedPushEndpoint } from "./push-server";
import { notificationSchema, scheduleSchema } from "./validation";

it("푸시 서버 주소만 허용하고 내부망 사용자정보 포트와 유사 도메인은 차단한다", () => {
  expect(isTrustedPushEndpoint("https://web.push.apple.com/Qdevice")).toBe(true);
  expect(isTrustedPushEndpoint("https://fcm.googleapis.com/fcm/send/device")).toBe(true);
  for (const url of ["http://fcm.googleapis.com/a", "https://127.0.0.1/secret", "https://fcm.googleapis.com.evil.test/a", "https://user:pass@fcm.googleapis.com/a", "https://fcm.googleapis.com:8080/a"]) expect(isTrustedPushEndpoint(url)).toBe(false);
});
it("예약 시간 중복과 잘못된 시각 요일을 거절한다", () => {
  expect(notificationSchema.safeParse({ enabled: true, times: ["08:00", "20:00"], days: [1,2,3] }).success).toBe(true);
  for (const value of [{ enabled: true, times: ["08:00", "08:00"], days: [1] }, { enabled: true, times: ["24:00"], days: [1] }, { enabled: true, times: ["08:00"], days: [] }]) expect(notificationSchema.safeParse(value).success).toBe(false);
});
it("일정의 종료 시간이 시작보다 빠르면 등록을 거절한다", () => {
  expect(scheduleSchema.safeParse({ title: "미팅", description: "", location: "", area: "company", startedAt: "2026-11-08T09:00", endedAt: "2026-11-08T08:00" }).success).toBe(false);
});
