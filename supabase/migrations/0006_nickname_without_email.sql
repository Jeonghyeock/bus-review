-- 매직링크(이메일 OTP) 가입자는 이름 메타데이터가 없어서, 0002 의 트리거가 닉네임을 이메일의 @ 앞부분으로 채웠다.
-- profiles 는 누구나 읽을 수 있고(0001) 닉네임은 리뷰 옆에 표시되므로, 공개 키만으로 가입자들의 이메일 앞부분을 모을 수 있었다.
-- 기본 닉네임을 '익명-' + 계정 id 앞 4자리로 바꾸고, 이미 이메일 앞부분으로 채워진 닉네임도 같은 형식으로 바꾼다.

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
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      '익명-' || left(replace(new.id::text, '-', ''), 4)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 사람이 직접 정한 닉네임은 건드리지 않도록, 이메일 앞부분과 정확히 같은 경우만 바꾼다.
update public.profiles p
set nickname = '익명-' || left(replace(p.id::text, '-', ''), 4)
from auth.users u
where u.id = p.id
  and p.nickname = split_part(u.email, '@', 1);
