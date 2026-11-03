// 우주 이벤트: 신기록, 서비스 최고 기록, 급상승, 누적 돌파, 순위 상승, 보안사고 경보를 찾는지 확인한다.
import { describe, expect, it } from "vitest";

import { calculateYear, type ScoreData } from "../lib/score";
import { spaceEvents } from "../lib/score/events";

const SERVICES = [
  { id: 1, name: "KOBI" },
  { id: 2, name: "KOBI+" },
];

// 호출횟수 × 5분 × 100% × 1 = 점수. (서비스별·달별 호출횟수를 직접 지정한다)
function build(calls: Record<string, [number, number]>, incidents: string[] = []): ScoreData {
  return {
    year: 2026,
    services: SERVICES,
    inputs: Object.entries(calls).flatMap(([yearMonth, [a, b]]) => [
      { serviceId: 1, yearMonth, callCount: a, evidenceGrade: "실측" as const },
      { serviceId: 2, yearMonth, callCount: b, evidenceGrade: "실측" as const },
    ]),
    settings: SERVICES.flatMap((service) =>
      (["H1", "H2"] as const).map((half) => ({
        serviceId: service.id,
        year: 2026,
        half,
        savedMinutes: 5,
        contributionPct: 100,
        correctionFactor: 1,
        evidenceGrade: "설문 추정" as const,
      })),
    ),
    securityIncidentMonths: incidents,
  };
}

const events = (data: ScoreData, month: string) => spaceEvents(calculateYear(data), month);
const kinds = (list: ReturnType<typeof events>) => list.map((event) => event.kind);

describe("우주 이벤트", () => {
  it("이전 달이 없으면 신기록·급상승·순위 이벤트는 없다", () => {
    expect(events(build({ "2026-01": [100, 200] }), "2026-01")).toEqual([]);
  });

  it("월 합계가 이전 모든 달보다 높으면 신기록", () => {
    const list = events(build({ "2026-01": [100, 100], "2026-02": [200, 200] }), "2026-02");
    expect(kinds(list)).toContain("record");
  });

  it("합계가 내려가면 신기록이 아니다", () => {
    const list = events(build({ "2026-01": [200, 200], "2026-02": [100, 100] }), "2026-02");
    expect(kinds(list)).not.toContain("record");
  });

  it("서비스 최고 점수와 가장 크게 오른 서비스를 알려준다", () => {
    const list = events(build({ "2026-01": [100, 100], "2026-02": [110, 200] }), "2026-02");
    expect(list.find((event) => event.kind === "service-record")?.title).toBe("KOBI, KOBI+ 최고 점수");
    const surge = list.find((event) => event.kind === "surge");
    expect(surge?.title).toBe("KOBI+ 급상승");
    expect(surge?.detail).toContain("100%");
  });

  it("누적 지수가 기준선(10,000)을 처음 넘은 달에 돌파 이벤트가 나온다", () => {
    // 1월 합계 (1000+1000)*5 = 10,000 미만이 되도록: 800+800 → 8,000 / 2월 +4,000 → 12,000
    const data = build({ "2026-01": [800, 800], "2026-02": [400, 400] });
    expect(events(data, "2026-02").find((event) => event.kind === "milestone")?.title).toBe("누적 10,000 돌파");
    // 이미 넘은 뒤의 달에는 다시 나오지 않는다
    const later = build({ "2026-01": [800, 800], "2026-02": [400, 400], "2026-03": [400, 400] });
    expect(kinds(events(later, "2026-03"))).not.toContain("milestone");
  });

  it("누적 순위가 올라간 서비스를 알려준다", () => {
    // 1월: KOBI가 1위. 2월에 KOBI+가 크게 앞질러 누적 1위가 된다.
    const list = events(build({ "2026-01": [200, 100], "2026-02": [100, 400] }), "2026-02");
    const rankUp = list.find((event) => event.kind === "rank-up");
    expect(rankUp?.title).toBe("KOBI+ 순위 상승");
    expect(rankUp?.detail).toBe("누적 순위 2위 → 1위");
  });

  it("보안사고가 있는 달에는 경보가 맨 앞에 나온다", () => {
    const list = events(build({ "2026-01": [100, 100], "2026-02": [200, 200] }, ["2026-02"]), "2026-02");
    expect(list[0].kind).toBe("incident");
  });

  it("없는 달을 물으면 빈 목록", () => {
    expect(events(build({ "2026-01": [100, 100] }), "2025-01")).toEqual([]);
  });
});
