// 운영 DB(node-postgres)와 시험용 DB(pglite)가 같은 함수를 쓸 수 있게 하는 공통 타입
import type { PgDatabase } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

// 두 DB 연결 방식이 반환하는 결과 형태가 달라서 any로 받는다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = PgDatabase<any, typeof schema>;

// db.transaction(async (tx) => ...)의 tx 타입
export type AppTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

// 트랜잭션 안과 밖에서 모두 쓸 수 있는 실행자
export type Executor = AppDb | AppTx;
