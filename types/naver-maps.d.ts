export {};

declare global {
  interface Window {
    // 네이버 지도 SDK는 전역 window.naver 로 노출됨.
    // 타입 패키지 없이 스캐폴딩하므로 any 로 두고, 필요 시 @types/navermaps 도입.
    naver: any;
  }
}
