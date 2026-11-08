create index tasks_project_owner_idx on public.tasks (project_id,user_id);
create index schedules_project_owner_idx on public.schedules (project_id,user_id);
create index jobs_subscription_owner_idx on public.notification_jobs (subscription_id,user_id);
