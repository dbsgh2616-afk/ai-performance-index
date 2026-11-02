// DB 구조(lib/db/schema.ts)를 SQL 파일로 만들고 DB에 반영하는 도구(drizzle-kit)의 설정
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // 비밀 값이라 코드에 적지 않고 환경 변수에서 읽는다.
    url: process.env.DATABASE_URL ?? "",
  },
});
