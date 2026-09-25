create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  language text not null default 'ko',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  default_task_view text not null default 'week' check (default_task_view in ('week', 'month', 'kanban')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text not null default '', goal text,
  area text not null default 'personal' check (area in ('personal', 'company')),
  status text not null default 'ready' check (status in ('ready', 'doing', 'done', 'archived')),
  priority text not null default 'P3' check (priority in ('P1', 'P2', 'P3', 'P4')),
  progress smallint not null default 0 check (progress between 0 and 100),
  start_date date, end_date date, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, description text not null default '', status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due_date date, completed_at timestamptz, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete set null,
  title text not null, description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'P3' check (priority in ('P1', 'P2', 'P3', 'P4')),
  scheduled_date date, start_at timestamptz, due_at timestamptz,
  completed_at timestamptz, completion_note text,
  estimated_minutes integer check (estimated_minutes >= 0), actual_minutes integer check (actual_minutes >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null, description text not null default '', area text not null default 'personal', kind text not null default 'event',
  start_at timestamptz not null, end_at timestamptz, location text, completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'schedule', 'workout')),
  entity_id uuid not null, frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_value integer not null default 1 check (interval_value > 0), days_of_week smallint[], ends_at date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text not null default '', workout_type text, active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  title text not null, workout_type text, started_at timestamptz not null, duration_minutes integer check (duration_minutes >= 0),
  place text, intensity text, condition text, notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  name text not null, exercise_order integer not null default 0, distance_km numeric(8,2), duration_minutes integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null, reps integer, weight_kg numeric(8,2), distance_km numeric(8,2), duration_seconds integer, rest_seconds integer,
  completed boolean not null default false, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (exercise_id, set_number)
);

create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.transaction_categories(id) on delete set null,
  name text not null, flow text not null check (flow in ('expense', 'income', 'saving', 'investment')),
  icon text, is_system boolean not null default false, active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, account_type text not null, institution text, currency char(3) not null default 'KRW', active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.transaction_imports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.financial_accounts(id) on delete set null,
  source text not null, external_batch_id text, status text not null default 'pending', imported_at timestamptz,
  raw_payload jsonb, checksum text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.transaction_categories(id) on delete set null,
  account_id uuid references public.financial_accounts(id) on delete set null,
  import_id uuid references public.transaction_imports(id) on delete set null,
  happened_at timestamptz not null, amount numeric(14,2) not null check (amount >= 0), currency char(3) not null default 'KRW',
  name text not null, merchant text, notes text,
  flow text not null default 'expense' check (flow in ('expense', 'income', 'saving', 'investment')),
  source text not null default 'manual',
  external_key text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (user_id, source, external_key)
);

create table public.notification_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  enabled boolean not null default true, reminder_time time not null default '08:00', days_of_week smallint[] not null default '{1,2,3,4,5,6,0}',
  alert_options jsonb not null default '{"deadline": true, "workout": true}'::jsonb, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null, p256dh text not null, auth_key text not null, device text, active boolean not null default true, last_seen_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (user_id, endpoint)
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  entity_type text, entity_id uuid, scheduled_at timestamptz not null, title text not null, body text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  retry_count integer not null default 0, idempotency_key text not null unique, locked_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  sent_at timestamptz not null default now(), success boolean not null, provider_response jsonb, error text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.tags (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, color text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (user_id, name)
);

create table public.entity_tags (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade, entity_type text not null, entity_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (tag_id, entity_type, entity_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, file_name text not null, storage_key text not null, public_url text,
  mime_type text, size_bytes bigint, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.ai_input_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null, parsed_payload jsonb, status text not null default 'pending', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.watchlist_symbols (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  market text not null check (market in ('KR', 'US')), symbol text not null, name text not null, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (user_id, market, symbol)
);

create index tasks_user_date_idx on public.tasks (user_id, scheduled_date) where deleted_at is null;
create index tasks_project_status_idx on public.tasks (project_id, status, sort_order) where deleted_at is null;
create index transactions_user_date_idx on public.transactions (user_id, happened_at desc) where deleted_at is null;
create index notification_jobs_due_idx on public.notification_jobs (status, scheduled_at) where deleted_at is null;

-- RLS의 user_id 필터와 화면별 기본 조회 경로를 지원하는 인덱스
create index projects_user_active_idx on public.projects (user_id, status, sort_order) where deleted_at is null;
create index project_milestones_user_due_idx on public.project_milestones (user_id, due_date) where deleted_at is null;
create index schedules_user_start_idx on public.schedules (user_id, start_at) where deleted_at is null;
create index recurrence_rules_user_entity_idx on public.recurrence_rules (user_id, entity_type, entity_id) where deleted_at is null;
create index workout_templates_user_active_idx on public.workout_templates (user_id, active, sort_order) where deleted_at is null;
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc) where deleted_at is null;
create index workout_exercises_user_session_idx on public.workout_exercises (user_id, session_id, exercise_order) where deleted_at is null;
create index exercise_sets_user_exercise_idx on public.exercise_sets (user_id, exercise_id, set_number) where deleted_at is null;
create index transaction_categories_user_active_idx on public.transaction_categories (user_id, active, sort_order) where deleted_at is null;
create index financial_accounts_user_active_idx on public.financial_accounts (user_id, active, sort_order) where deleted_at is null;
create index transaction_imports_user_created_idx on public.transaction_imports (user_id, created_at desc) where deleted_at is null;
create index notification_jobs_user_scheduled_idx on public.notification_jobs (user_id, scheduled_at) where deleted_at is null;
create index notification_logs_user_sent_idx on public.notification_logs (user_id, sent_at desc) where deleted_at is null;
create index entity_tags_user_entity_idx on public.entity_tags (user_id, entity_type, entity_id) where deleted_at is null;
create index attachments_user_entity_idx on public.attachments (user_id, entity_type, entity_id) where deleted_at is null;
create index ai_input_logs_user_created_idx on public.ai_input_logs (user_id, created_at desc) where deleted_at is null;

-- PostgreSQL은 FK 인덱스를 자동 생성하지 않으므로 관계 변경·삭제 경로를 별도로 인덱싱
create index project_milestones_project_fk_idx on public.project_milestones (project_id);
create index tasks_project_fk_idx on public.tasks (project_id);
create index tasks_parent_fk_idx on public.tasks (parent_task_id);
create index schedules_project_fk_idx on public.schedules (project_id);
create index workout_sessions_template_fk_idx on public.workout_sessions (template_id);
create index workout_exercises_session_fk_idx on public.workout_exercises (session_id);
create index transaction_categories_parent_fk_idx on public.transaction_categories (parent_id);
create index transaction_imports_account_fk_idx on public.transaction_imports (account_id);
create index transactions_category_fk_idx on public.transactions (category_id);
create index transactions_account_fk_idx on public.transactions (account_id);
create index transactions_import_fk_idx on public.transactions (import_id);
create index notification_jobs_subscription_fk_idx on public.notification_jobs (subscription_id);
create index notification_logs_job_fk_idx on public.notification_logs (job_id);
create index notification_logs_subscription_fk_idx on public.notification_logs (subscription_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','user_preferences','projects','project_milestones','tasks','schedules','recurrence_rules',
    'workout_templates','workout_sessions','workout_exercises','exercise_sets','transaction_categories',
    'financial_accounts','transaction_imports','transactions','notification_settings','push_subscriptions',
    'notification_jobs','notification_logs','tags','entity_tags','attachments','ai_input_logs','watchlist_symbols'
  ] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_owner', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.notification_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
