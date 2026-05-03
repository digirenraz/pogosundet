-- Push notification subscriptions per user.
-- One row per user — re-subscribing upserts the row.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade unique,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own subscription"
  on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role (Edge Function) bypasses RLS to read all subscriptions.
