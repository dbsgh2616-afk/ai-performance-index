// DB 구조(lib/db/schema.ts)를 SQL 파일로 만들고 DB에 반영하는 도구(drizzle-kit)의 설정
import { defineConfig } from "drizzle-kit";

// SQL 파일만 만드는 generate는 DB가 필요 없다. DB에 접속하는 명령만 접속 주소를 확인한다.
const needsDatabase = process.argv.some((arg) => ["migrate", "push", "pull", "studio"].includes(arg));

if (needsDatabase && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 설정되지 않았습니다. .env에 DB 접속 주소를 넣어 주세요.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // 비밀 값이라 코드에 적지 않고 환경 변수에서 읽는다.
    url: process.env.DATABASE_URL ?? "",
  },
});
