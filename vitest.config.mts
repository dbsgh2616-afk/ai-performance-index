import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig의 "@/*" 경로(프로젝트 폴더)를 시험에서도 같게 쓴다.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // 시험용 DB(pglite)에 마이그레이션을 적용하는 시간이 걸릴 수 있다.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
