// 시험용 DB: 메모리에서 도는 PostgreSQL(pglite)에 실제 마이그레이션 SQL을 그대로 적용한다.
// 그래서 제약조건과 변경 이력 수정 방지 장치(trigger)까지 운영과 같게 시험할 수 있다.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../../lib/db/schema";
import type { AppDb } from "../../lib/db/types";

export async function createTestDb(): Promise<{ db: AppDb; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db: db as unknown as AppDb, close: () => client.close() };
}
