// 작업 10: 대시보드 화면 부품이 설계(DESIGN 4.4)의 요소를 보여주는지 확인한다.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardView } from "../components/dashboard/DashboardView";
import { formatPercent, formatScore } from "../lib/format";
import { calculateYear, type ScoreData } from "../lib/score";

const SERVICES = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `서비스${index + 1}` }));

function data(months: string[], incidents: string[] = []): ScoreData {
  return {
    year: 2026,
    services: SERVICES,
    inputs: SERVICES.flatMap((service) =>
      months.map((yearMonth) => ({ serviceId: service.id, yearMonth, callCount: 1000, evidenceGrade: "실측" as const })),
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
      })),
    ),
    securityIncidentMonths: incidents,
  };
}

function render(months: string[], incidents: string[] = [], isAdmin = true) {
  return renderToStaticMarkup(
    <DashboardView
      yearScore={calculateYear(data(months, incidents))}
      focusMonth="2026-10"
      focusLabel="이번 달"
      isAdmin={isAdmin}
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
  it("카드 3개, 서비스 6줄, 12개월, 합계 줄, 근거 등급 배지가 있다", () => {
    const html = render(["2026-10"]);
    expect(html).toContain("연간 누적 지수");
    expect(html).toContain("이번 달 합계");
    expect(html).toContain("설문 추정 비중");
    expect(html).toContain("66.7%");
    for (let i = 1; i <= 6; i++) expect(html).toContain(`서비스${i}`);
    expect(html).toContain("12월");
    expect(html).toContain("합계");
    expect(html).toContain("27,000.0");
    expect(html).toContain("실측");
    expect(html).toContain("설문");
  });

  it("입력이 없는 달은 '데이터 없음'이다", () => {
    expect(render(["2026-10"])).toContain("데이터 없음");
    expect(render([])).toContain("데이터 없음");
  });

  it("보안사고가 있는 달은 감점 표시와 감점 후 합계를 보여준다", () => {
    const html = render(["2026-10"], ["2026-10"]);
    expect(html).toContain("보안사고 -50%");
    expect(html).toContain("13,500.0");
    expect(html).toContain("50% 감점 적용");
  });

  it("증적자료 바로가기는 관리자에게만 보인다", () => {
    expect(render(["2026-10"], [], true)).toContain("/evidence?year=2026");
    expect(render(["2026-10"], [], false)).not.toContain("/evidence");
  });
});
