// 설문 정보 도우미 — 설문 값을 데이터로 쓸 수 있는지 평가자가 따져 볼 수 있게, 응답자 수·응답률·조사 기간·집계 방식을 한 모양으로 보여준다.

export type Aggregation = "mean" | "median" | "trimmed_mean";

export const AGGREGATION_OPTIONS: { value: Aggregation; label: string; hint: string }[] = [
  { value: "mean", label: "평균", hint: "모든 응답의 평균" },
  { value: "median", label: "중앙값", hint: "극단값의 영향을 줄이는 가운데 값" },
  { value: "trimmed_mean", label: "절사평균", hint: "양 끝 값을 잘라낸 평균" },
];

export type SurveyInfo = {
  respondentCount: number | null;
  targetCount: number | null;
  surveyStart: string | null; // YYYY-MM-DD
  surveyEnd: string | null; // YYYY-MM-DD
  aggregation: Aggregation | null;
  questionText: string | null;
  source: string | null;
};

export const NOT_RECORDED = "미기재";

export function aggregationLabel(value: Aggregation | null): string {
  return AGGREGATION_OPTIONS.find((option) => option.value === value)?.label ?? NOT_RECORDED;
}

// 응답률(%) = 응답자 수 ÷ 대상 인원
export function responseRate(respondentCount: number | null, targetCount: number | null): number | null {
  if (respondentCount === null || targetCount === null || targetCount <= 0) return null;
  return (respondentCount / targetCount) * 100;
}

export function formatResponseRate(respondentCount: number | null, targetCount: number | null): string {
  const rate = responseRate(respondentCount, targetCount);
  return rate === null ? NOT_RECORDED : `${rate.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

export function formatSurveyPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return NOT_RECORDED;
  return start === end ? start : `${start} ~ ${end}`;
}

export function formatRespondents(respondentCount: number | null, targetCount: number | null): string {
  if (respondentCount === null || targetCount === null) return NOT_RECORDED;
  return `${respondentCount.toLocaleString("ko-KR")}명 / ${targetCount.toLocaleString("ko-KR")}명`;
}
