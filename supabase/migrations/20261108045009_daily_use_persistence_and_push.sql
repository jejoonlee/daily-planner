-- Additive changes only: preserve existing records and ownership policies.
alter table public.tasks add column area text not null default 'personal' check (length(area) between 1 and 32);
alter table public.tasks add column due_date date;
alter table public.workout_sessions add column exercise text not null default '';
alter table public.workout_sessions add column sets integer not null default 0 check (sets between 0 and 100);
alter table public.workout_sessions add column reps integer not null default 0 check (reps between 0 and 10000);
alter table public.workout_sessions add column weight_kg numeric(8,2) not null default 0 check (weight_kg between 0 and 2000);
alter table public.transactions add column category_label text not null default '미분류';
alter table public.transactions add column account_label text not null default '미지정';
alter table public.user_preferences add column task_areas text[] not null default '{}';
alter table public.notification_settings add column reminder_times time[] not null default '{08:00}' check (cardinality(reminder_times) between 1 and 3 and array_position(reminder_times, null) is null);
alter table public.notification_settings alter column enabled set default false;
alter table public.notification_settings add constraint notification_days_valid check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]);

-- A valid foreign ID must ALSO belong to the same user. RLS alone does not protect FKs.
alter table public.projects add constraint projects_id_owner_unique unique (id, user_id);
alter table public.tasks add constraint tasks_project_owner_fk foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id);
alter table public.schedules add constraint schedules_project_owner_fk foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id);
alter table public.push_subscriptions add constraint push_id_owner_unique unique (id, user_id);
alter table public.notification_jobs add constraint jobs_subscription_owner_fk foreign key (subscription_id, user_id) references public.push_subscriptions(id, user_id) on delete set null (subscription_id);
alter table public.push_subscriptions add constraint push_endpoint_unique unique (endpoint);
-- Prevent a user from making the sender request arbitrary URLs (SSRF).
alter table public.push_subscriptions add constraint push_endpoint_provider check (
  endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9-]+\.push\.apple\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com)/'
);

-- Only the server worker can create, claim or alter delivery jobs and logs.
drop policy notification_jobs_owner on public.notification_jobs;
drop policy notification_logs_owner on public.notification_logs;
create policy notification_jobs_read on public.notification_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_logs_read on public.notification_logs for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.notification_jobs, public.notification_logs from authenticated, anon;

create or replace function public.enqueue_daily_notifications() returns integer
language plpgsql security invoker set search_path = '' as $$
declare inserted integer;
begin
  update public.notification_jobs j set status = 'cancelled'
  where j.status in ('pending','processing') and j.entity_type = 'daily'
    and (j.scheduled_at < now() - interval '15 minutes' or not exists (
      select 1 from public.notification_settings s where s.user_id=j.user_id and s.enabled and s.deleted_at is null
    ));
  insert into public.notification_jobs (user_id, subscription_id, entity_type, scheduled_at, title, body, idempotency_key)
  select s.user_id, p.id, 'daily', due.at, 'Life Flow 일정 알림', '앱에서 오늘 일정과 할 일을 확인해 주세요.',
    'daily:' || s.user_id || ':' || p.id || ':' || due.at::text
  from public.notification_settings s
  join public.push_subscriptions p on p.user_id=s.user_id and p.active and p.deleted_at is null
  cross join lateral unnest(s.reminder_times) as t(reminder)
  cross join lateral (select (((now() at time zone 'Asia/Seoul')::date + t.reminder) at time zone 'Asia/Seoul') as at) due
  where s.enabled and s.deleted_at is null
    and extract(dow from now() at time zone 'Asia/Seoul')::smallint = any(s.days_of_week)
    and due.at <= now() and due.at > now() - interval '10 minutes'
    and due.at >= s.updated_at - interval '1 minute'
  on conflict (idempotency_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.claim_notification_jobs(requested_job uuid default null)
returns setof public.notification_jobs language sql security invoker set search_path = '' as $$
  update public.notification_jobs j
  set status='processing', locked_at=now(), retry_count=j.retry_count+1
  where j.id in (
    select n.id from public.notification_jobs n
    where n.deleted_at is null and n.scheduled_at <= now() and n.scheduled_at > now() - interval '15 minutes'
      and n.retry_count < 3 and (requested_job is null or n.id=requested_job)
      and (n.status='pending' or (n.status='processing' and n.locked_at < now()-interval '5 minutes'))
    order by n.scheduled_at limit 30 for update skip locked
  ) returning j.*;
$$;

create or replace function public.enqueue_push_test(owner_id uuid, push_endpoint text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare job uuid;
begin
  insert into public.notification_jobs (user_id, subscription_id, entity_type, scheduled_at, title, body, idempotency_key)
  select owner_id, p.id, 'test', now(), 'Life Flow 테스트 알림', '서버에서 보낸 푸시 알림입니다.',
    'test:' || owner_id || ':' || p.id || ':' || date_trunc('minute', now())::text
  from public.push_subscriptions p where p.user_id=owner_id and p.endpoint=push_endpoint and p.active and p.deleted_at is null
  on conflict (idempotency_key) do nothing returning id into job;
  return job;
end;
$$;

revoke all on function public.enqueue_daily_notifications(), public.claim_notification_jobs(uuid), public.enqueue_push_test(uuid,text) from public, anon, authenticated;
grant execute on function public.enqueue_daily_notifications(), public.claim_notification_jobs(uuid), public.enqueue_push_test(uuid,text) to service_role;

-- A user-scoped, read-only boundary for the app and future assistant integration.
create or replace function public.get_daily_briefing()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'timezone', 'Asia/Seoul', 'asOf', now(),
    'schedules', coalesce((select jsonb_agg(s order by s.start_at) from public.schedules s
      where s.user_id=(select auth.uid()) and s.deleted_at is null and s.start_at >= date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
      and s.start_at < (date_trunc('day',now() at time zone 'Asia/Seoul')+interval '7 days') at time zone 'Asia/Seoul'), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(t order by t.priority,t.scheduled_date) from public.tasks t
      where t.user_id=(select auth.uid()) and t.deleted_at is null and t.status <> 'done'
      and (t.scheduled_date <= (now() at time zone 'Asia/Seoul')::date + 7 or t.due_date <= (now() at time zone 'Asia/Seoul')::date + 7)), '[]'::jsonb)
  );
$$;
revoke all on function public.get_daily_briefing() from public, anon;
grant execute on function public.get_daily_briefing() to authenticated;

-- Existing users predate the signup trigger; provision only missing preference rows.
insert into public.profiles (user_id) select id from auth.users where deleted_at is null on conflict (user_id) do nothing;
insert into public.user_preferences (user_id) select id from auth.users where deleted_at is null on conflict (user_id) do nothing;
insert into public.notification_settings (user_id,enabled) select id,false from auth.users where deleted_at is null on conflict (user_id) do nothing;
