// Design Ref: §2.2 — 모든 DB 접근은 lib/db로만 한다. 화면은 DB를 직접 열지 않는다.
// 이 파일은 서버 코드에서만 가져다 쓴다. DATABASE_URL은 비밀 값이라 브라우저에 보내지 않는다.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export * from "./schema";

type Db = NodePgDatabase<typeof schema>;

let db: Db | undefined;

// 처음 쓸 때 한 번만 연결한다. 가져오기만 해서는 연결하지 않으므로,
// DATABASE_URL이 없는 상태에서도 build가 통과한다.
export function getDb(): Db {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다. .env에 DB 접속 주소를 넣어 주세요.");
  }

  const pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
  return db;
}
