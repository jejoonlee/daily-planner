create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

-- Only pg_cron's database owner invokes this. The credential stays in Vault,
-- never in this migration, browser code, or cron.job.command.
create or replace function private.dispatch_preview_notifications() returns bigint
language plpgsql security invoker set search_path = '' as $$
declare credential text; request_id bigint;
begin
  select decrypted_secret into credential from vault.decrypted_secrets where name='life_flow_preview_cron_secret';
  if credential is null then return null; end if;
  update public.notification_jobs set status='failed',locked_at=null
    where status='processing' and retry_count>=3 and locked_at<now()-interval '5 minutes';
  update public.notification_jobs set status='cancelled',locked_at=null
    where status in ('pending','processing') and scheduled_at<now()-interval '15 minutes';
  select net.http_post(
    url := 'https://daily-planner-git-codex-pre-deploy-hardening-jay-jay8.vercel.app/api/notifications/dispatch',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),
    body := '{}'::jsonb, timeout_milliseconds := 300000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.dispatch_preview_notifications() from public,anon,authenticated,service_role;
-- Activation is a separate deployment step after the Preview worker is verified.
