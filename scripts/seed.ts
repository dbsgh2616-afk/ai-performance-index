// 운영 시드 실행: 서비스 6개와 첫 관리자 1개를 DB에 넣는다.
// 실행: npm run seed   (필요한 환경 변수는 .env에 사용자가 직접 넣는다)
import { getDb } from "../lib/db";
import { seedBase } from "../lib/db/seed";

async function main() {
  const loginId = process.env.INITIAL_ADMIN_ID;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!loginId || !password) {
    throw new Error(".env에 INITIAL_ADMIN_ID와 INITIAL_ADMIN_PASSWORD를 넣어 주세요.");
  }

  const result = await seedBase(getDb(), {
    loginId,
    password,
    name: process.env.INITIAL_ADMIN_NAME,
  });

  console.log(`서비스 ${result.serviceCount}개 확인`);
  console.log(result.adminCreated ? "첫 관리자 계정을 만들었습니다." : "관리자 계정이 이미 있어 새로 만들지 않았습니다.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
