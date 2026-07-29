-- 정류장×노선 조합 리뷰 지원: target_type 에 'stop_route' 추가.
-- target_id 는 "정류장ID:노선ID" 형식으로 조합을 식별한다. (0001~0003 실행 후 적용)

alter table reviews drop constraint if exists reviews_target_type_check;
alter table reviews add constraint reviews_target_type_check
  check (target_type in ('route', 'stop', 'stop_route'));
