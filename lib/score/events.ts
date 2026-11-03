// 우주 이벤트 — 선택한 달에 일어난 눈에 띄는 일(신기록, 누적 돌파, 순위 상승 등)을 데이터에서 찾아 준다.
// 화면과 DB를 모르는 순수 함수다. 지수 계산에는 쓰지 않는다.
import { changeRate } from "../format";
import type { YearScore } from "./index";

export type SpaceEventKind = "record" | "service-record" | "surge" | "milestone" | "rank-up" | "incident";

export type SpaceEvent = {
  kind: SpaceEventKind;
  title: string;
  detail: string;
};

// 누적 지수가 이 값을 넘어서는 달에 "돌파" 이벤트를 띄운다.
export const MILESTONES = [10_000, 50_000, 100_000, 500_000, 1_000_000];

function present(values: (number | null | undefined)[]): number[] {
  return values.filter((value): value is number => value !== null && value !== undefined);
}

// 서비스별 누적 점수로 순위(1부터)를 매긴다. 점수가 같으면 같은 순위.
function ranksOf(cumulative: Map<number, number>): Map<number, number> {
  const scores = [...cumulative.values()];
  return new Map([...cumulative].map(([id, score]) => [id, scores.filter((other) => other > score).length + 1]));
}

export function spaceEvents(yearScore: YearScore, focusMonth: string): SpaceEvent[] {
  const index = yearScore.months.findIndex((month) => month.yearMonth === focusMonth);
  if (index === -1) return [];

  const focus = yearScore.months[index];
  const previous = yearScore.months[index - 1];
  const earlierMonths = yearScore.months.slice(0, index);
  const events: SpaceEvent[] = [];

  if (focus.penaltyApplied) {
    events.push({ kind: "incident", title: "보안사고 경보", detail: "이번 달 합계에 50% 감점이 적용됐습니다." });
  }

  // 월 합계 신기록: 이전에 계산된 달이 하나 이상 있고, 모두 넘어섰을 때
  const earlierTotals = present(earlierMonths.map((month) => month.total));
  if (focus.total !== null && earlierTotals.length > 0 && earlierTotals.every((total) => focus.total! > total)) {
    events.push({ kind: "record", title: "월 합계 신기록", detail: "올해 계산된 어느 달보다 높은 합계입니다." });
  }

  // 서비스 최고 기록
  const recordHolders = focus.services
    .filter((service) => {
      if (service.score === null) return false;
      const earlier = present(
        earlierMonths.map((month) => month.services.find((row) => row.serviceId === service.serviceId)?.score),
      );
      return earlier.length > 0 && earlier.every((score) => service.score! > score);
    })
    .map((service) => service.serviceName);
  if (recordHolders.length > 0) {
    events.push({
      kind: "service-record",
      // 서비스가 많이 몰리면 이름을 다 나열하지 않고 "전 서비스"로 줄인다.
      title: recordHolders.length >= 3 && recordHolders.length === focus.services.length ? "전 서비스 최고 점수" : `${recordHolders.join(", ")} 최고 점수`,
      detail: "이번 달 점수가 올해 자기 기록 중 가장 높습니다.",
    });
  }

  // 전월 대비 가장 크게 오른 서비스
  if (previous) {
    let best: { name: string; rate: number } | null = null;
    for (const service of focus.services) {
      const rate = changeRate(service.score, previous.services.find((row) => row.serviceId === service.serviceId)?.score ?? null);
      if (rate !== null && rate > 0 && (best === null || rate > best.rate)) best = { name: service.serviceName, rate };
    }
    if (best) {
      events.push({
        kind: "surge",
        title: `${best.name} 급상승`,
        detail: `전월보다 ${best.rate.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}% 올라 가장 크게 상승했습니다.`,
      });
    }
  }

  // 누적 지수 돌파: 이번 달 합계가 더해져서 기준선을 처음 넘었을 때
  const totalBefore = present(earlierMonths.map((month) => month.total)).reduce((sum, value) => sum + value, 0);
  const totalNow = totalBefore + (focus.total ?? 0);
  const crossed = MILESTONES.filter((line) => totalBefore < line && line <= totalNow);
  if (crossed.length > 0) {
    const line = crossed[crossed.length - 1];
    events.push({ kind: "milestone", title: `누적 ${line.toLocaleString("ko-KR")} 돌파`, detail: "올해 누적 지수가 새 기준선을 넘었습니다." });
  }

  // 순위 상승: 지난달까지의 누적 순위보다 올라간 서비스 중 가장 많이 오른 하나
  if (index > 0) {
    const sumUntil = (lastIndex: number) =>
      new Map(
        focus.services.map((service) => [
          service.serviceId,
          present(yearScore.months.slice(0, lastIndex + 1).map((month) => month.services.find((row) => row.serviceId === service.serviceId)?.score)).reduce(
            (sum, value) => sum + value,
            0,
          ),
        ]),
      );
    const before = sumUntil(index - 1);
    if ([...before.values()].some((score) => score > 0)) {
      const rankBefore = ranksOf(before);
      const rankNow = ranksOf(sumUntil(index));
      let best: { name: string; from: number; to: number } | null = null;
      for (const service of focus.services) {
        const from = rankBefore.get(service.serviceId)!;
        const to = rankNow.get(service.serviceId)!;
        if (to < from && (best === null || from - to > best.from - best.to)) best = { name: service.serviceName, from, to };
      }
      if (best) events.push({ kind: "rank-up", title: `${best.name} 순위 상승`, detail: `누적 순위 ${best.from}위 → ${best.to}위` });
    }
  }

  return events;
}
