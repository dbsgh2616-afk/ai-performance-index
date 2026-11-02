// 날짜 도우미. 공사 업무 기준이라 한국 시간(Asia/Seoul)으로 계산한다.
import type { Half } from "./score";

const KST = "Asia/Seoul";

// 지금 달 (예: 2026-11)
export function currentYearMonth(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: KST }).slice(0, 7);
}

export function currentYear(now: Date = new Date()): number {
  return Number(currentYearMonth(now).slice(0, 4));
}

export function halfLabel(year: number, half: Half): string {
  return half === "H1" ? `${year}년 상반기(1~6월)` : `${year}년 하반기(7~12월)`;
}

// 지금 속한 반기
export function currentHalf(now: Date = new Date()): Half {
  return Number(currentYearMonth(now).slice(5, 7)) <= 6 ? "H1" : "H2";
}
