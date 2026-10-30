-- 리뷰 남용 막기 (0001~0007 실행 후 적용)
-- 지금까지는 로그인한 계정 하나가 공개 키로 다음을 할 수 있었다.
--   - 같은 대상에 1점 리뷰를 수백 개 넣어 평균 평점을 바꾸고 목록을 도배
--   - created_at 을 '2999-12-31' 로 넣거나 고쳐 자기 리뷰를 맨 위에 고정
--   - 본문·태그·닉네임·아바타 주소를 수 MB 로 넣어, 그 정류장 리뷰를 여는 모든 사람이 내려받게 함
-- 그래서 다음을 정한다.
--   1) 리뷰는 사람마다 대상(정류장·노선·정류장×노선)마다 하나다. 다시 쓰면 앱이 그 리뷰를 고친다(upsert).
--   2) 앱(anon·authenticated)이 보낸 created_at·updated_at 은 무시하고 서버가 정한다. 고쳐도 created_at 은 그대로다.
--      SQL Editor(postgres) 같은 관리자 작업은 막지 않는다. 이미 미래 시각으로 넣어 둔 행은 지금 시각으로 바로잡는다.
--   3) 길이 상한: 본문 1000자, 태그 10개(모두 합쳐 200자), 닉네임 30자, 아바타 주소 500자.
--
-- 이미 쌓인 데이터는 지우지 않는다.
--   - 같은 사람이 같은 대상에 쓴 리뷰가 여럿이면 1) 을 걸 수 없으므로, 개수를 알리고 멈춘다(아무것도 바뀌지 않음).
--     가장 최근 것만 남기려면 아래를 먼저 실행한 뒤 이 파일을 다시 실행한다(미래·빈 작성 시각은 지금으로 보고 비교).
--       delete from public.reviews r using public.reviews n
--       where r.user_id = n.user_id and r.target_type = n.target_type and r.target_id = n.target_id
--         and (least(coalesce(r.created_at, now()), now()), r.id) < (least(coalesce(n.created_at, now()), now()), n.id);
--   - 길이 상한은 NOT VALID 로 걸어 앞으로 쓰는 행에만 적용한다. 상한을 넘는 기존 행이 있으면 개수를 NOTICE 로 알린다.
--     그런 행은 고칠 때 상한 안으로 줄여야 하며, 찾으려면 아래 3) 의 조건으로 select 한다.
-- 여러 번 실행해도 결과가 같다.

do $$
declare
  dup int;
begin
  select count(*) into dup
  from (
    select 1 from public.reviews
    group by user_id, target_type, target_id
    having count(*) > 1
  ) d;
  if dup > 0 then
    raise exception '같은 사람이 같은 대상에 쓴 리뷰가 % 쌍 있습니다. 0008 파일 머리의 정리 쿼리를 먼저 실행하세요.', dup;
  end if;
end $$;

-- 1) 사람·대상마다 리뷰 하나. 앱은 이 인덱스로 upsert(on conflict) 한다.
-- 첫 열이 user_id 라 0007 의 reviews_user_idx(프로필 정책의 작성자 찾기)도 이 인덱스로 처리되므로 그 인덱스는 지운다.
create unique index if not exists reviews_user_target_key
  on public.reviews (user_id, target_type, target_id);
drop index if exists public.reviews_user_idx;

-- 2) 작성·수정 시각은 서버가 정한다.
-- 트리거를 다시 만들기 전에(트리거가 있으면 created_at 을 고칠 수 없으므로) 미래·빈 시각을 지금으로 바로잡는다.
drop trigger if exists reviews_set_timestamps on public.reviews;
update public.reviews
set created_at = least(coalesce(created_at, now()), now()),
    updated_at = least(coalesce(updated_at, now()), now())
where created_at is null or created_at > now() or updated_at is null or updated_at > now();

-- upsert 가 충돌해 수정으로 바뀌면 BEFORE INSERT 뒤에 BEFORE UPDATE 가 다시 불리므로, created_at 은 원래 값으로 돌아간다.
create or replace function public.reviews_set_timestamps()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new; -- 관리자 작업(SQL Editor 등)은 그대로 둔다
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_set_timestamps
  before insert or update on public.reviews
  for each row execute function public.reviews_set_timestamps();

-- 3) 길이 상한 (기존 행은 검사하지 않음)
alter table public.reviews drop constraint if exists reviews_content_length;
alter table public.reviews add constraint reviews_content_length
  check (char_length(content) <= 1000) not valid;

alter table public.reviews drop constraint if exists reviews_tags_limit;
alter table public.reviews add constraint reviews_tags_limit
  check (cardinality(tags) <= 10 and char_length(array_to_string(tags, '')) <= 200) not valid;

alter table public.profiles drop constraint if exists profiles_nickname_length;
alter table public.profiles add constraint profiles_nickname_length
  check (char_length(nickname) <= 30) not valid;

alter table public.profiles drop constraint if exists profiles_avatar_url_length;
alter table public.profiles add constraint profiles_avatar_url_length
  check (char_length(avatar_url) <= 500) not valid;

do $$
declare
  long_reviews int;
  long_profiles int;
begin
  select count(*) into long_reviews from public.reviews
  where char_length(content) > 1000 or cardinality(tags) > 10 or char_length(array_to_string(tags, '')) > 200;
  select count(*) into long_profiles from public.profiles
  where char_length(nickname) > 30 or char_length(avatar_url) > 500;
  if long_reviews > 0 or long_profiles > 0 then
    raise notice '상한을 넘는 기존 행: 리뷰 % 개, 프로필 % 개 (지우지 않고 그대로 둠)', long_reviews, long_profiles;
  end if;
end $$;

-- 가입 때 이름·아바타 메타데이터가 상한보다 길어도 가입이 실패하지 않게 잘라서 넣는다.
-- 0006 의 함수에서 닉네임을 left(…, 30), 아바타 주소를 left(…, 500) 으로 감싼 것만 다르다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        public.default_nickname(new.id)
      ),
      30
    ),
    left(new.raw_user_meta_data ->> 'avatar_url', 500)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
