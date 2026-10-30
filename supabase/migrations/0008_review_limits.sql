-- 리뷰 남용 막기 (0001~0007 실행 후 적용)
-- 지금까지는 로그인한 계정 하나가 공개 키로 다음을 할 수 있었다.
--   - 같은 대상에 1점 리뷰를 수백 개 넣어 평균 평점을 바꾸고 목록을 도배
--   - created_at 을 '2999-12-31' 로 넣거나 고쳐 자기 리뷰를 맨 위에 고정
--   - 본문·태그·닉네임을 수 MB 로 넣어, 그 정류장을 여는 모든 사람이 내려받게 함
-- 그래서 다음을 정한다.
--   1) 리뷰는 사람마다 대상(정류장·노선·정류장×노선)마다 하나다. 다시 쓰면 앱이 그 리뷰를 고친다(upsert).
--   2) created_at·updated_at 은 서버가 정한다. 클라이언트가 보낸 값은 무시하고, 고쳐도 created_at 은 그대로다.
--   3) 길이 상한: 본문 1000자, 태그 10개(모두 합쳐 200자), 닉네임 30자.
--
-- 이미 쌓인 데이터는 지우지 않는다.
--   - 같은 사람이 같은 대상에 쓴 리뷰가 여럿이면 1) 을 걸 수 없으므로, 개수를 알리고 멈춘다(아무것도 바뀌지 않음).
--     가장 최근 것만 남기려면 아래를 먼저 실행한 뒤 이 파일을 다시 실행한다.
--       delete from public.reviews r using public.reviews n
--       where r.user_id = n.user_id and r.target_type = n.target_type and r.target_id = n.target_id
--         and (r.created_at, r.id) < (n.created_at, n.id);
--   - 길이 상한은 NOT VALID 로 걸어 앞으로 쓰는 행에만 적용한다. 이미 긴 행은 그대로 두되, 고칠 때는 상한 안으로 줄여야 한다.
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
create unique index if not exists reviews_user_target_key
  on public.reviews (user_id, target_type, target_id);

-- 2) 작성·수정 시각은 서버가 정한다.
-- upsert 가 충돌해 수정으로 바뀌면 BEFORE INSERT 뒤에 BEFORE UPDATE 가 다시 불리므로, created_at 은 원래 값으로 돌아간다.
create or replace function public.reviews_set_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_set_timestamps on public.reviews;
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

-- 가입 때 이름 메타데이터(구글 이름 등)가 30자보다 길어도 가입이 실패하지 않게 잘라서 넣는다.
-- 0006 의 함수에서 닉네임을 left(…, 30) 으로 감싼 것만 다르다.
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
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
