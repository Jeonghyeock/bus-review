-- bus_targets(0001)는 RLS 없이 만들어져, 브라우저에 노출되는 공개 키(anon)로 누구나 읽고 쓰고 지울 수 있었다.
-- 앱 코드는 이 테이블을 쓰지 않으므로 정책 없이 RLS 만 켜서 anon·authenticated 접근을 막는다.
-- service_role 은 RLS 를 우회하므로, 나중에 서버에서 표시용 캐시로 쓸 때도 영향이 없다.
alter table bus_targets enable row level security;
