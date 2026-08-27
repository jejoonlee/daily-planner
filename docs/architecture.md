# Life Flow Architecture

## Runtime

- Next.js App Router PWA on Vercel
- Supabase Auth, PostgreSQL, Storage, and Cron
- Web Push with VAPID and a custom service worker

## Notification flow

1. A user enables notifications and stores a browser push subscription.
2. Recurrence rules create idempotent notification jobs.
3. Supabase Cron invokes the notification dispatch endpoint every minute.
4. The worker claims due jobs, sends Web Push, and writes delivery logs.
5. Notification clicks open the relevant Life Flow entry page.

## Data ownership

Every user-owned table has a `user_id` and Row Level Security policy. Database changes are committed as SQL migrations in `supabase/migrations`.
