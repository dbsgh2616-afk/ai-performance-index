import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // 시험용 DB(pglite)에 마이그레이션을 적용하는 시간이 걸릴 수 있다.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
