# 버스로그 — 서울·경기 버스 리뷰

실시간 버스 도착 정보를 **네이버지도 스타일 UI**로 보여주고, **노선·정류장에 리뷰**를 남길 수 있는 웹앱.

> 🔗 **데모: https://bus-review.vercel.app** · 📸 (스크린샷/GIF 추가 예정)

> ⚠️ **버스 실시간 데이터는 현재 목업으로 동작합니다.** 공공데이터포털이 2025년 국가정보자원관리원(대전) 화재 여파로 인증키 동기화 장애가 이어지고 있어, 실 API 연동 코드(`lib/bus/`)는 어댑터 패턴으로 구현해 두고 데모는 목업 데이터로 돌립니다. 소스가 서울 열린데이터광장 등으로 바뀌어도 어댑터만 교체하면 됩니다. (리뷰·인증은 Supabase로 완전히 라이브)

## 스크린샷

<!-- docs/ 폴더에 이미지를 넣고 아래 주석(<!-- -->)을 해제하세요 -->
<!-- ![지도와 주변 정류장](docs/map.png) -->
<!-- ![정류장 실시간 도착 + 리뷰](docs/review.png) -->
<!-- ![노선 선택 시 실시간 버스 이동](docs/buses.gif) -->

## 주요 기능

- 지도에서 주변 **정류장**을 보고, 클릭하면 **실시간 도착 정보**(30초 갱신)
- **노선/정류장 리뷰** — 별점 + 태그 + 텍스트 (로그인 필요)
- 정류장/노선 **검색**
- 서울·경기 지원

## 기술 스택

- **Next.js 15 (App Router)** · TypeScript
- **네이버 지도 (NCP Maps SDK)**
- **TanStack Query** (실시간 도착 폴링·캐싱) · **Jotai** (지도 UI 상태)
- **Supabase** (Postgres · Auth · RLS) — 리뷰 저장/인증
- Tailwind CSS · Vitest

## 아키텍처 포인트

- **공공 API는 CORS를 막아서** → Next.js Route Handler(`app/api/*`)를 경유해 호출 (API 키도 서버에 숨김)
- **서울/경기 API 스키마가 달라** → `lib/bus/`에 provider 어댑터를 두고 **공통 타입으로 정규화**
- 실시간 도착은 **폴링**(30초) + 서버 캐시로 호출량 절약
- 리뷰 권한은 **Supabase RLS**로 본인만 수정 가능

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 키 입력 (없어도 BUS_USE_MOCK=true 면 목업으로 동작)
npm run dev                  # http://localhost:3000
npm test                     # 유닛 테스트
```

### 환경변수 (`.env.local`)

| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_NCP_KEY_ID` | 네이버 클라우드 플랫폼 Maps 키 (없으면 지도 자리에 안내 표시) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Supabase 프로젝트 |
| `SEOUL_BUS_API_KEY` / `GYEONGGI_BUS_API_KEY` | 공공데이터포털 버스 API (서버 전용) |
| `BUS_USE_MOCK` | `true`면 실 API 없이 목업 데이터로 동작 |

## 상태 / 로드맵

- [x] 지도 + 주변 정류장 + 목업 도착정보 (M0~M2 스캐폴딩)
- [ ] 서울/경기 실 API 어댑터 연동 (`lib/bus/seoul.ts`, `gyeonggi.ts`)
- [ ] 노선 상세 + 경로 폴리라인 (M3)
- [ ] 리뷰 CRUD + 로그인 (M4)
- [ ] 검색 (M5)
- [ ] 마커 클러스터링·성능·배포 (M6)

설계 상세는 [`DESIGN.md`](./DESIGN.md) 참고.
