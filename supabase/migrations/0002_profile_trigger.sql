-- 신규 가입(auth.users insert) 시 profiles 행 자동 생성.
-- 0001_init.sql 실행 후 이 스크립트도 실행.

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
      '익명-' || left(replace(new.id::text, '-', ''), 4) -- 이메일을 닉네임으로 쓰지 않는다 (기존 DB 는 0006)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
