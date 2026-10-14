-- 매직링크(이메일 OTP) 가입자는 이름 메타데이터가 없어서, 0002 의 트리거가 닉네임을 이메일의 @ 앞부분으로 채웠다.
-- profiles 는 누구나 읽을 수 있고(0001) 닉네임은 리뷰 옆에 표시되므로, 공개 키만으로 가입자들의 이메일 앞부분을 모을 수 있었다.
-- 기본 닉네임을 '익명-' + 계정 id 앞 6자리로 바꾸고, 이미 자동으로 채워진 닉네임도 같은 형식으로 바꾼다.

-- 기본 닉네임 형식은 여기 한 곳에서만 정한다 (트리거와 아래 일괄 변경이 함께 쓴다).
-- 6자리(16진수)면 약 1,600만 가지라 서로 구분하기에 충분하다.
create or replace function public.default_nickname(user_id uuid)
returns text
language sql
immutable
as $$
  select '익명-' || left(user_id::text, 6);
$$;

-- 0002 의 트리거 함수를 바꾼다. 이름 메타데이터는 비어 있으면 없는 것으로 본다.
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
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      public.default_nickname(new.id)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 이름 메타데이터가 없는 가입자(매직링크)의 닉네임은 모두 가입 때 이메일 앞부분으로 자동으로 채워진 값이다
-- (닉네임을 바꾸는 화면이 없다). 가입 뒤 이메일을 바꾼 경우와 닉네임이 비어 있는 경우까지 잡도록,
-- 현재 이메일과 비교하지 않고 이 기준으로 모두 바꾼다.
update public.profiles p
set nickname = public.default_nickname(p.id)
from auth.users u
where u.id = p.id
  and nullif(trim(u.raw_user_meta_data ->> 'name'), '') is null
  and nullif(trim(u.raw_user_meta_data ->> 'full_name'), '') is null;
