-- 0001 의 "profiles viewable by everyone"(using (true)) 때문에, 브라우저에 노출되는 공개 키만으로
-- 리뷰를 쓰지 않은 사람까지 모든 가입자의 프로필(id·가입 시각·아바타)을 읽고 가입자 수를 셀 수 있었다.
-- 앱이 프로필을 읽는 곳은 리뷰 목록의 작성자 표시(reviews → profiles(nickname, avatar_url)) 하나뿐이므로,
-- 리뷰를 쓴 사람의 프로필과 본인 프로필만 보이게 행을 좁힌다.
-- 리뷰는 원래 user_id 와 함께 공개라서, 리뷰를 쓴 사람의 프로필이 보이는 것은 지금과 같다.
--
-- 열 단위 권한(created_at 숨기기)은 쓰지 않는다. profiles 에 대한 select * 와 returning * 가 모두 권한 오류가 되어
-- 나중에 프로필 수정 기능을 붙일 때 걸림돌이 되는데, 숨겨서 얻는 것(리뷰 작성자의 가입 시각)은 작다.

-- 대시보드 템플릿 등으로 만든 다른 이름의 SELECT 정책이 남아 있으면 새 정책과 OR 로 합쳐져
-- 모든 행이 계속 보이므로, profiles 의 SELECT 정책은 이름과 관계없이 모두 지우고 하나만 만든다.
-- (여러 번 실행해도 결과가 같다)
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;

create policy "profiles of reviewers and self are viewable"
  on public.profiles for select
  using (
    (select auth.uid()) = id
    or exists (select 1 from public.reviews r where r.user_id = profiles.id)
  );

-- 위 정책이 행마다 그 사람의 리뷰가 있는지 찾으므로 작성자로 찾는 인덱스를 둔다.
create index if not exists reviews_user_idx on public.reviews (user_id);
