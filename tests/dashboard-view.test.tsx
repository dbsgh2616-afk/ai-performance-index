// 작업 10: 대시보드 화면 부품이 설계(DESIGN 4.4)의 요소를 보여주는지 확인한다.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardView } from "../components/dashboard/DashboardView";
import { formatPercent, formatScore } from "../lib/format";
import { calculateYear, type ScoreData } from "../lib/score";

const NAMES = ["KOBI", "KOBI+", "국유변화탐지", "슈퍼로이어", "성과나침반", "온비드 AI요약"];
const SERVICES = NAMES.map((name, index) => ({ id: index + 1, name }));
const SERVICE_NAMES = Object.fromEntries(SERVICES.map((service) => [service.id, service.name]));

function data(months: string[], incidents: string[] = []): ScoreData {
  return {
    year: 2026,
    services: SERVICES,
    inputs: SERVICES.flatMap((service) =>
      months.map((yearMonth) => ({
        serviceId: service.id,
        yearMonth,
        // 서비스마다 호출횟수를 다르게 해서 순위가 생기게 한다. (서비스 2가 1위)
        callCount: service.id === 2 ? 2000 : 1000 - service.id * 10,
        evidenceGrade: "실측" as const,
      })),
    ),
    settings: SERVICES.flatMap((service) =>
      (["H1", "H2"] as const).map((half) => ({
        serviceId: service.id,
        year: 2026,
        half,
        savedMinutes: 5,
        contributionPct: 90,
        correctionFactor: 1,
        evidenceGrade: "설문 추정" as const,
        survey: {
          respondentCount: 188,
          targetCount: 420,
          surveyStart: "2026-06-01",
          surveyEnd: "2026-06-12",
          aggregation: "median" as const,
          questionText: null,
          source: null,
        },
      })),
    ),
    securityIncidentMonths: incidents,
  };
}

function render(months: string[], incidents: string[] = [], isAdmin = true) {
  const scoreData = data(months, incidents);
  return renderToStaticMarkup(
    <DashboardView
      yearScore={calculateYear(scoreData)}
      settings={scoreData.settings}
      serviceNames={SERVICE_NAMES}
      focusMonth="2026-10"
      focusLabel="이번 달"
      isAdmin={isAdmin}
      chart={<p>그래프 자리</p>}
    />,
  );
}

describe("숫자 표시", () => {
  it("점수는 소수 첫째 자리까지, 없으면 '데이터 없음'으로 보여준다", () => {
    expect(formatScore(4500)).toBe("4,500.0");
    expect(formatScore(null)).toBe("데이터 없음");
    expect(formatPercent(66.666)).toBe("66.7%");
    expect(formatPercent(null)).toBe("-");
  });
});

describe("대시보드 화면", () => {
  it("요약 카드 3개, 순위, 그래프 자리, 서비스×월 표, 설문 정보가 있다", () => {
    const html = render(["2026-10"]);
    expect(html).toContain("연간 누적 지수");
    expect(html).toContain("이번 달 합계");
    expect(html).toContain("설문 추정 비중");
    expect(html).toContain("66.7%");
    expect(html).toContain("서비스 순위");
    expect(html).toContain("그래프 자리");
    expect(html).toContain("서비스별 월 지수");
    expect(html).toContain("설문 정보");
    for (const name of NAMES) expect(html).toContain(name);
    expect(html).toContain("합계");
    expect(html).toContain("실측");
    expect(html).toContain("설문");
  });

  it("순위 1위 서비스와 요약 카드의 1위 표시가 일치한다", () => {
    const html = render(["2026-10"]);
    expect(html).toContain("1위 KOBI+");
    expect(html.indexOf("KOBI+")).toBeLessThan(html.indexOf("국유변화탐지"));
  });

  it("설문 정보 표에 응답자 수, 응답률, 조사 기간, 집계 방식이 나온다", () => {
    const html = render(["2026-10"]);
    expect(html).toContain("188명 / 420명");
    expect(html).toContain("44.8%");
    expect(html).toContain("2026-06-01 ~ 2026-06-12");
    expect(html).toContain("중앙값");
  });

  it("입력이 있는 달만 칸으로 보여주고, 빈 달은 따로 알려준다", () => {
    const html = render(["2026-10"]);
    expect(html).toContain("10월");
    expect(html).toContain("입력이 없는 달: 1월, 2월");
    expect(html).not.toContain("<th class=\"px-2 py-1 text-center font-medium\">1월</th>");
  });

  it("입력이 하나도 없으면 '데이터 없음' 안내를 보여준다", () => {
    expect(render([])).toContain("데이터 없음");
  });

  it("보안사고가 있는 달은 감점 표시와 감점 후 합계를 보여준다", () => {
    const html = render(["2026-10"], ["2026-10"]);
    expect(html).toContain("보안사고 -50%");
    expect(html).toContain("50% 감점 적용");
  });

  it("증적자료 바로가기는 관리자에게만 보인다", () => {
    expect(render(["2026-10"], [], true)).toContain("/evidence?year=2026");
    expect(render(["2026-10"], [], false)).not.toContain("/evidence");
  });
});
