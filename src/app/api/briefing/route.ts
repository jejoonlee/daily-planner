import { authenticatedClient, noStore } from "@/lib/push-server";

export async function GET(request: Request) {
  try {
    const account = await authenticatedClient(request);
    if (!account) return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
    const { data, error } = await account.client.rpc("get_daily_briefing");
    if (error) throw error;
    return Response.json(data, { headers: noStore });
  } catch {
    console.error("briefing-read-failed");
    return Response.json({ error: "보고용 데이터를 불러오지 못했습니다." }, { status: 503, headers: noStore });
  }
}
