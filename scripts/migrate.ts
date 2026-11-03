// DB 구조를 최신으로 맞춘다 (drizzle 폴더의 SQL 파일을 순서대로 한 번씩 적용).
// 실행: npm run db:migrate   (DATABASE_URL이 환경 변수나 .env에 있어야 한다)
// drizzle-kit 대신 앱과 같은 접속 설정(lib/db, SSL 포함)을 써서 운영 DB(Supabase 등)에도 그대로 적용된다.
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getDb } from "../lib/db";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("DB 구조를 최신으로 맞췄습니다.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
