-- 즐겨찾기 (정류소/노선). 0001·0002 실행 후 이 스크립트도 실행.

create table if not exists favorites (
  user_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('route', 'stop')),
  target_id text not null,
  region text not null,
  name text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz default now(),
  primary key (user_id, target_type, target_id)
);

alter table favorites enable row level security;

create policy "own favorites select" on favorites for select using (auth.uid() = user_id);
create policy "own favorites insert" on favorites for insert with check (auth.uid() = user_id);
create policy "own favorites delete" on favorites for delete using (auth.uid() = user_id);
