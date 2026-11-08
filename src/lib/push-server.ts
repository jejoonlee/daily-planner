import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const noStore = { "Cache-Control": "private, no-store" };
export function isTrustedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/.test(url.hostname);
  } catch { return false; }
}
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("server-configuration-missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function authenticatedClient(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { client, user: data.user };
}
export function configurePush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("push-configuration-missing");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return publicKey;
}
export interface PushJob {
  id: string; user_id: string; subscription_id: string; title: string; body: string;
  retry_count: number; entity_type: string;
}

export async function deliverJob(client: SupabaseClient, job: PushJob) {
  const { data: subscription, error } = await client.from("push_subscriptions").select("*").eq("id", job.subscription_id).eq("user_id", job.user_id).eq("active", true).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!subscription || !isTrustedPushEndpoint(subscription.endpoint)) {
    const { error: cancelError } = await client.from("notification_jobs").update({ status: "cancelled" }).eq("id", job.id);
    if (cancelError) throw cancelError;
    return false;
  }
  if (job.entity_type === "daily") {
    const { data: settings, error: settingsError } = await client.from("notification_settings").select("enabled").eq("user_id", job.user_id).is("deleted_at", null).maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.enabled) {
      const { error: cancelError } = await client.from("notification_jobs").update({ status: "cancelled" }).eq("id", job.id);
      if (cancelError) throw cancelError;
      return false;
    }
  }
  let success = false;
  let statusCode = 0;
  try {
    const result = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify({ title: job.title, body: job.body, url: "/", tag: job.id }), { TTL: 300, urgency: "normal", timeout: 8000 });
    statusCode = result.statusCode; success = true;
  } catch (cause) {
    statusCode = cause && typeof cause === "object" && "statusCode" in cause ? Number(cause.statusCode) : 0;
  }
  const expired = statusCode === 404 || statusCode === 410;
  if (expired) {
    const { error: expireError } = await client.from("push_subscriptions").update({ active: false }).eq("id", subscription.id).eq("user_id", job.user_id);
    if (expireError) throw expireError;
  }
  const { error: logError } = await client.from("notification_logs").insert({ user_id: job.user_id, job_id: job.id, subscription_id: subscription.id, success, provider_response: { statusCode }, error: success ? null : `push-status:${statusCode}` });
  if (logError) throw logError;
  const permanentFailure = expired || (statusCode >= 400 && statusCode < 500 && statusCode !== 429);
  const { error: finishError } = await client.from("notification_jobs").update({ status: success ? "sent" : permanentFailure || job.retry_count >= 3 ? "failed" : "pending", locked_at: null }).eq("id", job.id);
  if (finishError) throw finishError;
  return success;
}

export async function dispatchPush(client: SupabaseClient, requestedJob: string | null = null) {
  configurePush();
  if (!requestedJob) {
    const { error } = await client.rpc("enqueue_daily_notifications");
    if (error) throw error;
  }
  const { data, error } = await client.rpc("claim_notification_jobs", { requested_job: requestedJob });
  if (error) throw error;
  let sent = 0;
  for (const job of (data ?? []) as PushJob[]) if (await deliverJob(client, job)) sent++;
  return { claimed: data?.length ?? 0, sent };
}
