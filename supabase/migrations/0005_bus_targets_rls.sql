-- bus_targets(0001)는 RLS 없이 만들어져, 브라우저에 노출되는 공개 키(anon)로 누구나 읽고 쓰고 지울 수 있었다.
-- 앱은 이 테이블을 쓰지 않으므로 클라이언트 역할(anon·authenticated)의 권한을 모두 거두고 RLS 도 켠다.
-- RLS 만 켜면 TRUNCATE 같은 권한이 남고 정책 하나만 추가해도 다시 열리므로, 권한도 함께 거둔다.
-- 나중에 이 테이블을 쓰게 되면 필요한 권한과 정책을 그때 명시적으로 추가한다.
-- 0001 에서 이 테이블(선택 항목)을 만들지 않은 DB 에서도 오류 없이 지나가도록 존재할 때만 처리한다.
do $$
begin
  if to_regclass('public.bus_targets') is not null then
    alter table public.bus_targets enable row level security;
    revoke all on table public.bus_targets from anon, authenticated;
  end if;
end $$;
