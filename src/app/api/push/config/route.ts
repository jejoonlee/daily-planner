import { configurePush, noStore } from "@/lib/push-server";

export function GET() {
  try { return Response.json({ publicKey: configurePush() }, { headers: noStore }); }
  catch { return Response.json({ error: "서버의 푸시 설정이 준비되지 않았습니다." }, { status: 503, headers: noStore }); }
}
