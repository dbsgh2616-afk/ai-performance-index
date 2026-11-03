// 서비스 상태등: 입력 완료 / 입력 대기 / 근거 미확인 판정을 확인한다.
import { describe, expect, it } from "vitest";

import { calculateYear, type ScoreData } from "../lib/score";
import { serviceStatuses } from "../lib/score/status";

const SERVICES = [
  { id: 1, name: "KOBI" },
  { id: 2, name: "KOBI+" },
  { id: 3, name: "국유변화탐지" },
];

const survey = (source: string | null) => ({
  respondentCount: 100,
  targetCount: 200,
  surveyStart: "2026-06-01",
  surveyEnd: "2026-06-10",
  aggregation: "median" as const,
  questionText: null,
  source,
});

function build(): ScoreData {
  return {
    year: 2026,
    services: SERVICES,
    inputs: [
      // 서비스 1: 출처까지 모두 있음
      { serviceId: 1, yearMonth: "2026-11", callCount: 100, evidenceGrade: "실측", source: "운영 로그" },
      // 서비스 2: 호출횟수 출처가 비어 있음
      { serviceId: 2, yearMonth: "2026-11", callCount: 100, evidenceGrade: "실측", source: "  " },
      // 서비스 3: 11월 입력 없음 (10월만 있음)
      { serviceId: 3, yearMonth: "2026-10", callCount: 100, evidenceGrade: "실측", source: "운영 로그" },
    ],
    settings: [
      { serviceId: 1, year: 2026, half: "H2", savedMinutes: 5, contributionPct: 80, correctionFactor: 1, evidenceGrade: "설문 추정", survey: survey("하반기 설문") },
      { serviceId: 2, year: 2026, half: "H2", savedMinutes: 5, contributionPct: 80, correctionFactor: 1, evidenceGrade: "설문 추정", survey: survey(null) },
      { serviceId: 3, year: 2026, half: "H2", savedMinutes: 5, contributionPct: 80, correctionFactor: 1, evidenceGrade: "설문 추정", survey: survey("하반기 설문") },
    ],
    securityIncidentMonths: [],
  };
}

describe("서비스 상태등", () => {
  const data = build();
  const month = calculateYear(data).months[10]; // 2026-11
  const statuses = serviceStatuses(data, month);

  it("값과 출처가 모두 있으면 입력 완료", () => {
    expect(statuses[0]).toMatchObject({ serviceName: "KOBI", kind: "done", reasons: [] });
  });

  it("값은 있지만 출처가 비어 있으면 근거 미확인 (공백만 있어도 비어 있는 것으로 본다)", () => {
    expect(statuses[1].kind).toBe("unverified");
    expect(statuses[1].reasons).toEqual(["호출횟수 출처 없음", "설문 출처 없음"]);
  });

  it("그 달 호출횟수가 없으면 입력 대기", () => {
    expect(statuses[2].kind).toBe("pending");
    expect(statuses[2].reasons).toEqual(["호출횟수 미입력"]);
  });

  it("설정값이 없으면 입력 대기에 이유가 함께 나온다", () => {
    const noSetting = { ...data, settings: [] };
    const result = serviceStatuses(noSetting, calculateYear(noSetting).months[10]);
    expect(result[0].kind).toBe("pending");
    expect(result[0].reasons).toContain("업무절감시간·업무기여도 미입력");
  });
});
