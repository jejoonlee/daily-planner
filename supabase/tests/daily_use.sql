-- Run as an owner, on the approved project. All fixtures roll back; no mail/push is sent.
begin;
insert into auth.users (id, aud, role, email, created_at, updated_at) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf931','authenticated','authenticated','lifeflow-rls-a@example.invalid',now(),now()),
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf932','authenticated','authenticated','lifeflow-rls-b@example.invalid',now(),now());
insert into public.projects (id,user_id,name) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf941','a76b7fb5-928a-4f3b-b52c-200b5b0bf931','fixture-a'),
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf942','a76b7fb5-928a-4f3b-b52c-200b5b0bf932','fixture-b');
insert into public.tasks (user_id,project_id,title,scheduled_date,due_date,area) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf931','a76b7fb5-928a-4f3b-b52c-200b5b0bf941','fixture-a',current_date,current_date,'company'),
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf932','a76b7fb5-928a-4f3b-b52c-200b5b0bf942','fixture-b',current_date,current_date,'personal');
insert into public.schedules (user_id,title,start_at) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf931','fixture-a',now()),('a76b7fb5-928a-4f3b-b52c-200b5b0bf932','fixture-b',now());
insert into public.workout_sessions (user_id,title,started_at,exercise,sets,reps,weight_kg) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf931','fixture-a',now(),'squat',3,8,40),('a76b7fb5-928a-4f3b-b52c-200b5b0bf932','fixture-b',now(),'squat',3,8,40);
insert into public.transactions (user_id,name,happened_at,amount,category_label,account_label) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf931','fixture-a',now(),100,'food','cash'),('a76b7fb5-928a-4f3b-b52c-200b5b0bf932','fixture-b',now(),200,'food','cash');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a76b7fb5-928a-4f3b-b52c-200b5b0bf931","role":"authenticated"}',true);
do $$
declare count_rows integer;
begin
  if exists(select 1 from public.tasks where title='fixture-b') or exists(select 1 from public.projects where name='fixture-b')
    or exists(select 1 from public.schedules where title='fixture-b') or exists(select 1 from public.transactions where name='fixture-b')
    or exists(select 1 from public.workout_sessions where title='fixture-b') then raise exception 'cross-owner read'; end if;
  update public.tasks set title='changed' where title='fixture-b'; get diagnostics count_rows=row_count;
  if count_rows<>0 then raise exception 'cross-owner update'; end if;
  delete from public.transactions where name='fixture-b'; get diagnostics count_rows=row_count;
  if count_rows<>0 then raise exception 'cross-owner delete'; end if;
  begin
    update public.tasks set project_id='a76b7fb5-928a-4f3b-b52c-200b5b0bf942' where title='fixture-a';
    raise exception 'cross-owner reference allowed';
  exception when foreign_key_violation then null; end;
  update public.tasks set title='fixture-a-edited' where title='fixture-a';
  if not exists(select 1 from public.tasks where title='fixture-a-edited') then raise exception 'own update'; end if;
  delete from public.projects where name='fixture-a';
  if not exists(select 1 from public.tasks where title='fixture-a-edited' and project_id is null) then raise exception 'project unlink lost task'; end if;
  if public.get_daily_briefing()::text like '%fixture-b%' then raise exception 'briefing leaked data'; end if;
  if has_function_privilege('authenticated','public.claim_notification_jobs(uuid)','EXECUTE') then raise exception 'worker exposed'; end if;
  if has_table_privilege('authenticated','public.notification_jobs','INSERT') then raise exception 'jobs writable'; end if;
  begin
    insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_key) values ('a76b7fb5-928a-4f3b-b52c-200b5b0bf931','https://127.0.0.1/secret','test','test');
    raise exception 'arbitrary push URL accepted';
  exception when check_violation then null; end;
  delete from public.tasks where title='fixture-a-edited';
  if exists(select 1 from public.tasks where title='fixture-a-edited') then raise exception 'own delete'; end if;
end $$;
reset role;

insert into public.push_subscriptions(id,user_id,endpoint,p256dh,auth_key) values
 ('a76b7fb5-928a-4f3b-b52c-200b5b0bf951','a76b7fb5-928a-4f3b-b52c-200b5b0bf931','https://fcm.googleapis.com/fixture-never-sent','test','test');
update public.notification_settings set enabled=true, reminder_times=array[(now() at time zone 'Asia/Seoul')::time] where user_id='a76b7fb5-928a-4f3b-b52c-200b5b0bf931';
set local role service_role;
select public.enqueue_daily_notifications();
select public.enqueue_daily_notifications();
do $$
declare job_count integer; claimed_count integer;
begin
  select count(*) into job_count from public.notification_jobs where user_id='a76b7fb5-928a-4f3b-b52c-200b5b0bf931' and entity_type='daily';
  if job_count<>1 then raise exception 'duplicate or missing daily job: %',job_count; end if;
  select count(*) into claimed_count from public.claim_notification_jobs();
  if claimed_count<1 then raise exception 'claim failed'; end if;
  if exists(select 1 from public.claim_notification_jobs() where user_id='a76b7fb5-928a-4f3b-b52c-200b5b0bf931') then raise exception 'double claim'; end if;
end $$;
reset role;
rollback;
select 'PASS: owner CRUD, cross-owner RLS/FKs, briefing privacy, SSRF guard, job idempotency and exclusive claim; all fixtures rolled back' as result;
