// 개발용 시험 데이터. 운영 DB에는 넣지 않는다. (DESIGN 10.3)
// 화면을 만들고 확인할 때 쓰는 값이며, 실제 성과 수치가 아니다.
import { asc, eq } from "drizzle-orm";

import { accounts, monthlyInputs, services, surveySettings } from "./schema";
import type { AppDb } from "./types";

const DEV_MONTHS = ["2026-09", "2026-10", "2026-11"] as const;

export type DevSeedResult = {
  monthlyInputCount: number;
  settingCount: number;
};

// 첫 관리자와 서비스 6개가 먼저 있어야 한다. (seedBase를 먼저 실행)
export async function seedDev(db: AppDb): Promise<DevSeedResult> {
  const [admin] = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.role, "admin"))
    .limit(1);
  if (!admin) {
    throw new Error("관리자 계정이 없습니다. 먼저 npm run seed를 실행하세요.");
  }

  const serviceRows = await db.select().from(services).orderBy(asc(services.sortOrder));
  if (serviceRows.length === 0) {
    throw new Error("서비스가 없습니다. 먼저 npm run seed를 실행하세요.");
  }

  const inputRows = serviceRows.flatMap((service, serviceIndex) =>
    DEV_MONTHS.map((yearMonth, monthIndex) => ({
      serviceId: service.id,
      yearMonth,
      callCount: 1000 * (serviceIndex + 1) + 150 * monthIndex,
      source: "개발용 시험 데이터",
      enteredById: admin.id,
      enteredByName: admin.name,
    })),
  );
  await db.insert(monthlyInputs).values(inputRows).onConflictDoNothing();

  const settingRows = serviceRows.flatMap((service, serviceIndex) =>
    (["H1", "H2"] as const).map((half) => ({
      serviceId: service.id,
      year: 2026,
      half,
      savedMinutes: 5 + serviceIndex,
      contributionPct: 90 - serviceIndex * 5,
      correctionFactor: 1,
      source: "개발용 시험 설문",
      enteredById: admin.id,
      enteredByName: admin.name,
    })),
  );
  await db.insert(surveySettings).values(settingRows).onConflictDoNothing();

  return { monthlyInputCount: inputRows.length, settingCount: settingRows.length };
}
