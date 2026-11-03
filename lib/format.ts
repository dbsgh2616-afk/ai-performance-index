// 화면과 증적자료에서 같은 모양으로 숫자를 보여주기 위한 도우미
// 점수는 화면에서 소수 첫째 자리까지 보여주고, 계산은 원래 값으로 한다. (DESIGN 12장 가정 8)

export const NO_DATA = "데이터 없음";

export function formatScore(value: number | null): string {
  if (value === null) return NO_DATA;
  return value.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

// 전월 대비 증감률(%). 비교할 값이 없거나 전월이 0이면 null (나눌 수 없다)
export function changeRate(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// 한국 시간 기준 "2026-11-02 16:05"
export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
}

export function formatMonthLabel(yearMonth: string): string {
  return `${Number(yearMonth.slice(5, 7))}월`;
}
