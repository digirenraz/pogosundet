-- Slice 2: profiles table
-- Run this in the Supabase SQL editor before testing profile creation.

create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null unique,
  trainer_name text not null,
  friend_code  text not null,
  first_name   text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- All logged-in users can read all profiles (needed for community browser in Slice 4)
create policy "Anyone can read profiles"
  on public.profiles for select using (true);

-- Users can only insert their own profile row
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = user_id);

-- Users can only update their own profile row
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = user_id);
