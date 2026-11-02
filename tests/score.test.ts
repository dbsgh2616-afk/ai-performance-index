// 작업 6·7: 지수 계산(DESIGN 10.1 시나리오)과 변경 이력 기록 장치를 확인한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { recordChanges } from "../lib/changelog";
import { changeLogs } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import { seedDev } from "../lib/db/seed-dev";
import type { AppDb } from "../lib/db/types";
import {
  calculateMonth,
  calculateServiceScore,
  calculateYear,
  type ScoreData,
  type ScoreSetting,
} from "../lib/score";
import { loadScoreData } from "../lib/score/load";
import { createTestDb } from "./helpers/db";

const SERVICES = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `서비스${index + 1}` }));

function setting(serviceId: number, half: "H1" | "H2", overrides: Partial<ScoreSetting> = {}): ScoreSetting {
  return {
    serviceId,
    year: 2026,
    half,
    savedMinutes: 5,
    contributionPct: 90,
    correctionFactor: 1,
    evidenceGrade: "설문 추정",
    ...overrides,
  };
}

// 서비스 6개 모두 1,000건 호출, 상반기·하반기 같은 설정값
function fullData(months: string[], overrides: Partial<ScoreData> = {}): ScoreData {
  return {
    year: 2026,
    services: SERVICES,
    inputs: SERVICES.flatMap((service) =>
      months.map((yearMonth) => ({
        serviceId: service.id,
        yearMonth,
        callCount: 1000,
        evidenceGrade: "실측" as const,
      })),
    ),
    settings: SERVICES.flatMap((service) => [setting(service.id, "H1"), setting(service.id, "H2")]),
    securityIncidentMonths: [],
    ...overrides,
  };
}

describe("서비스 점수 산식", () => {
  it("호출 1,000 × 5분 × 기여도 90% × 보정 1.0 = 4,500", () => {
    expect(calculateServiceScore(1000, { savedMinutes: 5, contributionPct: 90, correctionFactor: 1 })).toBeCloseTo(4500);
  });

  it("보정계수가 곱해진다", () => {
    expect(calculateServiceScore(1000, { savedMinutes: 5, contributionPct: 90, correctionFactor: 0.8 })).toBeCloseTo(3600);
  });
});

describe("월별 지수", () => {
  it("서비스 6개를 모두 입력하면 월 합계는 6개의 합이다", () => {
    const month = calculateMonth(fullData(["2026-03"]), "2026-03");
    expect(month.rawTotal).toBeCloseTo(4500 * 6);
    expect(month.total).toBeCloseTo(27000);
    expect(month.penaltyApplied).toBe(false);
  });

  it("보안사고가 있는 달은 합계가 50% 감점된다", () => {
    const month = calculateMonth(fullData(["2026-03"], { securityIncidentMonths: ["2026-03"] }), "2026-03");
    expect(month.rawTotal).toBeCloseTo(27000);
    expect(month.total).toBeCloseTo(13500);
    expect(month.penaltyApplied).toBe(true);
  });

  it("보안사고 기록이 없는 달은 감점하지 않는다", () => {
    const month = calculateMonth(fullData(["2026-03"]), "2026-03");
    expect(month.incident).toBe(false);
    expect(month.total).toBeCloseTo(27000);
  });

  it("서비스 1개의 입력이 없으면 그 서비스와 월 합계는 '데이터 없음'(null)이다", () => {
    const data = fullData(["2026-03"]);
    data.inputs = data.inputs.filter((row) => row.serviceId !== 3);
    const month = calculateMonth(data, "2026-03");
    expect(month.services[2]).toMatchObject({ score: null, missing: "input" });
    expect(month.missingServiceCount).toBe(1);
    expect(month.total).toBeNull();
  });

  it("설정값이 없는 반기의 서비스는 '데이터 없음'이다", () => {
    const data = fullData(["2026-09"]);
    data.settings = data.settings.filter((row) => !(row.serviceId === 2 && row.half === "H2"));
    const month = calculateMonth(data, "2026-09");
    expect(month.services[1]).toMatchObject({ score: null, missing: "setting" });
    expect(month.total).toBeNull();
  });

  it("아무 입력도 없는 달은 합계가 null이다", () => {
    const month = calculateMonth(fullData([]), "2026-05");
    expect(month.total).toBeNull();
    expect(month.surveyShare).toBeNull();
  });
});

describe("반기별 설정값", () => {
  it("하반기 설정값을 바꾸면 7~12월 지수만 바뀌고 1~6월은 그대로다", () => {
    const months = ["2026-03", "2026-09"];
    const before = calculateYear(fullData(months));

    const changed = fullData(months);
    changed.settings = changed.settings.map((row) =>
      row.half === "H2" ? { ...row, savedMinutes: 10 } : row,
    );
    const after = calculateYear(changed);

    expect(after.months[2].total).toBeCloseTo(before.months[2].total as number); // 3월
    expect(after.months[8].total).toBeCloseTo((before.months[8].total as number) * 2); // 9월
  });

  it("지난 달 호출횟수를 나중에 입력하면 그 달과 연간 누적이 바뀐다", () => {
    const before = calculateYear(fullData(["2026-03"]));
    const data = fullData(["2026-03", "2026-02"]);
    const after = calculateYear(data);
    expect(after.months[1].total).toBeCloseTo(27000);
    expect(after.annualTotal).toBeCloseTo(before.annualTotal + 27000);
  });
});

describe("연간 지수와 설문 추정 비중", () => {
  it("연간 누적은 계산된 달의 합이고, 빠진 달을 알려준다", () => {
    const year = calculateYear(fullData(["2026-01", "2026-02", "2026-10"], { securityIncidentMonths: ["2026-10"] }));
    expect(year.annualTotal).toBeCloseTo(27000 + 27000 + 13500);
    expect(year.countedMonths).toEqual(["2026-01", "2026-02", "2026-10"]);
    expect(year.missingMonths).toHaveLength(9);
  });

  it("설문 추정 비중은 호출횟수(실측) 1개 + 설문 2개 중 2/3이다", () => {
    const month = calculateMonth(fullData(["2026-03"]), "2026-03");
    expect(month.surveyShare).toBeCloseTo((2 / 3) * 100);
  });
});

describe("DB에서 읽어 계산하기", () => {
  let db: AppDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    await seedBase(db, { loginId: "admin01", password: "Passw0rd1" });
    await seedDev(db);
  });

  afterAll(async () => {
    await close();
  });

  it("개발용 시드 데이터로 9~11월 합계를 계산한다", async () => {
    const year = calculateYear(await loadScoreData(db, 2026));
    expect(year.countedMonths).toEqual(["2026-09", "2026-10", "2026-11"]);

    // 서비스 i(0~5), 달 m(0~2): 호출 1000(i+1)+150m, 절감 5+i분, 기여도 90-5i%, 보정 1
    let septemberExpected = 0;
    for (let i = 0; i < 6; i++) {
      septemberExpected += 1000 * (i + 1) * (5 + i) * ((90 - 5 * i) / 100);
    }
    expect(year.months[8].total).toBeCloseTo(septemberExpected);
  });

  it("변경 이력은 바뀐 항목만 남긴다", async () => {
    const written = await recordChanges(db, {
      targetType: "monthly_input",
      targetId: "1",
      changedByName: "관리자",
      before: { call_count: 100, source: "회신 메일" },
      after: { call_count: 150, source: "회신 메일" },
    });
    expect(written).toBe(1);
    const rows = await db.select().from(changeLogs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fieldName: "call_count", oldValue: "100", newValue: "150" });
  });

  it("새로 만든 값은 모든 항목을 남기고, 바뀐 게 없으면 아무것도 남기지 않는다", async () => {
    const created = await recordChanges(db, {
      targetType: "survey_setting",
      targetId: "5",
      changedByName: "관리자",
      before: null,
      after: { saved_minutes: 5, contribution_pct: 90 },
    });
    expect(created).toBe(2);

    const unchanged = await recordChanges(db, {
      targetType: "survey_setting",
      targetId: "5",
      changedByName: "관리자",
      before: { saved_minutes: 5 },
      after: { saved_minutes: 5 },
    });
    expect(unchanged).toBe(0);
  });
});
