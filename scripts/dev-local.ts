// 로컬 확인용: 내 컴퓨터 안에서만 도는 임시 DB(메모리)와 앱을 함께 띄운다.
// 실제 DB(Neon)를 만들기 전에 화면을 눈으로 확인할 때 쓴다. 종료하면 데이터는 모두 사라진다.
// 실행: npm run dev:local   (접속: http://localhost:3100)
//
// - 운영 DB와 .env에는 아무 영향이 없다. 이 프로세스에서만 접속 주소와 세션 비밀 값을 새로 만들어 쓴다.
// - 아래 계정은 이 임시 DB에만 있는 로컬 확인용이다. 운영에서는 쓰지 않는다.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createAccount } from "../lib/accounts";
import * as schema from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import { seedDev } from "../lib/db/seed-dev";
import type { AppDb } from "../lib/db/types";

const DB_PORT = 5433;
const APP_PORT = 3100;
const ADMIN = { loginId: "admin", password: "Admin12345", name: "로컬 관리자" };
const VIEWER = { loginId: "viewer", password: "Viewer12345", name: "로컬 조회자" };

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as AppDb;

  await migrate(drizzle(client, { schema }), { migrationsFolder: "./drizzle" });
  await seedBase(db, ADMIN);
  await seedDev(db);
  await createAccount(db, { ...VIEWER, role: "viewer" }, { id: 1, name: ADMIN.name });

  const dbServer = new PGLiteSocketServer({ db: client, port: DB_PORT, host: "127.0.0.1", maxConnections: 10 });
  await dbServer.start();

  console.log("\n=== 로컬 확인용 앱 ===");
  console.log(`주소: http://localhost:${APP_PORT}`);
  console.log(`관리자: ${ADMIN.loginId} / ${ADMIN.password}`);
  console.log(`조회자: ${VIEWER.loginId} / ${VIEWER.password}`);
  console.log("개발용 시험 데이터(2026년 9~11월)가 들어 있습니다. 종료는 Ctrl+C. 종료하면 데이터는 사라집니다.\n");

  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const app = spawn(process.execPath, [nextBin, "dev", "-p", String(APP_PORT)], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
      SESSION_SECRET: randomBytes(32).toString("hex"),
    },
  });

  const shutdown = async () => {
    app.kill();
    await dbServer.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  app.on("exit", shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
