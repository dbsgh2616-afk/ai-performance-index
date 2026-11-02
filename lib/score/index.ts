// Design Ref: §5.2 지수 계산 순서 — 화면과 DB를 모르는 순수 함수다. 대시보드와 증적자료가 같은 함수를 쓴다.
// Plan SC: FR-01 산식, FR-02 보안사고 감점, FR-03 월별·연간, FR-05 설문 추정 비중, FR-06 데이터 없음, FR-09 반기별 설정값

import type { SurveyInfo } from "../survey";

export type EvidenceGrade = "실측" | "설문 추정";
export type Half = "H1" | "H2";

export const SECURITY_PENALTY_RATE = 0.5;

export type ScoreService = { id: number; name: string };

export type ScoreInput = {
  serviceId: number;
  yearMonth: string; // 예: 2026-11
  callCount: number;
  evidenceGrade: EvidenceGrade;
};

export type ScoreSetting = {
  serviceId: number;
  year: number;
  half: Half;
  savedMinutes: number;
  contributionPct: number;
  correctionFactor: number;
  evidenceGrade: EvidenceGrade;
  survey?: SurveyInfo; // 설문 정보(응답자 수, 조사 기간 등). 계산에는 쓰지 않고 근거로 보여준다.
};

export type ScoreData = {
  year: number;
  services: ScoreService[]; // 표시 순서대로
  inputs: ScoreInput[];
  settings: ScoreSetting[];
  securityIncidentMonths: string[]; // 보안사고가 있는 달 (예: ["2026-10"])
};

export type ServiceMonthScore = {
  serviceId: number;
  serviceName: string;
  callCount: number | null;
  score: number | null; // null이면 "데이터 없음"
  missing: "input" | "setting" | null; // 무엇이 없어서 계산하지 못했는지
  grades: { callCount: EvidenceGrade | null; setting: EvidenceGrade | null };
};

export type MonthScore = {
  yearMonth: string;
  half: Half;
  services: ServiceMonthScore[];
  rawTotal: number | null; // 감점 전 합계
  total: number | null; // 감점 후 합계. 서비스 6개가 모두 계산되지 않으면 null ("데이터 없음")
  incident: boolean;
  penaltyApplied: boolean;
  missingServiceCount: number;
  surveyShare: number | null; // 산식에 들어간 값 중 "설문 추정"의 비율(%)
};

export type YearScore = {
  year: number;
  months: MonthScore[];
  annualTotal: number; // 계산된 달의 합
  countedMonths: string[];
  missingMonths: string[]; // 합계를 내지 못한 달
  surveyShare: number | null;
};

// 서비스 점수 = 호출횟수 × 업무절감시간(분) × (업무기여도 ÷ 100) × 보정계수
export function calculateServiceScore(
  callCount: number,
  setting: Pick<ScoreSetting, "savedMinutes" | "contributionPct" | "correctionFactor">,
): number {
  return callCount * setting.savedMinutes * (setting.contributionPct / 100) * setting.correctionFactor;
}

export function halfOfMonth(yearMonth: string): Half {
  return Number(yearMonth.slice(5, 7)) <= 6 ? "H1" : "H2";
}

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

// 설문 추정 비중: 산식에 들어간 값(호출횟수, 업무절감시간, 업무기여도) 중 근거 등급이 "설문 추정"인 값의 비율(%).
// 보정계수는 관리 조정값이라 센 값에 넣지 않는다.
function surveyCounts(services: ServiceMonthScore[]): { survey: number; total: number } {
  let survey = 0;
  let total = 0;
  for (const service of services) {
    if (service.score === null || !service.grades.callCount || !service.grades.setting) continue;
    total += 3;
    if (service.grades.callCount === "설문 추정") survey += 1;
    if (service.grades.setting === "설문 추정") survey += 2;
  }
  return { survey, total };
}

function toPercent(survey: number, total: number): number | null {
  return total === 0 ? null : (survey / total) * 100;
}

export function calculateMonth(data: ScoreData, yearMonth: string): MonthScore {
  const half = halfOfMonth(yearMonth);

  const services = data.services.map<ServiceMonthScore>((service) => {
    const input = data.inputs.find((row) => row.serviceId === service.id && row.yearMonth === yearMonth);
    const setting = data.settings.find(
      (row) => row.serviceId === service.id && row.year === data.year && row.half === half,
    );

    const base = {
      serviceId: service.id,
      serviceName: service.name,
      callCount: input?.callCount ?? null,
      grades: { callCount: input?.evidenceGrade ?? null, setting: setting?.evidenceGrade ?? null },
    };

    if (!input) return { ...base, score: null, missing: "input" };
    if (!setting) return { ...base, score: null, missing: "setting" };
    return { ...base, score: calculateServiceScore(input.callCount, setting), missing: null };
  });

  const missingServiceCount = services.filter((service) => service.score === null).length;
  const incident = data.securityIncidentMonths.includes(yearMonth);

  // 서비스 6개가 모두 계산되어야 월 합계를 낸다. 하나라도 없으면 "데이터 없음"이다.
  const complete = services.length > 0 && missingServiceCount === 0;
  const rawTotal = complete ? services.reduce((sum, service) => sum + (service.score ?? 0), 0) : null;
  const penaltyApplied = rawTotal !== null && incident;
  const total = rawTotal === null ? null : penaltyApplied ? rawTotal * SECURITY_PENALTY_RATE : rawTotal;

  const { survey, total: valueCount } = surveyCounts(services);

  return {
    yearMonth,
    half,
    services,
    rawTotal,
    total,
    incident,
    penaltyApplied,
    missingServiceCount,
    surveyShare: toPercent(survey, valueCount),
  };
}

export type ServiceRank = {
  serviceId: number;
  serviceName: string;
  annualScore: number; // 점수가 계산된 달의 합
  monthsCounted: number;
  rank: number | null; // 계산된 달이 없으면 null
  barPercent: number; // 1위 대비 비율(막대 길이)
};

// 서비스별 연간 누적 점수 순위. 합계가 아니라 서비스 점수를 기준으로 하므로, 월 합계가 "데이터 없음"이어도 순위는 나온다.
export function rankServices(year: YearScore): ServiceRank[] {
  const services = year.months[0]?.services ?? [];

  const totals = services.map((service, index) => {
    const scores = year.months
      .map((month) => month.services[index].score)
      .filter((score): score is number => score !== null);
    return {
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      annualScore: scores.reduce((sum, score) => sum + score, 0),
      monthsCounted: scores.length,
    };
  });

  const ranked = totals
    .filter((row) => row.monthsCounted > 0)
    .sort((a, b) => b.annualScore - a.annualScore);
  const top = ranked[0]?.annualScore ?? 0;

  return [
    ...ranked.map((row, index) => ({
      ...row,
      rank: index + 1,
      barPercent: top === 0 ? 0 : (row.annualScore / top) * 100,
    })),
    ...totals
      .filter((row) => row.monthsCounted === 0)
      .map((row) => ({ ...row, rank: null, barPercent: 0 })),
  ];
}

export function calculateYear(data: ScoreData): YearScore {
  const months = monthsOfYear(data.year).map((yearMonth) => calculateMonth(data, yearMonth));

  const counted = months.filter((month) => month.total !== null);
  const annualTotal = counted.reduce((sum, month) => sum + (month.total ?? 0), 0);

  let survey = 0;
  let valueCount = 0;
  for (const month of months) {
    const counts = surveyCounts(month.services);
    survey += counts.survey;
    valueCount += counts.total;
  }

  return {
    year: data.year,
    months,
    annualTotal,
    countedMonths: counted.map((month) => month.yearMonth),
    missingMonths: months.filter((month) => month.total === null).map((month) => month.yearMonth),
    surveyShare: toPercent(survey, valueCount),
  };
}
