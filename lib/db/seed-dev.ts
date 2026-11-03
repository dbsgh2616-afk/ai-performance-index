// 개발용·시연용 데이터. 운영 DB에는 넣지 않는다. (DESIGN 10.3)
// 화면을 확인하고 시연할 때 쓰는 임의의 값이며, 실제 성과 수치가 아니다. 출처 칸에도 그렇게 적는다.
// 서비스별 규모를 다르게 잡아, 연간 누적 점수 순위가 KOBI+ > KOBI > 국유변화탐지 > 온비드 AI요약 > 성과나침반 > 슈퍼로이어가 되게 했다.
import { asc, eq } from "drizzle-orm";

import { accounts, infraMetrics, monthlyInputs, roiInputs, services, surveySettings } from "./schema";
import type { AppDb } from "./types";

export const DEV_YEAR = 2026;
export const DEV_LAST_MONTH = 11; // 1~11월 입력
export const DEV_SOURCE = "시연용 임의 값";

type DevProfile = {
  name: string;
  baseCalls: number; // 1월 호출횟수
  minutes: [number, number]; // 건당 업무절감시간(분): [상반기, 하반기]
  contribution: [number, number]; // 업무기여도(%): [상반기, 하반기]
  correction: number;
  targetCount: number; // 설문 대상 인원
  respondents: [number, number]; // 응답자 수: [상반기, 하반기]
  aggregation: "mean" | "median" | "trimmed_mean";
};

// 서비스 순서(sort_order)와 같은 순서다: KOBI, KOBI+, 국유변화탐지, 슈퍼로이어, 성과나침반, 온비드 AI요약
export const DEV_PROFILES: DevProfile[] = [
  { name: "KOBI", baseCalls: 410, minutes: [6.0, 6.3], contribution: [78, 80], correction: 1, targetCount: 420, respondents: [188, 201], aggregation: "median" },
  { name: "KOBI+", baseCalls: 575, minutes: [5.5, 5.8], contribution: [82, 84], correction: 0.9, targetCount: 260, respondents: [131, 142], aggregation: "median" },
  { name: "국유변화탐지", baseCalls: 105, minutes: [22, 23], contribution: [70, 72], correction: 1, targetCount: 85, respondents: [52, 58], aggregation: "trimmed_mean" },
  { name: "슈퍼로이어", baseCalls: 45, minutes: [12, 12.5], contribution: [60, 62], correction: 1, targetCount: 120, respondents: [43, 51], aggregation: "mean" },
  { name: "성과나침반", baseCalls: 65, minutes: [9, 9.4], contribution: [68, 70], correction: 1, targetCount: 150, respondents: [71, 80], aggregation: "trimmed_mean" },
  { name: "온비드 AI요약", baseCalls: 260, minutes: [4, 4.2], contribution: [72, 74], correction: 1, targetCount: 310, respondents: [124, 139], aggregation: "median" },
];

const WOBBLE = [0.02, -0.03, 0.01, 0.03, -0.02, 0];

// 달(1~12)별 호출횟수: 조금씩 늘어나고 달마다 작게 흔들린다.
export function devCallCount(profile: DevProfile, month: number): number {
  return Math.round(profile.baseCalls * (1 + 0.035 * (month - 1)) * (1 + WOBBLE[month % WOBBLE.length]));
}

const QUESTION =
  "AI 서비스를 사용한 뒤 업무 1건당 절감된 시간(분)과, 업무 결과에 대한 AI의 기여도(%)를 응답해 주세요.";

export const DEV_ROI = {
  capex_gpu: 100_000_000,
  capex_storage: 40_000_000,
  capex_network: 30_000_000,
  capex_license: 30_000_000,
  capex_build: 40_000_000,
  opex_year: 48_000_000,
  life_years: 5,
  hourly_rate: 60_000,
};

const DEV_UPTIME =[99.92, 99.88, 99.95, 99.81, 99.9, 99.7, 99.93, 99.85, 99.91, 99.78, 99.62];
const round1 = (value: number) => Math.round(value * 10) / 10;

export type DevSeedResult = {
  monthlyInputCount: number;
  settingCount: number;
  infraCount: number;
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

  const inputRows = serviceRows.flatMap((service, index) => {
    const profile = DEV_PROFILES[index % DEV_PROFILES.length];
    return Array.from({ length: DEV_LAST_MONTH }, (_, offset) => {
      const month = offset + 1;
      return {
        serviceId: service.id,
        yearMonth: `${DEV_YEAR}-${String(month).padStart(2, "0")}`,
        callCount: devCallCount(profile, month),
        source: DEV_SOURCE,
        enteredById: admin.id,
        enteredByName: admin.name,
      };
    });
  });
  await db.insert(monthlyInputs).values(inputRows).onConflictDoNothing();

  const settingRows = serviceRows.flatMap((service, index) => {
    const profile = DEV_PROFILES[index % DEV_PROFILES.length];
    return (["H1", "H2"] as const).map((half, halfIndex) => ({
      serviceId: service.id,
      year: DEV_YEAR,
      half,
      savedMinutes: profile.minutes[halfIndex],
      contributionPct: profile.contribution[halfIndex],
      correctionFactor: profile.correction,
      respondentCount: profile.respondents[halfIndex],
      targetCount: profile.targetCount,
      surveyStart: halfIndex === 0 ? `${DEV_YEAR}-06-01` : `${DEV_YEAR}-12-01`,
      surveyEnd: halfIndex === 0 ? `${DEV_YEAR}-06-12` : `${DEV_YEAR}-12-12`,
      aggregation: profile.aggregation,
      questionText: QUESTION,
      source: `${DEV_YEAR}년 ${halfIndex === 0 ? "상반기" : "하반기"} 이용자 설문 (${DEV_SOURCE})`,
      enteredById: admin.id,
      enteredByName: admin.name,
    }));
  });
  await db.insert(surveySettings).values(settingRows).onConflictDoNothing();

  // AI 인프라 지표(계기판 시연용): GPU와 스토리지는 조금씩 차올라 마지막 달에 "주의" 구간으로 들어간다.
  const infraRows = Array.from({ length: DEV_LAST_MONTH }, (_, offset) => {
    const month = offset + 1;
    return {
      yearMonth: `${DEV_YEAR}-${String(month).padStart(2, "0")}`,
      gpuUsagePct: round1(42 + 3.2 * offset),
      memoryUsagePct: round1(56 + 1.2 * offset),
      storageUsagePct: round1(34 + 4.4 * offset),
      uptimePct: DEV_UPTIME[offset],
      source: DEV_SOURCE,
      enteredById: admin.id,
      enteredByName: admin.name,
    };
  });
  await db.insert(infraMetrics).values(infraRows).onConflictDoNothing();

  // ROI 시연용 비용·단가(임의 값). 도입비 합계 2.4억원 ÷ 5년 + 연 운영비 4,800만원 → 월 비용 약 800만원
  const roiRows = Object.entries(DEV_ROI).map(([key, value]) => ({ key, value, enteredById: admin.id, enteredByName: admin.name }));
  await db.insert(roiInputs).values(roiRows).onConflictDoNothing();

  return { monthlyInputCount: inputRows.length, settingCount: settingRows.length, infraCount: infraRows.length };
}
