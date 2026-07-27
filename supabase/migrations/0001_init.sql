-- 버스 리뷰 앱 초기 스키마
-- Supabase SQL Editor 에 붙여넣어 실행하거나 supabase db push 로 적용.

-- 1) 프로필 (auth.users 와 1:1)
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2) 리뷰 (노선/정류장 공통)
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('route', 'stop')),
  target_id text not null, -- 외부 버스 API 의 노선ID / 정류장ID
  region text not null check (region in ('seoul', 'gyeonggi')),
  user_id uuid not null references profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  content text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists reviews_target_idx on reviews (target_type, target_id);

-- 3) 표시용 캐시 (선택): 리뷰 목록에서 노선/정류장 이름을 API 재호출 없이 표시
create table if not exists bus_targets (
  target_type text not null,
  target_id text not null,
  region text not null,
  name text,
  meta jsonb,
  primary key (target_type, target_id)
);

-- 4) RLS — 리뷰는 누구나 읽고, 본인 것만 쓰기/수정/삭제
alter table reviews enable row level security;

create policy "reviews are viewable by everyone"
  on reviews for select using (true);

create policy "users insert own reviews"
  on reviews for insert with check (auth.uid() = user_id);

create policy "users update own reviews"
  on reviews for update using (auth.uid() = user_id);

create policy "users delete own reviews"
  on reviews for delete using (auth.uid() = user_id);

alter table profiles enable row level security;
create policy "profiles viewable by everyone" on profiles for select using (true);
create policy "users upsert own profile" on profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);
