import { timingSafeEqual } from "node:crypto";
import { adminClient, dispatchPush, noStore } from "@/lib/push-server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(header);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  try {
    const result = await dispatchPush(adminClient());
    console.info("notification-dispatch", result);
    return Response.json(result, { headers: noStore });
  } catch {
    console.error("notification-dispatch-failed");
    return Response.json({ error: "dispatch-failed" }, { status: 503, headers: noStore });
  }
}
