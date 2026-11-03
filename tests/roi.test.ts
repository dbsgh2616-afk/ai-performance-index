// 추정 ROI: 계산식, 입력값 검사, 저장과 변경 이력, 시연 데이터를 확인한다.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { changeLogs } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import { DEV_ROI, seedDev } from "../lib/db/seed-dev";
import type { AppDb } from "../lib/db/types";
import { computeRoi, formatWon, loadRoiInputs, parseRoiForm, saveRoiInputs, type RoiValues } from "../lib/roi";
import type { ScoreData } from "../lib/score";
import { loadScoreData } from "../lib/score/load";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;
const actor = { id: 1, name: "김관리" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

// 계산하기 쉬운 값: 도입비 합계 600만원 ÷ (1년 × 12) = 월 50만원, 운영비 연 120만원 → 월 10만원, 월 비용 60만원
const VALUES: RoiValues = {
  capex_gpu: 3_000_000,
  capex_storage: 1_000_000,
  capex_network: 1_000_000,
  capex_license: 500_000,
  capex_build: 500_000,
  opex_year: 1_200_000,
  life_years: 1,
  hourly_rate: 50_000,
};

// 서비스 1개: 호출 600건 × 10분 × 기여도 50% ÷ 60 = 50시간 → 효과 250만원 (단가 5만원)
const DATA: ScoreData = {
  year: 2026,
  services: [{ id: 1, name: "KOBI" }],
  inputs: [
    { serviceId: 1, yearMonth: "2026-01", callCount: 600, evidenceGrade: "실측" },
    { serviceId: 1, yearMonth: "2026-02", callCount: 600, evidenceGrade: "실측" },
    { serviceId: 1, yearMonth: "2026-03", callCount: 600, evidenceGrade: "실측" },
  ],
  settings: [{ serviceId: 1, year: 2026, half: "H1", savedMinutes: 10, contributionPct: 50, correctionFactor: 0.1, evidenceGrade: "설문 추정" }],
  securityIncidentMonths: [],
};

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedBase(db, { loginId: "admin01", password: "Passw0rd1" });
});

afterAll(async () => {
  await close();
});

describe("ROI 계산", () => {
  it("효과와 비용을 구해 ROI를 낸다 (보정계수는 효과에 넣지 않는다)", () => {
    const roi = computeRoi(DATA, VALUES, "2026-01")!;
    expect(roi.months).toBe(1);
    expect(roi.hours).toBeCloseTo(50);
    expect(roi.benefit).toBeCloseTo(2_500_000);
    expect(roi.monthlyCost).toBeCloseTo(600_000);
    expect(roi.cost).toBeCloseTo(600_000);
    expect(roi.roiPct).toBeCloseTo(((2_500_000 - 600_000) / 600_000) * 100);
  });

  it("선택한 달까지 입력이 있는 달만 센다 (누적)", () => {
    const roi = computeRoi(DATA, VALUES, "2026-02")!;
    expect(roi.months).toBe(2);
    expect(roi.benefit).toBeCloseTo(5_000_000);
    expect(roi.cost).toBeCloseTo(1_200_000);
    // 달마다 효과와 비용이 같은 비율로 늘어 ROI는 변하지 않는다
    expect(roi.roiPct).toBeCloseTo(computeRoi(DATA, VALUES, "2026-01")!.roiPct);
  });

  it("효과가 비용보다 작으면 ROI는 음수", () => {
    expect(computeRoi(DATA, { ...VALUES, hourly_rate: 5_000 }, "2026-03")!.roiPct).toBeLessThan(0);
  });

  it("입력값이 모자라거나 비용이 0이거나 입력된 달이 없으면 계산하지 않는다", () => {
    expect(computeRoi(DATA, null, "2026-03")).toBeNull();
    const partial: Partial<RoiValues> = { ...VALUES };
    delete partial.hourly_rate;
    expect(computeRoi(DATA, partial, "2026-03")).toBeNull();
    expect(computeRoi(DATA, { ...VALUES, capex_gpu: 0, capex_storage: 0, capex_network: 0, capex_license: 0, capex_build: 0, opex_year: 0 }, "2026-03")).toBeNull();
    expect(computeRoi({ ...DATA, inputs: [] }, VALUES, "2026-03")).toBeNull();
    expect(computeRoi(DATA, VALUES, "2025-12")).toBeNull(); // 그 달까지 입력이 없다
  });
});

describe("금액 표시", () => {
  it("억·만 단위로 줄여 보여준다", () => {
    expect(formatWon(120_000_000)).toBe("1.2억원");
    expect(formatWon(88_000_000)).toBe("8,800만원");
    expect(formatWon(9_500)).toBe("9,500원");
    expect(formatWon(-30_000_000)).toBe("-3,000만원");
  });
});

describe("ROI 입력 검사와 저장", () => {
  it("쉼표가 있어도 읽고, 빈 칸은 건너뛴다", () => {
    expect(parseRoiForm(form({ capex_gpu: "3,000,000", life_years: "5", opex_year: "" }))).toEqual({
      ok: true,
      data: { capex_gpu: 3_000_000, life_years: 5 },
    });
  });

  it("음수·글자·내용연수 0은 한국어 오류로 거부한다", () => {
    expect(parseRoiForm(form({ capex_gpu: "-1" }))).toMatchObject({ ok: false, error: expect.stringContaining("GPU 서버 도입비") });
    expect(parseRoiForm(form({ hourly_rate: "abc" }))).toMatchObject({ ok: false });
    expect(parseRoiForm(form({ life_years: "0" }))).toMatchObject({ ok: false, error: expect.stringContaining("내용연수") });
  });

  it("저장하면 항목마다 이력이 남고, 고치면 이전 값이 이력에 남는다", async () => {
    expect((await saveRoiInputs(db, VALUES, actor)).changes).toBe(8);
    expect(await loadRoiInputs(db)).toEqual(VALUES);
    expect((await saveRoiInputs(db, VALUES, actor)).changes).toBe(0);

    expect((await saveRoiInputs(db, { hourly_rate: 60_000 }, { id: 1, name: "박담당" })).changes).toBe(1);
    const logs = await db.select().from(changeLogs).where(eq(changeLogs.targetType, "roi_input"));
    expect(logs.find((row) => row.targetId === "hourly_rate" && row.oldValue === "50000")).toMatchObject({ newValue: "60000", changedByName: "박담당" });
  });

  it("값이 하나도 없으면 null", async () => {
    const empty = await createTestDb();
    try {
      expect(await loadRoiInputs(empty.db)).toBeNull();
    } finally {
      await empty.close();
    }
  });
});

describe("시연 데이터", () => {
  it("시연 데이터로 계산하면 11월 누적 ROI가 양수로 나온다", async () => {
    const demo = await createTestDb();
    try {
      await seedBase(demo.db, { loginId: "admin01", password: "Passw0rd1" });
      await seedDev(demo.db);
      expect(await loadRoiInputs(demo.db)).toEqual(DEV_ROI);
      const roi = computeRoi(await loadScoreData(demo.db, 2026), await loadRoiInputs(demo.db), "2026-11")!;
      expect(roi.months).toBe(11);
      expect(roi.roiPct).toBeGreaterThan(0);
      expect(roi.roiPct).toBeLessThan(60); // 시연 값이라도 너무 부풀려지지 않게
    } finally {
      await demo.close();
    }
  });
});
