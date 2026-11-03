// 운영 시드에 들어가는 서비스 6개의 이름. (DESIGN 10.3)
// 이름을 바꾼 뒤 `npm run seed`를 다시 실행하면 이름이 갱신된다.
// 순서 번호(1~6)는 바꾸지 않는다.
export const SERVICE_NAMES = [
  "KOBI",
  "KOBI+",
  "국유변화탐지",
  "슈퍼로이어",
  "성과나침반",
  "온비드 AI요약",
] as const;
