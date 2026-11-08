import { adminClient, authenticatedClient, dispatchPush, isTrustedPushEndpoint, noStore } from "@/lib/push-server";

export async function POST(request: Request) {
  try {
    const account = await authenticatedClient(request);
    if (!account) return Response.json({ error: "다시 로그인해 주세요." }, { status: 401, headers: noStore });
    const text = await request.text();
    if (text.length > 4096) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return Response.json({ error: "요청 형식을 확인해 주세요." }, { status: 400 }); }
    const endpoint = input && typeof input === "object" && "endpoint" in input ? input.endpoint : null;
    if (typeof endpoint !== "string" || !isTrustedPushEndpoint(endpoint)) return Response.json({ error: "올바른 기기 알림 연결이 필요합니다." }, { status: 400, headers: noStore });
    const { data: subscription, error: subscriptionError } = await account.client.from("push_subscriptions").select("id").eq("user_id", account.user.id).eq("endpoint", endpoint).eq("active", true).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription) return Response.json({ error: "먼저 이 기기의 알림을 연결해 주세요." }, { status: 400, headers: noStore });
    const admin = adminClient();
    const { data: jobId, error } = await admin.rpc("enqueue_push_test", { owner_id: account.user.id, push_endpoint: endpoint });
    if (error) throw error;
    if (!jobId) return Response.json({ error: "테스트 알림은 1분에 한 번 요청할 수 있습니다." }, { status: 429, headers: noStore });
    const result = await dispatchPush(admin, jobId);
    if (!result.sent) return Response.json({ error: "발송에 실패했습니다. 알림을 다시 연결한 후 시도해 주세요." }, { status: 502, headers: noStore });
    return Response.json({ sent: true }, { headers: noStore });
  } catch {
    console.error("push-test-failed");
    return Response.json({ error: "알림 서버 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: noStore });
  }
}
