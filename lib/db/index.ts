// Design Ref: §2.2 — 모든 DB 접근은 lib/db로만 한다. 화면은 DB를 직접 열지 않는다.
// 이 파일은 서버 코드에서만 가져다 쓴다. DATABASE_URL은 비밀 값이라 브라우저에 보내지 않는다.
//
// 동시에 두 사람이 고치는 경우를 막으려면 (작업 6·13에서 지킬 것)
// - "이전 값 읽기 → 저장 → 변경 이력 기록"은 db.transaction 안에서 한 번에 처리한다.
// - "마지막 관리자 삭제 금지"는 같은 트랜잭션에서 관리자 행을 잠근 뒤(for update) 센다.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export * from "./schema";

type Db = NodePgDatabase<typeof schema>;

let db: Db | undefined;

// 서버리스 환경(Vercel)에서 연결이 쌓이지 않도록 한 번에 쓰는 연결 수를 작게 잡는다.
const MAX_CONNECTIONS = 5;

// 처음 쓸 때 한 번만 연결한다. 가져오기만 해서는 연결하지 않으므로,
// DATABASE_URL이 없는 상태에서도 build가 통과한다.
export function getDb(): Db {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다. .env에 DB 접속 주소를 넣어 주세요.");
  }

  // 내 컴퓨터(localhost)의 임시 DB가 아니면 SSL로 암호화해서 연결한다. (Supabase·Neon 등 클라우드 DB는 필수)
  // 클라우드 DB의 인증서는 일반 인증서 목록에 없는 경우가 있어 인증서 검증은 하지 않고 암호화만 켠다.
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(connectionString);
  const pool = new Pool({ connectionString, max: MAX_CONNECTIONS, ssl: isLocal ? undefined : { rejectUnauthorized: false } });

  // 연결이 끊기면 서버가 멈추지 않도록 오류를 기록만 한다.
  // 접속 주소(비밀 값)는 기록하지 않고 오류 메시지만 남긴다. (DESIGN 8장 "DB 오류")
  pool.on("error", (error) => {
    console.error("DB 연결 오류:", error.message);
  });

  db = drizzle(pool, { schema });
  return db;
}
