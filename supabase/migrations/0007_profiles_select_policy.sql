-- 0001 의 "profiles viewable by everyone"(using (true)) 때문에, 브라우저에 노출되는 공개 키만으로
-- 리뷰를 쓰지 않은 사람까지 모든 가입자의 id·가입 시각(created_at)·아바타를 읽을 수 있었다.
-- 앱이 프로필을 읽는 곳은 리뷰 목록의 작성자 표시(reviews → profiles(nickname, avatar_url)) 하나뿐이므로
--   1) 행: 리뷰를 쓴 사람의 프로필과 본인 프로필만 보이게 하고
--   2) 열: 클라이언트 역할(anon·authenticated)은 id·nickname·avatar_url 만 읽게 한다.
-- 리뷰는 원래 user_id 와 함께 공개라서, 리뷰를 쓴 사람의 id 가 보이는 것은 지금과 같다.
-- 여러 번 실행해도 결과가 같도록 정책은 지우고 다시 만든다.

drop policy if exists "profiles viewable by everyone" on public.profiles;
drop policy if exists "profiles of reviewers and self are viewable" on public.profiles;
create policy "profiles of reviewers and self are viewable"
  on public.profiles for select
  using (
    (select auth.uid()) = id
    or exists (select 1 from public.reviews r where r.user_id = profiles.id)
  );

-- 위 정책이 행마다 그 사람의 리뷰가 있는지 찾으므로 작성자로 찾는 인덱스를 둔다.
create index if not exists reviews_user_idx on public.reviews (user_id);

revoke select on table public.profiles from anon, authenticated;
grant select (id, nickname, avatar_url) on table public.profiles to anon, authenticated;
